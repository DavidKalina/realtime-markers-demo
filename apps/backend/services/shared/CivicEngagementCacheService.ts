import { CivicEngagement } from "@realtime-markers/database";
import { createCacheService } from "./CacheService";
import { Redis } from "ioredis";

interface SearchResult {
  civicEngagement: CivicEngagement;
  score: number;
}

interface SearchResults {
  results: SearchResult[];
  nextCursor?: string;
}

export interface CivicEngagementCacheService {
  getCivicEngagement(id: string): Promise<CivicEngagement | null>;
  setCivicEngagement(
    civicEngagement: CivicEngagement,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateCivicEngagement(id: string): Promise<void>;
  getSearchResults(key: string): Promise<SearchResults | null>;
  setSearchResults(
    key: string,
    results: SearchResults,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateSearchResults(key: string): Promise<void>;
  invalidateAllCivicEngagements(): Promise<void>;
  getCacheStats(): {
    civicEngagementHits: number;
    civicEngagementMisses: number;
    searchHits: number;
    searchMisses: number;
    hitRate: number;
  };
}

export class CivicEngagementCacheServiceImpl
  implements CivicEngagementCacheService
{
  private static readonly CACHE_PREFIX = "civic_engagement:";
  private static readonly SEARCH_PREFIX = "civic_search:";
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 300; // 5 minutes

  private cacheService: ReturnType<typeof createCacheService>;
  private cacheStats = {
    civicEngagementHits: 0,
    civicEngagementMisses: 0,
    searchHits: 0,
    searchMisses: 0,
  };

  constructor(cacheService: ReturnType<typeof createCacheService>) {
    this.cacheService = cacheService;
  }

  async getCivicEngagement(id: string): Promise<CivicEngagement | null> {
    try {
      const cached = await this.cacheService.get<CivicEngagement>(
        `${CivicEngagementCacheServiceImpl.CACHE_PREFIX}${id}`,
        { useMemoryCache: true },
      );

      if (cached) {
        this.cacheStats.civicEngagementHits++;
        return cached;
      }

      this.cacheStats.civicEngagementMisses++;
      return null;
    } catch (error) {
      console.error(`Error getting cached civic engagement ${id}:`, error);
      this.cacheStats.civicEngagementMisses++;
      return null;
    }
  }

  async setCivicEngagement(
    civicEngagement: CivicEngagement,
    ttlSeconds: number = CivicEngagementCacheServiceImpl.DEFAULT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${CivicEngagementCacheServiceImpl.CACHE_PREFIX}${civicEngagement.id}`,
      civicEngagement,
      {
        useMemoryCache: true,
        ttlSeconds,
      },
    );
  }

  async invalidateCivicEngagement(id: string): Promise<void> {
    await this.cacheService.invalidate(
      `${CivicEngagementCacheServiceImpl.CACHE_PREFIX}${id}`,
    );
  }

  async getSearchResults(key: string): Promise<SearchResults | null> {
    try {
      const cached = await this.cacheService.get<SearchResults>(
        `${CivicEngagementCacheServiceImpl.SEARCH_PREFIX}${key}`,
        { useMemoryCache: false },
      );

      if (cached) {
        this.cacheStats.searchHits++;
        return cached;
      }

      this.cacheStats.searchMisses++;
      return null;
    } catch (error) {
      console.error(
        `Error getting cached search results for key ${key}:`,
        error,
      );
      this.cacheStats.searchMisses++;
      return null;
    }
  }

  async setSearchResults(
    key: string,
    results: SearchResults,
    ttlSeconds: number = CivicEngagementCacheServiceImpl.SHORT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${CivicEngagementCacheServiceImpl.SEARCH_PREFIX}${key}`,
      results,
      {
        useMemoryCache: false,
        ttlSeconds,
      },
    );
  }

  async invalidateSearchResults(key: string): Promise<void> {
    await this.cacheService.invalidate(
      `${CivicEngagementCacheServiceImpl.SEARCH_PREFIX}${key}`,
    );
  }

  async invalidateAllCivicEngagements(): Promise<void> {
    await this.cacheService.invalidateByPattern(
      `${CivicEngagementCacheServiceImpl.CACHE_PREFIX}*`,
    );
    await this.cacheService.invalidateByPattern(
      `${CivicEngagementCacheServiceImpl.SEARCH_PREFIX}*`,
    );
  }

  getCacheStats() {
    const totalCivicEngagement =
      this.cacheStats.civicEngagementHits +
      this.cacheStats.civicEngagementMisses;
    const totalSearch =
      this.cacheStats.searchHits + this.cacheStats.searchMisses;
    const totalHits =
      this.cacheStats.civicEngagementHits + this.cacheStats.searchHits;
    const totalRequests = totalCivicEngagement + totalSearch;

    return {
      civicEngagementHits: this.cacheStats.civicEngagementHits,
      civicEngagementMisses: this.cacheStats.civicEngagementMisses,
      searchHits: this.cacheStats.searchHits,
      searchMisses: this.cacheStats.searchMisses,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
    };
  }
}

/**
 * Factory function to create a CivicEngagementCacheService instance
 */
export function createCivicEngagementCacheService(
  redis?: Redis,
): CivicEngagementCacheService {
  const cacheService = createCacheService(redis);
  return new CivicEngagementCacheServiceImpl(cacheService);
}
