/**
 * Strava API client with rate limiting and token refresh
 *
 * Handles all API calls to Strava with automatic rate limiting,
 * retry logic, and token refresh.
 */

import Bottleneck from "bottleneck";
import type {
  StravaActivity,
  StravaUpdateData,
  ActivityStats,
  ActivityStreams,
  TokenRefreshResponse,
  TokenData,
  RateLimitConfig,
  RetryConfig,
  Logger,
  ApiCallInfo,
  RateLimitInfo,
} from "../types";
import { createRateLimiter, classifyError, parseRateLimitHeaders, StravaApiError, RateLimitError } from "../utils";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes

export interface StravaApiConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly rateLimiting?: RateLimitConfig;
  readonly retry?: RetryConfig;
  readonly logger?: Logger;
  readonly onApiCall?: (info: ApiCallInfo) => void | Promise<void>;
  readonly onRateLimit?: (info: RateLimitInfo) => void | Promise<void>;
}

export class StravaApi {
  private readonly config: StravaApiConfig;
  private readonly limiter: Bottleneck;
  private readonly logger?: Logger;

  constructor(config: StravaApiConfig) {
    this.config = config;
    this.logger = config.logger;
    this.limiter = createRateLimiter(config.rateLimiting);

    this.limiter.on("error", (error) => {
      this.logger?.error("Rate limiter error", { error });
    });

    this.limiter.on("depleted", () => {
      this.logger?.warn("Rate limit reservoir depleted - queueing requests");
    });
  }

  /**
   * Get activity from Strava
   */
  async getActivity(
    activityId: string,
    accessToken: string,
  ): Promise<StravaActivity> {
    return this.limiter.schedule(async () => {
      this.logger?.debug("Fetching activity from Strava", { activityId });
      const startTime = Date.now();

      try {
        const response = await fetch(
          `${STRAVA_API_BASE}/activities/${activityId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `GET /activities/${activityId}`,
          duration,
          response,
        );

        if (!response.ok) {
          await this.handleApiError(response, "getActivity", { activityId });
        }

        const activity = (await response.json()) as StravaActivity;
        this.logger?.info("Activity retrieved successfully", { activityId });

        return activity;
      } catch (error) {
        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `GET /activities/${activityId}`,
          duration,
          undefined,
          error,
        );
        throw error;
      }
    });
  }

  /**
   * List athlete activities
   */
  async listAthleteActivities(
    accessToken: string,
    params?: {
      before?: number;
      after?: number;
      page?: number;
      per_page?: number;
    },
  ): Promise<StravaActivity[]> {
    return this.limiter.schedule(async () => {
      const queryParams = new URLSearchParams();
      if (params?.before) queryParams.set("before", params.before.toString());
      if (params?.after) queryParams.set("after", params.after.toString());
      if (params?.page) queryParams.set("page", params.page.toString());
      if (params?.per_page) queryParams.set("per_page", params.per_page.toString());

      const url = `${STRAVA_API_BASE}/athlete/activities${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

      this.logger?.debug("Fetching athlete activities", { params });
      const startTime = Date.now();

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `GET /athlete/activities`,
          duration,
          response,
        );

        if (!response.ok) {
          await this.handleApiError(response, "listAthleteActivities", { params });
        }

        const activities = (await response.json()) as StravaActivity[];
        this.logger?.info("Athlete activities retrieved successfully", {
          count: activities.length,
        });

        return activities;
      } catch (error) {
        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `GET /athlete/activities`,
          duration,
          undefined,
          error,
        );
        throw error;
      }
    });
  }

  /**
   * Get athlete statistics
   */
  async getAthleteStats(
    athleteId: string,
    accessToken: string,
  ): Promise<ActivityStats> {
    return this.limiter.schedule(async () => {
      this.logger?.debug("Fetching athlete stats", { athleteId });
      const startTime = Date.now();

      try {
        const response = await fetch(
          `${STRAVA_API_BASE}/athletes/${athleteId}/stats`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `GET /athletes/${athleteId}/stats`,
          duration,
          response,
        );

        if (!response.ok) {
          await this.handleApiError(response, "getAthleteStats", { athleteId });
        }

        const stats = (await response.json()) as ActivityStats;
        this.logger?.info("Athlete stats retrieved successfully", {
          athleteId,
        });

        return stats;
      } catch (error) {
        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `GET /athletes/${athleteId}/stats`,
          duration,
          undefined,
          error,
        );
        throw error;
      }
    });
  }

  /**
   * Get activity streams
   */
  async getActivityStreams(
    activityId: string,
    accessToken: string,
    streamKeys: string[] = ["latlng", "distance"],
  ): Promise<ActivityStreams> {
    return this.limiter.schedule(async () => {
      this.logger?.debug("Fetching activity streams", {
        activityId,
        streamKeys,
      });
      const startTime = Date.now();

      try {
        const params = new URLSearchParams({
          keys: streamKeys.join(","),
          key_by_type: "true",
        });

        const response = await fetch(
          `${STRAVA_API_BASE}/activities/${activityId}/streams?${params}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `GET /activities/${activityId}/streams`,
          duration,
          response,
        );

        if (response.status === 404) {
          this.logger?.info("Activity streams not available", { activityId });
          return {};
        }

        if (!response.ok) {
          await this.handleApiError(response, "getActivityStreams", {
            activityId,
          });
        }

        const streams = (await response.json()) as ActivityStreams;
        this.logger?.info("Activity streams retrieved successfully", {
          activityId,
        });

        return streams;
      } catch (error) {
        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `GET /activities/${activityId}/streams`,
          duration,
          undefined,
          error,
        );
        throw error;
      }
    });
  }

  /**
   * Update activity on Strava
   */
  async updateActivity(
    activityId: string,
    accessToken: string,
    updateData: StravaUpdateData,
  ): Promise<StravaActivity> {
    return this.limiter.schedule(async () => {
      this.logger?.debug("Updating activity", { activityId, updateData });
      const startTime = Date.now();

      try {
        const response = await fetch(
          `${STRAVA_API_BASE}/activities/${activityId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
          },
        );

        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `PUT /activities/${activityId}`,
          duration,
          response,
        );

        if (!response.ok) {
          await this.handleApiError(response, "updateActivity", { activityId });
        }

        const activity = (await response.json()) as StravaActivity;
        this.logger?.info("Activity updated successfully", { activityId });

        return activity;
      } catch (error) {
        const duration = Date.now() - startTime;
        await this.recordApiCall(
          `PUT /activities/${activityId}`,
          duration,
          undefined,
          error,
        );
        throw error;
      }
    });
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<TokenRefreshResponse> {
    this.logger?.debug("Refreshing access token");

    try {
      const response = await fetch(STRAVA_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Token refresh failed (${response.status}): ${errorText}`,
        );
      }

      const tokenData = (await response.json()) as TokenRefreshResponse;
      this.logger?.info("Access token refreshed successfully");

      return tokenData;
    } catch (error) {
      this.logger?.error("Failed to refresh access token", { error });
      throw error;
    }
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  async ensureValidToken(
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<TokenData> {
    const now = new Date();
    const bufferTime = new Date(now.getTime() + TOKEN_REFRESH_BUFFER);

    if (expiresAt <= bufferTime) {
      this.logger?.info("Access token expiring soon, refreshing");

      const tokenData = await this.refreshAccessToken(refreshToken);

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(tokenData.expires_at * 1000),
        wasRefreshed: true,
      };
    }

    return {
      accessToken,
      refreshToken,
      expiresAt,
      wasRefreshed: false,
    };
  }

  /**
   * Record API call for monitoring
   */
  private async recordApiCall(
    endpoint: string,
    duration: number,
    response?: Response,
    error?: unknown,
  ): Promise<void> {
    if (!this.config.onApiCall) return;

    const info: ApiCallInfo = {
      service: "strava",
      endpoint,
      method: endpoint.split(" ")[0] ?? "GET",
      duration,
      statusCode: response?.status,
      error: error instanceof Error ? error.message : undefined,
    };

    await this.config.onApiCall(info);
  }

  /**
   * Handle API errors
   */
  private async handleApiError(
    response: Response,
    operation: string,
    context: Record<string, any>,
  ): Promise<never> {
    const errorText = await response.text();
    const error = classifyError(
      { message: errorText, statusCode: response.status },
      `${operation}`,
    );

    // Parse rate limit headers if available
    const rateLimitUsage = parseRateLimitHeaders(response.headers);

    // Log rate limit info if available
    if (rateLimitUsage && this.config.onRateLimit) {
      await this.config.onRateLimit({
        limit15Min: rateLimitUsage.shortTermLimit,
        used15Min: rateLimitUsage.shortTermUsed,
        limitDaily: rateLimitUsage.dailyLimit,
        usedDaily: rateLimitUsage.dailyUsed,
        endpoint: operation,
      });
    }

    this.logger?.error(`${operation} failed`, {
      ...context,
      status: response.status,
      error: errorText,
      rateLimitUsage,
    });

    // Throw specific error type based on classification
    if (error.errorCode === "RATE_LIMITED") {
      throw new RateLimitError(error, rateLimitUsage ?? undefined);
    }

    throw new StravaApiError(error);
  }
}
