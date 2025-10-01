/**
 * Retry logic utilities
 */

/**
 * Calculate delay for exponential backoff
 */
export function calculateRetryDelay(
  attemptNumber: number,
  baseDelay: number = 1000,
  maxDelay: number = 60000,
): number {
  const delay = baseDelay * Math.pow(2, attemptNumber);
  return Math.min(delay, maxDelay);
}

/**
 * Calculate retry delay from configured delays
 */
export function getRetryDelay(
  attemptNumber: number,
  configuredDelays?: readonly number[],
): number | null {
  if (!configuredDelays || configuredDelays.length === 0) {
    return calculateRetryDelay(attemptNumber);
  }

  if (attemptNumber >= configuredDelays.length) {
    return null;
  }

  return configuredDelays[attemptNumber] ?? null;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delays?: readonly number[];
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    delays,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts - 1 || !shouldRetry(error)) {
        throw error;
      }

      const delay = getRetryDelay(attempt, delays);
      if (delay === null) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt, error);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}
