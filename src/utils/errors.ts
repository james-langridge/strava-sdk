/**
 * Error handling utilities
 */

import type { StravaError } from "../types";

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
