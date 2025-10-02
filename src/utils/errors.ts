/**
 * Error handling utilities
 */

import type { StravaError } from "../types";
import type { RateLimitUsage } from "./rate-limit";

/**
 * Base error class for all Strava API errors
 */
export class StravaApiError extends Error {
  public readonly statusCode?: number;
  public readonly errorCode: string;
  public readonly isRetryable: boolean;
  public readonly endpoint?: string;

  constructor(error: StravaError) {
    super(error.message);
    this.name = "StravaApiError";
    this.statusCode = error.statusCode;
    this.errorCode = error.errorCode;
    this.isRetryable = error.isRetryable;
    this.endpoint = error.endpoint;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StravaApiError);
    }
  }
}

/**
 * Rate limit error with detailed rate limit information
 */
export class RateLimitError extends StravaApiError {
  public readonly rateLimitUsage?: RateLimitUsage;
  public readonly retryAfter?: number; // seconds to wait before retrying

  constructor(error: StravaError, rateLimitUsage?: RateLimitUsage) {
    super(error);
    this.name = "RateLimitError";
    this.rateLimitUsage = rateLimitUsage;

    // Calculate retry time based on which limit was hit
    if (rateLimitUsage) {
      const shortTermExceeded = rateLimitUsage.shortTermUsed >= rateLimitUsage.shortTermLimit;
      const dailyExceeded = rateLimitUsage.dailyUsed >= rateLimitUsage.dailyLimit;

      if (dailyExceeded) {
        // If daily limit exceeded, wait longer
        this.retryAfter = 3600; // 1 hour
      } else if (shortTermExceeded) {
        // If 15-min limit exceeded, wait 15 minutes
        this.retryAfter = 900; // 15 minutes
      }
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError);
    }
  }
}

/**
 * Classify error and determine if it's retryable
 */
export function classifyError(error: unknown, endpoint?: string): StravaError {
  const errorMessage = getErrorMessage(error);
  const statusCode = getStatusCode(error);
  const errorCode = extractErrorCode(errorMessage, statusCode);

  return {
    message: errorMessage,
    statusCode,
    errorCode,
    isRetryable: isErrorRetryable(errorCode, statusCode),
    endpoint,
  };
}

/**
 * Extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

/**
 * Extract status code from error
 */
function getStatusCode(error: unknown): number | undefined {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return undefined;
}

/**
 * Extract structured error code from message
 */
function extractErrorCode(message: string, statusCode?: number): string {
  const messageLower = message.toLowerCase();

  if (statusCode === 401 || messageLower.includes("unauthorized")) {
    return "UNAUTHORIZED";
  }
  if (statusCode === 403 || messageLower.includes("forbidden")) {
    return "FORBIDDEN";
  }
  if (statusCode === 404 || messageLower.includes("not found")) {
    return "NOT_FOUND";
  }
  if (statusCode === 429 || messageLower.includes("rate limit")) {
    return "RATE_LIMITED";
  }
  if (statusCode === 500 || messageLower.includes("server error")) {
    return "SERVER_ERROR";
  }
  if (statusCode === 503 || messageLower.includes("unavailable")) {
    return "SERVICE_UNAVAILABLE";
  }
  if (statusCode === 504 || messageLower.includes("timeout")) {
    return "TIMEOUT";
  }
  if (messageLower.includes("token") && messageLower.includes("expired")) {
    return "TOKEN_EXPIRED";
  }
  if (messageLower.includes("token") && messageLower.includes("invalid")) {
    return "TOKEN_INVALID";
  }

  return "UNKNOWN_ERROR";
}

/**
 * Determine if error is retryable
 */
function isErrorRetryable(errorCode: string, statusCode?: number): boolean {
  const retryableCodes = new Set([
    "RATE_LIMITED",
    "TIMEOUT",
    "SERVICE_UNAVAILABLE",
    "SERVER_ERROR",
  ]);

  if (retryableCodes.has(errorCode)) {
    return true;
  }

  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return true;
  }

  return false;
}

/**
 * Check if error indicates temporary failure
 */
export function isTemporaryError(error: string): boolean {
  const errorLower = error.toLowerCase();

  return (
    errorLower.includes("timeout") ||
    errorLower.includes("rate limit") ||
    errorLower.includes("unavailable") ||
    errorLower.includes("503") ||
    errorLower.includes("504") ||
    errorLower.includes("429") ||
    errorLower.includes("temporary")
  );
}

/**
 * Check if error indicates authentication issue
 */
export function isAuthenticationError(error: string): boolean {
  const errorLower = error.toLowerCase();

  return (
    errorLower.includes("unauthorized") ||
    errorLower.includes("401") ||
    errorLower.includes("forbidden") ||
    errorLower.includes("403") ||
    errorLower.includes("token") ||
    errorLower.includes("authentication") ||
    errorLower.includes("permission")
  );
}
