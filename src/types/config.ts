/**
 * Configuration types for the Strava SDK
 */

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  readonly shortTerm?: {
    readonly requests: number;
    readonly per: number;
  };
  readonly daily?: {
    readonly requests: number;
    readonly per: number;
  };
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  readonly maxAttempts?: number;
  readonly delayMs?: readonly number[];
}

/**
 * Monitoring hooks
 */
export interface MonitoringHooks {
  readonly onApiCall?: (info: ApiCallInfo) => void | Promise<void>;
  readonly onError?: (error: StravaError) => void | Promise<void>;
  readonly onTokenRefresh?: (
    athleteId: string,
    tokens: { accessToken: string; refreshToken: string; expiresAt: Date },
  ) => void | Promise<void>;
  readonly onRateLimit?: (info: RateLimitInfo) => void | Promise<void>;
}

/**
 * Logger interface
 */
export interface Logger {
  readonly debug: (message: string, meta?: any) => void;
  readonly info: (message: string, meta?: any) => void;
  readonly warn: (message: string, meta?: any) => void;
  readonly error: (message: string, meta?: any) => void;
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  readonly timeout?: number;
  readonly headers?: Record<string, string>;
  readonly agent?: any;
}

/**
 * Main SDK configuration
 */
export interface StravaClientConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly storage: any; // TokenStorage - type imported from storage module
  readonly defaultScopes?: readonly string[];
  readonly rateLimiting?: RateLimitConfig;
  readonly retry?: RetryConfig;
  readonly webhooks?: {
    readonly verifyToken?: string;
    readonly processingTimeout?: number;
    readonly maxRetries?: number;
  };
  readonly logger?: Logger;
  readonly httpClient?: HttpClientConfig;
  readonly onApiCall?: MonitoringHooks['onApiCall'];
  readonly onError?: MonitoringHooks['onError'];
  readonly onTokenRefresh?: MonitoringHooks['onTokenRefresh'];
  readonly onRateLimit?: MonitoringHooks['onRateLimit'];
}

/**
 * API call information for monitoring
 */
export interface ApiCallInfo {
  readonly service: string;
  readonly endpoint: string;
  readonly method: string;
  readonly duration: number;
  readonly statusCode?: number;
  readonly error?: string;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  readonly limit15Min: number;
  readonly used15Min: number;
  readonly limitDaily: number;
  readonly usedDaily: number;
  readonly endpoint: string;
}

/**
 * Strava error
 */
export interface StravaError {
  readonly message: string;
  readonly statusCode?: number;
  readonly errorCode: string;
  readonly isRetryable: boolean;
  readonly endpoint?: string;
}