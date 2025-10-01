import { describe, it, expect } from "vitest";
import {
  validateWebhookVerification,
  validateOAuthConfig,
  isValidUrl,
  isHttpsUrl,
} from "../../utils/validation";

describe("validateWebhookVerification", () => {
  it("validates correct webhook verification parameters", () => {
    const result = validateWebhookVerification(
      {
        mode: "subscribe",
        token: "my-verify-token",
        challenge: "test-challenge",
      },
      "my-verify-token",
    );

    expect(result.valid).toBe(true);
    expect(result.challenge).toBe("test-challenge");
  });

  it("rejects missing mode parameter", () => {
    const result = validateWebhookVerification(
      {
        token: "my-verify-token",
        challenge: "test-challenge",
      },
      "my-verify-token",
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Missing required verification parameters");
  });

  it("rejects missing token parameter", () => {
    const result = validateWebhookVerification(
      {
        mode: "subscribe",
        challenge: "test-challenge",
      },
      "my-verify-token",
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Missing required verification parameters");
  });

  it("rejects missing challenge parameter", () => {
    const result = validateWebhookVerification(
      {
        mode: "subscribe",
        token: "my-verify-token",
      },
      "my-verify-token",
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Missing required verification parameters");
  });

  it("rejects invalid mode", () => {
    const result = validateWebhookVerification(
      {
        mode: "invalid-mode",
        token: "my-verify-token",
        challenge: "test-challenge",
      },
      "my-verify-token",
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid verification mode: invalid-mode");
  });

  it("rejects incorrect token", () => {
    const result = validateWebhookVerification(
      {
        mode: "subscribe",
        token: "wrong-token",
        challenge: "test-challenge",
      },
      "my-verify-token",
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid verification token");
  });
});

describe("validateOAuthConfig", () => {
  it("returns no errors for valid config", () => {
    const errors = validateOAuthConfig({
      clientId: "test-client-id",
      clientSecret: "test-secret",
      redirectUri: "http://localhost:3000/callback",
    });

    expect(errors).toEqual([]);
  });

  it("returns error for missing clientId", () => {
    const errors = validateOAuthConfig({
      clientSecret: "test-secret",
      redirectUri: "http://localhost:3000/callback",
    });

    expect(errors).toContain("clientId is required");
  });

  it("returns error for missing clientSecret", () => {
    const errors = validateOAuthConfig({
      clientId: "test-client-id",
      redirectUri: "http://localhost:3000/callback",
    });

    expect(errors).toContain("clientSecret is required");
  });

  it("returns error for missing redirectUri", () => {
    const errors = validateOAuthConfig({
      clientId: "test-client-id",
      clientSecret: "test-secret",
    });

    expect(errors).toContain("redirectUri is required");
  });

  it("returns multiple errors for missing multiple fields", () => {
    const errors = validateOAuthConfig({});

    expect(errors).toHaveLength(3);
    expect(errors).toContain("clientId is required");
    expect(errors).toContain("clientSecret is required");
    expect(errors).toContain("redirectUri is required");
  });
});

describe("isValidUrl", () => {
  it("validates correct HTTP URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
    expect(isValidUrl("http://example.com/path")).toBe(true);
    expect(isValidUrl("http://example.com:8080")).toBe(true);
  });

  it("validates correct HTTPS URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("https://api.strava.com/v3/activities")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(true); // Valid URL, just not HTTP(S)
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("//example.com")).toBe(false);
  });
});

describe("isHttpsUrl", () => {
  it("validates HTTPS URLs", () => {
    expect(isHttpsUrl("https://example.com")).toBe(true);
    expect(isHttpsUrl("https://api.strava.com/webhook")).toBe(true);
  });

  it("rejects HTTP URLs", () => {
    expect(isHttpsUrl("http://example.com")).toBe(false);
    expect(isHttpsUrl("http://localhost:3000")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isHttpsUrl("not-a-url")).toBe(false);
    expect(isHttpsUrl("")).toBe(false);
    expect(isHttpsUrl("ftp://example.com")).toBe(false);
  });
});
