/**
 * OAuth and token data types
 */

import type { AuthenticatedAthlete } from './athlete';

/**
 * OAuth token response from Strava
 */
export interface OAuthTokenResponse {
  readonly token_type: 'Bearer';
  readonly expires_at: number;
  readonly expires_in: number;
  readonly refresh_token: string;
  readonly access_token: string;
  readonly athlete: AuthenticatedAthlete;
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  readonly token_type: 'Bearer';
  readonly access_token: string;
  readonly expires_at: number;
  readonly expires_in: number;
  readonly refresh_token: string;
}

/**
 * Stored token data
 */
export interface StoredTokens {
  readonly athleteId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly scopes?: readonly string[];
  [key: string]: any;
}

/**
 * Token data with refresh status
 */
export interface TokenData {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly wasRefreshed: boolean;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes?: readonly string[];
}

/**
 * OAuth authorization options
 */
export interface AuthorizationOptions {
  readonly state?: string;
  readonly scopes?: readonly string[];
  readonly approvalPrompt?: 'auto' | 'force';
}