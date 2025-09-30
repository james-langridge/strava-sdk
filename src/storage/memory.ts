/**
 * In-memory token storage implementation
 *
 * FOR DEVELOPMENT/TESTING ONLY
 * Do not use in production - tokens will be lost when the process restarts
 */

import type { TokenStorage } from './interface';
import type { StoredTokens } from '../types';

export class MemoryStorage implements TokenStorage {
  private tokens: Map<string, StoredTokens> = new Map();

  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    return this.tokens.get(athleteId) ?? null;
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    this.tokens.set(athleteId, tokens);
  }

  async deleteTokens(athleteId: string): Promise<void> {
    this.tokens.delete(athleteId);
  }

  async listAthletes(): Promise<string[]> {
    return Array.from(this.tokens.keys());
  }

  /**
   * Clear all stored tokens (useful for testing)
   */
  clear(): void {
    this.tokens.clear();
  }
}