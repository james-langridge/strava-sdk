/**
 * Main Strava SDK client
 *
 * Provides unified interface to all Strava API functionality.
 */

import type { StravaClientConfig } from "../types";
import type { TokenStorage } from "../storage";
import { StravaOAuth } from "./oauth";
import { StravaApi } from "./api";
import { StravaWebhooks } from "./webhooks";

export class StravaClient {
  public readonly oauth: StravaOAuth;
  public readonly api: StravaApi;
  public readonly webhooks: StravaWebhooks;
  public readonly storage: TokenStorage;

  constructor(config: StravaClientConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error("clientId and clientSecret are required");
    }
    if (!config.redirectUri) {
      throw new Error("redirectUri is required");
    }
    if (!config.storage) {
      throw new Error("storage implementation is required");
    }

    this.storage = config.storage;

    this.oauth = new StravaOAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      scopes: config.defaultScopes,
    });

    this.api = new StravaApi({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      rateLimiting: config.rateLimiting,
      retry: config.retry,
      logger: config.logger,
      onApiCall: config.onApiCall,
      onRateLimit: config.onRateLimit,
    });

    this.webhooks = new StravaWebhooks({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      verifyToken: config.webhooks?.verifyToken ?? "STRAVA",
      logger: config.logger,
    });
  }

  /**
   * Get activity with automatic token refresh
   *
   * This is a convenience method that handles token refresh automatically
   * by loading tokens from storage, refreshing if needed, and saving back.
   */
  async getActivityWithRefresh(
    activityId: string,
    athleteId: string,
  ): Promise<ReturnType<typeof this.api.getActivity>> {
    const tokens = await this.storage.getTokens(athleteId);
    if (!tokens) {
      throw new Error(`No tokens found for athlete ${athleteId}`);
    }

    const validTokens = await this.api.ensureValidToken(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
    );

    if (validTokens.wasRefreshed) {
      await this.storage.saveTokens(athleteId, {
        ...tokens,
        accessToken: validTokens.accessToken,
        refreshToken: validTokens.refreshToken,
        expiresAt: validTokens.expiresAt,
      });
    }

    return this.api.getActivity(activityId, validTokens.accessToken);
  }

  /**
   * Update activity with automatic token refresh
   */
  async updateActivityWithRefresh(
    activityId: string,
    athleteId: string,
    updateData: Parameters<typeof this.api.updateActivity>[2],
  ): Promise<ReturnType<typeof this.api.updateActivity>> {
    const tokens = await this.storage.getTokens(athleteId);
    if (!tokens) {
      throw new Error(`No tokens found for athlete ${athleteId}`);
    }

    const validTokens = await this.api.ensureValidToken(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
    );

    if (validTokens.wasRefreshed) {
      await this.storage.saveTokens(athleteId, {
        ...tokens,
        accessToken: validTokens.accessToken,
        refreshToken: validTokens.refreshToken,
        expiresAt: validTokens.expiresAt,
      });
    }

    return this.api.updateActivity(
      activityId,
      validTokens.accessToken,
      updateData,
    );
  }
}
