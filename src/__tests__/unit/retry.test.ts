import { describe, it, expect, vi } from 'vitest';
import {
  calculateRetryDelay,
  getRetryDelay,
  sleep,
  retryWithBackoff,
} from '../../utils/retry';

describe('calculateRetryDelay', () => {
  it('calculates exponential backoff correctly', () => {
    expect(calculateRetryDelay(0, 1000)).toBe(1000); // 1000 * 2^0
    expect(calculateRetryDelay(1, 1000)).toBe(2000); // 1000 * 2^1
    expect(calculateRetryDelay(2, 1000)).toBe(4000); // 1000 * 2^2
    expect(calculateRetryDelay(3, 1000)).toBe(8000); // 1000 * 2^3
  });

  it('respects max delay', () => {
    expect(calculateRetryDelay(10, 1000, 5000)).toBe(5000);
    expect(calculateRetryDelay(20, 1000, 10000)).toBe(10000);
  });

  it('uses default base delay of 1000ms', () => {
    expect(calculateRetryDelay(0)).toBe(1000);
    expect(calculateRetryDelay(1)).toBe(2000);
  });
});

describe('getRetryDelay', () => {
  it('returns configured delay for valid attempt number', () => {
    const delays = [1000, 2000, 4000];
    expect(getRetryDelay(0, delays)).toBe(1000);
    expect(getRetryDelay(1, delays)).toBe(2000);
    expect(getRetryDelay(2, delays)).toBe(4000);
  });

  it('returns null when attempt exceeds configured delays', () => {
    const delays = [1000, 2000];
    expect(getRetryDelay(2, delays)).toBe(null);
    expect(getRetryDelay(3, delays)).toBe(null);
  });

  it('falls back to exponential backoff when no delays configured', () => {
    expect(getRetryDelay(0)).toBe(1000);
    expect(getRetryDelay(1)).toBe(2000);
    expect(getRetryDelay(2)).toBe(4000);
  });

  it('falls back to exponential backoff for empty delays array', () => {
    expect(getRetryDelay(0, [])).toBe(1000);
  });
});

describe('sleep', () => {
  it('resolves after specified time', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(150);
  });
});

describe('retryWithBackoff', () => {
  it('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      delays: [10, 10],
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        delays: [10, 10],
      }),
    ).rejects.toThrow('persistent failure');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects shouldRetry predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('do not retry'));

    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('do not retry');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');
    const onRetry = vi.fn();

    await retryWithBackoff(fn, {
      maxAttempts: 2,
      delays: [10],
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(0, expect.any(Error));
  });

  it('uses default maxAttempts of 3', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      retryWithBackoff(fn, { delays: [1, 1, 1] }),
    ).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(3);
  });
});