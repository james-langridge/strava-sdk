/**
 * OAuth authentication module
 *
 * Handles Strava OAuth flow including authorization URL generation
 * and token exchange.
 */

import type {
  OAuthConfig,
  AuthorizationOptions,
  OAuthTokenResponse,
} from "../types";
import { validateOAuthConfig } from "../utils";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

export class StravaOAuth {
  private readonly config: OAuthConfig;

  constructor(config: OAuthConfig) {
    const errors = validateOAuthConfig(config);
    if (errors.length > 0) {
      throw new Error(`OAuth configuration errors: ${errors.join(", ")}`);
    }
    this.config = config;
  }

  /**
   * Generate authorization URL for OAuth flow
   *
   * @param options - Authorization options
   * @returns Authorization URL to redirect user to
   */
  getAuthUrl(options: AuthorizationOptions = {}): string {
    const scopes = options.scopes ??
      this.config.scopes ?? ["activity:read_all"];
    const approvalPrompt = options.approvalPrompt ?? "auto";

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      approval_prompt: approvalPrompt,
      scope: scopes.join(","),
    });

    if (options.state) {
      params.set("state", options.state);
    }

    return `${STRAVA_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   *
   * @param code - Authorization code from OAuth callback
   * @returns OAuth token response including athlete data
   * @throws Error if token exchange fails
   */
  async exchangeCode(code: string): Promise<OAuthTokenResponse> {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token exchange failed (${response.status}): ${errorText}`,
      );
    }

    const tokenData = (await response.json()) as OAuthTokenResponse;

    if (!tokenData.athlete) {
      throw new Error("Token response missing athlete data");
    }

    return tokenData;
  }

  /**
   * Revoke access token
   *
   * @param accessToken - Access token to revoke
   */
  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token revocation failed (${response.status}): ${errorText}`,
      );
    }
  }
}
