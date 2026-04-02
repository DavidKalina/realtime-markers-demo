import { User } from "@/services/ApiClient";

// Cache TTL in milliseconds (5 minutes)
export const CACHE_TTL = 5 * 60 * 1000;

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface Cache {
  profile?: CacheEntry<User>;
}

// Global cache instance
export const globalCache: Cache = {};

/** Invalidate the profile cache so the next render refetches from the server. */
export function invalidateProfileCache(): void {
  delete globalCache.profile;
}
