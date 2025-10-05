import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "../../storage";

describe("MemoryStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  describe("getTokens", () => {
    it("returns null for non-existent athlete", async () => {
      const result = await storage.getTokens("12345");
      expect(result).toBe(null);
    });

    it("returns tokens for existing athlete", async () => {
      const tokens = {
        athleteId: "12345",
        accessToken: "access-123",
        refreshToken: "refresh-123",
        expiresAt: new Date("2025-01-01"),
      };

      await storage.saveTokens("12345", tokens);
      const result = await storage.getTokens("12345");

      expect(result).toEqual(tokens);
    });
  });

  describe("saveTokens", () => {
    it("saves new tokens", async () => {
      const tokens = {
        athleteId: "12345",
        accessToken: "access-123",
        refreshToken: "refresh-123",
        expiresAt: new Date("2025-01-01"),
      };

      await storage.saveTokens("12345", tokens);
      const result = await storage.getTokens("12345");

      expect(result).toEqual(tokens);
    });

    it("updates existing tokens", async () => {
      const initialTokens = {
        athleteId: "12345",
        accessToken: "access-old",
        refreshToken: "refresh-old",
        expiresAt: new Date("2024-01-01"),
      };

      const updatedTokens = {
        athleteId: "12345",
        accessToken: "access-new",
        refreshToken: "refresh-new",
        expiresAt: new Date("2025-01-01"),
      };

      await storage.saveTokens("12345", initialTokens);
      await storage.saveTokens("12345", updatedTokens);
      const result = await storage.getTokens("12345");

      expect(result).toEqual(updatedTokens);
    });

    it("stores tokens with custom fields", async () => {
      const tokens = {
        athleteId: "12345",
        accessToken: "access-123",
        refreshToken: "refresh-123",
        expiresAt: new Date("2025-01-01"),
        customField: "custom-value",
        scopes: ["activity:read_all"],
      };

      await storage.saveTokens("12345", tokens);
      const result = await storage.getTokens("12345");

      expect(result).toEqual(tokens);
    });
  });

  describe("deleteTokens", () => {
    it("deletes existing tokens", async () => {
      const tokens = {
        athleteId: "12345",
        accessToken: "access-123",
        refreshToken: "refresh-123",
        expiresAt: new Date("2025-01-01"),
      };

      await storage.saveTokens("12345", tokens);
      await storage.deleteTokens("12345");
      const result = await storage.getTokens("12345");

      expect(result).toBe(null);
    });

    it("does not error when deleting non-existent tokens", async () => {
      await expect(storage.deleteTokens("99999")).resolves.toBeUndefined();
    });
  });

  describe("listAthletes", () => {
    it("returns empty array when no athletes", async () => {
      const result = await storage.listAthletes();
      expect(result).toEqual([]);
    });

    it("returns list of athlete IDs", async () => {
      const tokens1 = {
        athleteId: "111",
        accessToken: "access-1",
        refreshToken: "refresh-1",
        expiresAt: new Date("2025-01-01"),
      };

      const tokens2 = {
        athleteId: "222",
        accessToken: "access-2",
        refreshToken: "refresh-2",
        expiresAt: new Date("2025-01-01"),
      };

      await storage.saveTokens("111", tokens1);
      await storage.saveTokens("222", tokens2);

      const result = await storage.listAthletes();

      expect(result).toHaveLength(2);
      expect(result).toContain("111");
      expect(result).toContain("222");
    });
  });

  describe("clear", () => {
    it("removes all stored tokens", async () => {
      const tokens1 = {
        athleteId: "111",
        accessToken: "access-1",
        refreshToken: "refresh-1",
        expiresAt: new Date("2025-01-01"),
      };

      const tokens2 = {
        athleteId: "222",
        accessToken: "access-2",
        refreshToken: "refresh-2",
        expiresAt: new Date("2025-01-01"),
      };

      await storage.saveTokens("111", tokens1);
      await storage.saveTokens("222", tokens2);

      storage.clear();

      expect(await storage.getTokens("111")).toBe(null);
      expect(await storage.getTokens("222")).toBe(null);
      expect(await storage.listAthletes()).toEqual([]);
    });
  });
});
