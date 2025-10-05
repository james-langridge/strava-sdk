import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { StravaApi } from "../../core";

describe("StravaApi Integration", () => {
  let api: StravaApi;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();

    api = new StravaApi({
      clientId: "test-client-id",
      clientSecret: "test-secret",
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("getActivity", () => {
    it("fetches activity successfully", async () => {
      const mockActivity = {
        id: 12345,
        name: "Morning Ride",
        type: "Ride",
        distance: 10000,
        moving_time: 1800,
        elapsed_time: 2000,
        total_elevation_gain: 100,
        start_date: "2025-01-01T10:00:00Z",
        start_date_local: "2025-01-01T10:00:00Z",
        timezone: "America/Los_Angeles",
        start_latlng: [37.7749, -122.4194] as [number, number],
        end_latlng: null,
        achievement_count: 0,
        kudos_count: 5,
        comment_count: 2,
        athlete_count: 1,
        photo_count: 0,
        private: false,
        visibility: "everyone",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockActivity,
        headers: new Headers({
          "X-RateLimit-Usage": "10,100",
          "X-RateLimit-Limit": "200,2000",
        }),
      });

      const result = await api.getActivity("12345", "test-token");

      expect(result).toEqual(mockActivity);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.strava.com/api/v3/activities/12345",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
      );
    });

    it("throws error for 404 response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Activity not found",
      });

      await expect(api.getActivity("99999", "test-token")).rejects.toThrow();
    });

    it("throws error for 401 response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(api.getActivity("12345", "invalid-token")).rejects.toThrow();
    });
  });

  describe("updateActivity", () => {
    it("updates activity successfully", async () => {
      const mockUpdatedActivity = {
        id: 12345,
        name: "Updated Name",
        description: "New description",
        type: "Ride",
        distance: 10000,
        moving_time: 1800,
        elapsed_time: 2000,
        total_elevation_gain: 100,
        start_date: "2025-01-01T10:00:00Z",
        start_date_local: "2025-01-01T10:00:00Z",
        timezone: "America/Los_Angeles",
        start_latlng: null,
        end_latlng: null,
        achievement_count: 0,
        kudos_count: 5,
        comment_count: 2,
        athlete_count: 1,
        photo_count: 0,
        private: false,
        visibility: "everyone",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdatedActivity,
        headers: new Headers(),
      });

      const result = await api.updateActivity("12345", "test-token", {
        name: "Updated Name",
        description: "New description",
      });

      expect(result.name).toBe("Updated Name");
      expect(result.description).toBe("New description");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.strava.com/api/v3/activities/12345",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("Updated Name"),
        }),
      );
    });
  });

  describe("getAthleteStats", () => {
    it("fetches athlete stats successfully", async () => {
      const mockStats = {
        biggest_ride_distance: 50000,
        recent_ride_totals: {
          count: 5,
          distance: 100000,
          moving_time: 10000,
          elapsed_time: 12000,
          elevation_gain: 1000,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStats,
        headers: new Headers(),
      });

      const result = await api.getAthleteStats("12345", "test-token");

      expect(result).toEqual(mockStats);
    });
  });

  describe("getActivityStreams", () => {
    it("fetches activity streams successfully", async () => {
      const mockStreams = {
        latlng: {
          data: [
            [37.7749, -122.4194],
            [37.775, -122.4195],
          ],
          series_type: "distance",
          original_size: 100,
          resolution: "high",
        },
        distance: {
          data: [0, 100, 200],
          series_type: "distance",
          original_size: 100,
          resolution: "high",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStreams,
        headers: new Headers(),
      });

      const result = await api.getActivityStreams("12345", "test-token", [
        "latlng",
        "distance",
      ]);

      expect(result).toEqual(mockStreams);
    });

    it("returns empty object for 404 (streams not available)", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not found",
      });

      const result = await api.getActivityStreams("12345", "test-token");

      expect(result).toEqual({});
    });
  });

  describe("refreshAccessToken", () => {
    it("refreshes token successfully", async () => {
      const mockTokenResponse = {
        token_type: "Bearer",
        access_token: "new-access-token",
        expires_at: 1234567890,
        expires_in: 3600,
        refresh_token: "new-refresh-token",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTokenResponse,
      });

      const result = await api.refreshAccessToken("old-refresh-token");

      expect(result.access_token).toBe("new-access-token");
      expect(result.refresh_token).toBe("new-refresh-token");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.strava.com/oauth/token",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("old-refresh-token"),
        }),
      );
    });

    it("throws error when refresh fails", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Invalid refresh token",
      });

      await expect(
        api.refreshAccessToken("invalid-refresh-token"),
      ).rejects.toThrow("Token refresh failed");
    });
  });

  describe("ensureValidToken", () => {
    it("returns tokens without refresh when not expired", async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      const result = await api.ensureValidToken(
        "access-token",
        "refresh-token",
        futureDate,
      );

      expect(result.wasRefreshed).toBe(false);
      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
    });

    it("refreshes tokens when expired", async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      const mockTokenResponse = {
        token_type: "Bearer",
        access_token: "new-access-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        refresh_token: "new-refresh-token",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTokenResponse,
      });

      const result = await api.ensureValidToken(
        "old-access-token",
        "old-refresh-token",
        pastDate,
      );

      expect(result.wasRefreshed).toBe(true);
      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("new-refresh-token");
    });

    it("refreshes tokens when within expiry buffer", async () => {
      const soonToExpire = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now (within 5 min buffer)

      const mockTokenResponse = {
        token_type: "Bearer",
        access_token: "new-access-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        refresh_token: "new-refresh-token",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTokenResponse,
      });

      const result = await api.ensureValidToken(
        "old-access-token",
        "old-refresh-token",
        soonToExpire,
      );

      expect(result.wasRefreshed).toBe(true);
    });
  });
});
