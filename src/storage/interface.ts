/**
 * Token storage interface
 *
 * Applications must implement this interface to persist tokens.
 * The library provides an in-memory implementation for development/testing.
 */

import type { StoredTokens } from "../types";

export interface TokenStorage {
  /**
   * Retrieve tokens for an athlete
   * @param athleteId - The Strava athlete ID
   * @returns Stored tokens or null if not found
   */
  getTokens(athleteId: string): Promise<StoredTokens | null>;

  /**
   * Save or update tokens for an athlete
   * @param athleteId - The Strava athlete ID
   * @param tokens - Token data to store
   */
  saveTokens(athleteId: string, tokens: StoredTokens): Promise<void>;

  /**
   * Delete tokens for an athlete
   * @param athleteId - The Strava athlete ID
   */
  deleteTokens(athleteId: string): Promise<void>;

  /**
   * List all athlete IDs (optional, for batch operations)
   * @returns Array of athlete IDs
   */
  listAthletes?(): Promise<string[]>;
}
