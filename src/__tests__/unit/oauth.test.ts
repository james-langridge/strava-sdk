import { describe, it, expect, beforeEach, vi } from "vitest";
import { StravaOAuth } from "../../core/oauth";

describe("StravaOAuth", () => {
  const config = {
    clientId: "test-client-id",
    clientSecret: "test-secret",
    redirectUri: "http://localhost:3000/callback",
  };

  describe("constructor", () => {
    it("creates instance with valid config", () => {
      const oauth = new StravaOAuth(config);
      expect(oauth).toBeInstanceOf(StravaOAuth);
    });

    it("throws error for missing clientId", () => {
      expect(() => new StravaOAuth({ ...config, clientId: "" })).toThrow(
        "OAuth configuration errors",
      );
    });

    it("throws error for missing clientSecret", () => {
      expect(() => new StravaOAuth({ ...config, clientSecret: "" })).toThrow(
        "OAuth configuration errors",
      );
    });

    it("throws error for missing redirectUri", () => {
      expect(() => new StravaOAuth({ ...config, redirectUri: "" })).toThrow(
        "OAuth configuration errors",
      );
    });
  });

  describe("getAuthUrl", () => {
    let oauth: StravaOAuth;

    beforeEach(() => {
      oauth = new StravaOAuth(config);
    });

    it("generates authorization URL with default scopes", () => {
      const url = oauth.getAuthUrl();

      expect(url).toContain("https://www.strava.com/oauth/authorize");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback",
      );
      expect(url).toContain("response_type=code");
      expect(url).toContain("scope=activity%3Aread_all");
      expect(url).toContain("approval_prompt=auto");
    });

    it("uses custom scopes when provided", () => {
      const url = oauth.getAuthUrl({
        scopes: ["activity:read_all", "activity:write"],
      });

      expect(url).toContain("scope=activity%3Aread_all%2Cactivity%3Awrite");
    });

    it("includes state parameter when provided", () => {
      const url = oauth.getAuthUrl({ state: "csrf-token-123" });

      expect(url).toContain("state=csrf-token-123");
    });

    it("uses force approval prompt when specified", () => {
      const url = oauth.getAuthUrl({ approvalPrompt: "force" });

      expect(url).toContain("approval_prompt=force");
    });

    it("uses config scopes as default", () => {
      const oauthWithScopes = new StravaOAuth({
        ...config,
        scopes: ["activity:write", "profile:read_all"],
      });

      const url = oauthWithScopes.getAuthUrl();

      expect(url).toContain("scope=activity%3Awrite%2Cprofile%3Aread_all");
    });
  });

  describe("exchangeCode", () => {
    let oauth: StravaOAuth;

    beforeEach(() => {
      oauth = new StravaOAuth(config);
      global.fetch = vi.fn();
    });

    it("exchanges code for tokens successfully", async () => {
      const mockResponse = {
        token_type: "Bearer",
        expires_at: 1234567890,
        expires_in: 3600,
        refresh_token: "refresh-token-123",
        access_token: "access-token-123",
        athlete: {
          id: 12345,
          firstname: "John",
          lastname: "Doe",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await oauth.exchangeCode("auth-code-123");

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.strava.com/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("auth-code-123"),
        }),
      );
    });

    it("throws error when token exchange fails", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Invalid authorization code",
      });

      await expect(oauth.exchangeCode("invalid-code")).rejects.toThrow(
        "Token exchange failed (400)",
      );
    });

    it("throws error when athlete data is missing", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token_type: "Bearer",
          access_token: "token",
          // Missing athlete
        }),
      });

      await expect(oauth.exchangeCode("auth-code")).rejects.toThrow(
        "Token response missing athlete data",
      );
    });
  });

  describe("revokeToken", () => {
    let oauth: StravaOAuth;

    beforeEach(() => {
      oauth = new StravaOAuth(config);
      global.fetch = vi.fn();
    });

    it("revokes token successfully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await oauth.revokeToken("access-token-123");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.strava.com/oauth/deauthorize",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer access-token-123",
          }),
        }),
      );
    });

    it("throws error when revocation fails", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid token",
      });

      await expect(oauth.revokeToken("invalid-token")).rejects.toThrow(
        "Token revocation failed (401)",
      );
    });
  });
});
