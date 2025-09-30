/**
 * Rate limiting utilities
 */

import Bottleneck from 'bottleneck';
import type { RateLimitConfig } from '../types';

/**
 * Default Strava rate limits
 * - 200 requests per 15 minutes
 * - 2000 requests per day
 */
export const DEFAULT_RATE_LIMITS: Required<RateLimitConfig> = {
  shortTerm: {
    requests: 200,
    per: 15 * 60 * 1000, // 15 minutes in ms
  },
  daily: {
    requests: 2000,
    per: 24 * 60 * 60 * 1000, // 24 hours in ms
  },
};

/**
 * Create a Bottleneck limiter configured for Strava's rate limits
 */
export function createRateLimiter(
  config?: RateLimitConfig,
): Bottleneck {
  const limits = {
    shortTerm: config?.shortTerm ?? DEFAULT_RATE_LIMITS.shortTerm,
    daily: config?.daily ?? DEFAULT_RATE_LIMITS.daily,
  };

  return new Bottleneck({
    // Conservative settings to stay well under limits
    minTime: 6000, // Minimum 6 seconds between requests (~10/min)
    maxConcurrent: 1, // One request at a time

    // Start with most of the 15-min limit available
    reservoir: Math.floor(limits.shortTerm.requests * 0.9),
    reservoirRefreshAmount: Math.floor(limits.shortTerm.requests * 0.9),
    reservoirRefreshInterval: limits.shortTerm.per,
  });
}

/**
 * Parse rate limit headers from Strava API response
 */
export interface RateLimitUsage {
  readonly shortTermUsed: number;
  readonly shortTermLimit: number;
  readonly dailyUsed: number;
  readonly dailyLimit: number;
}

export function parseRateLimitHeaders(
  headers: Headers,
): RateLimitUsage | null {
  const usage = headers.get('X-RateLimit-Usage');
  const limit = headers.get('X-RateLimit-Limit');

  if (!usage || !limit) {
    return null;
  }

  const [shortTermUsed, dailyUsed] = usage.split(',').map(Number);
  const [shortTermLimit, dailyLimit] = limit.split(',').map(Number);

  if (
    isNaN(shortTermUsed) ||
    isNaN(dailyUsed) ||
    isNaN(shortTermLimit) ||
    isNaN(dailyLimit)
  ) {
    return null;
  }

  return {
    shortTermUsed,
    shortTermLimit,
    dailyUsed,
    dailyLimit,
  };
}