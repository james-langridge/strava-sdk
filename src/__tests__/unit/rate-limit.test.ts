import { describe, it, expect } from "vitest";
import {
  DEFAULT_RATE_LIMITS,
  createRateLimiter,
  parseRateLimitHeaders,
} from "../../utils";

describe("DEFAULT_RATE_LIMITS", () => {
  it("has correct short term limits for non-approved apps", () => {
    expect(DEFAULT_RATE_LIMITS.shortTerm.requests).toBe(100);
    expect(DEFAULT_RATE_LIMITS.shortTerm.per).toBe(15 * 60 * 1000);
  });

  it("has correct daily limits for non-approved apps", () => {
    expect(DEFAULT_RATE_LIMITS.daily.requests).toBe(1000);
    expect(DEFAULT_RATE_LIMITS.daily.per).toBe(24 * 60 * 60 * 1000);
  });
});

describe("createRateLimiter", () => {
  it("creates a limiter with default settings", () => {
    const limiter = createRateLimiter();

    expect(limiter).toBeDefined();
    expect(limiter.constructor.name).toBe("Bottleneck");
  });

  it("creates a limiter with custom rate limits", () => {
    const limiter = createRateLimiter({
      shortTerm: { requests: 100, per: 10000 },
      daily: { requests: 1000, per: 86400000 },
    });

    expect(limiter).toBeDefined();
  });
});

describe("parseRateLimitHeaders", () => {
  it("parses valid rate limit headers", () => {
    const headers = new Headers({
      "X-RateLimit-Usage": "50,500",
      "X-RateLimit-Limit": "200,2000",
    });

    const result = parseRateLimitHeaders(headers);

    expect(result).toEqual({
      shortTermUsed: 50,
      shortTermLimit: 200,
      dailyUsed: 500,
      dailyLimit: 2000,
    });
  });

  it("returns null when headers are missing", () => {
    const headers = new Headers({});

    const result = parseRateLimitHeaders(headers);

    expect(result).toBe(null);
  });

  it("returns null when usage header is missing", () => {
    const headers = new Headers({
      "X-RateLimit-Limit": "200,2000",
    });

    const result = parseRateLimitHeaders(headers);

    expect(result).toBe(null);
  });

  it("returns null when limit header is missing", () => {
    const headers = new Headers({
      "X-RateLimit-Usage": "50,500",
    });

    const result = parseRateLimitHeaders(headers);

    expect(result).toBe(null);
  });

  it("returns null for invalid numeric values", () => {
    const headers = new Headers({
      "X-RateLimit-Usage": "invalid,500",
      "X-RateLimit-Limit": "200,2000",
    });

    const result = parseRateLimitHeaders(headers);

    expect(result).toBe(null);
  });
});
