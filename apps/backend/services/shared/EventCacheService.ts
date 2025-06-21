import { Event } from "../../entities/Event";
import { Category } from "../../entities/Category";
import { createCacheService } from "./CacheService";
import { Redis } from "ioredis";

interface SearchResult {
  event: Event;
  score: number;
}

interface SearchResults {
  results: SearchResult[];
  nextCursor?: string;
}

interface ClusterHubData {
  featuredEvent: Event | null;
  eventsByCategory: { category: Category; events: Event[] }[];
  eventsByLocation: { location: string; events: Event[] }[];
  eventsToday: Event[];
  clusterName: string;
  clusterDescription: string;
  clusterEmoji: string;
  featuredCreator?: {
    id: string;
    displayName: string;
    email: string;
    eventCount: number;
    creatorDescription: string;
    title: string;
    friendCode: string;
  };
}

interface LandingPageData {
  featuredEvents: Event[];
  upcomingEvents: Event[];
  popularCategories: Category[];
}

export interface EventCacheService {
  getEvent(id: string): Promise<Event | null>;
  setEvent(event: Event, ttlSeconds?: number): Promise<void>;
  invalidateEvent(id: string): Promise<void>;
  getSearchResults(key: string): Promise<SearchResults | null>;
  setSearchResults(
    key: string,
    results: SearchResults,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateSearchCache(): Promise<void>;
  getClusterHub(markerIds: string[]): Promise<ClusterHubData | null>;
  setClusterHub(
    markerIds: string[],
    data: ClusterHubData,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateClusterHub(markerIds: string[]): Promise<void>;
  invalidateAllClusterHubs(): Promise<void>;
  getLandingPageData(key: string): Promise<LandingPageData | null>;
  setLandingPageData(
    key: string,
    data: LandingPageData,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateLandingPageCache(): Promise<void>;
  getCachedEmbedding(text: string): number[] | undefined;
  setCachedEmbedding(text: string, embedding: number[]): void;
}

export class EventCacheServiceImpl implements EventCacheService {
  private static readonly CACHE_PREFIX = "event:";
  private static readonly SEARCH_PREFIX = "search:";
  private static readonly CLUSTER_PREFIX = "cluster-hub:";
  private static readonly LANDING_PREFIX = "landing:";
  private static readonly EMBEDDING_PREFIX = "embedding:";
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 300; // 5 minutes
  private cacheService: ReturnType<typeof createCacheService>;
  private memoryCache = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();

  constructor(cacheService: ReturnType<typeof createCacheService>) {
    this.cacheService = cacheService;
  }

  async getEvent(id: string): Promise<Event | null> {
    return this.cacheService.get<Event>(
      `${EventCacheServiceImpl.CACHE_PREFIX}${id}`,
      {
        useMemoryCache: true,
        ttlSeconds: EventCacheServiceImpl.DEFAULT_TTL,
      },
    );
  }

  async setEvent(
    event: Event,
    ttlSeconds: number = EventCacheServiceImpl.DEFAULT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${EventCacheServiceImpl.CACHE_PREFIX}${event.id}`,
      event,
      {
        useMemoryCache: true,
        ttlSeconds,
      },
    );
  }

  async invalidateEvent(id: string): Promise<void> {
    await this.cacheService.invalidate(
      `${EventCacheServiceImpl.CACHE_PREFIX}${id}`,
    );
  }

  async getSearchResults(key: string): Promise<SearchResults | null> {
    return this.cacheService.get(
      `${EventCacheServiceImpl.SEARCH_PREFIX}${key}`,
      {
        useMemoryCache: false,
        ttlSeconds: EventCacheServiceImpl.SHORT_TTL,
      },
    );
  }

  async setSearchResults(
    key: string,
    results: SearchResults,
    ttlSeconds: number = EventCacheServiceImpl.SHORT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${EventCacheServiceImpl.SEARCH_PREFIX}${key}`,
      results,
      {
        useMemoryCache: false,
        ttlSeconds,
      },
    );
  }

  async invalidateSearchCache(): Promise<void> {
    await this.cacheService.invalidateByPattern(
      `${EventCacheServiceImpl.SEARCH_PREFIX}*`,
    );
  }

  async getClusterHub(markerIds: string[]): Promise<ClusterHubData | null> {
    const key = `${EventCacheServiceImpl.CLUSTER_PREFIX}${markerIds.sort().join(",")}`;
    return this.cacheService.get(key, {
      useMemoryCache: false,
      ttlSeconds: EventCacheServiceImpl.SHORT_TTL,
    });
  }

  async setClusterHub(
    markerIds: string[],
    data: ClusterHubData,
    ttlSeconds: number = EventCacheServiceImpl.SHORT_TTL,
  ): Promise<void> {
    const key = `${EventCacheServiceImpl.CLUSTER_PREFIX}${markerIds.sort().join(",")}`;
    await this.cacheService.set(key, data, {
      useMemoryCache: false,
      ttlSeconds,
    });
  }

  async invalidateClusterHub(markerIds: string[]): Promise<void> {
    const key = `${EventCacheServiceImpl.CLUSTER_PREFIX}${markerIds.sort().join(",")}`;
    await this.cacheService.invalidate(key);
  }

  async invalidateAllClusterHubs(): Promise<void> {
    await this.cacheService.invalidateByPattern(
      `${EventCacheServiceImpl.CLUSTER_PREFIX}*`,
    );
  }

  async getLandingPageData(key: string): Promise<LandingPageData | null> {
    return this.cacheService.get(
      `${EventCacheServiceImpl.LANDING_PREFIX}${key}`,
      {
        useMemoryCache: false,
        ttlSeconds: EventCacheServiceImpl.SHORT_TTL,
      },
    );
  }

  async setLandingPageData(
    key: string,
    data: LandingPageData,
    ttlSeconds: number = EventCacheServiceImpl.SHORT_TTL,
  ): Promise<void> {
    await this.cacheService.set(
      `${EventCacheServiceImpl.LANDING_PREFIX}${key}`,
      data,
      {
        useMemoryCache: false,
        ttlSeconds,
      },
    );
  }

  async invalidateLandingPageCache(): Promise<void> {
    await this.cacheService.invalidateByPattern(
      `${EventCacheServiceImpl.LANDING_PREFIX}*`,
    );
  }

  getCachedEmbedding(text: string): number[] | undefined {
    const key = `${EventCacheServiceImpl.EMBEDDING_PREFIX}${text}`;
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as number[];
    }
    return undefined;
  }

  setCachedEmbedding(text: string, embedding: number[]): void {
    const key = `${EventCacheServiceImpl.EMBEDDING_PREFIX}${text}`;
    this.memoryCache.set(key, {
      value: embedding,
      expiresAt: Date.now() + EventCacheServiceImpl.DEFAULT_TTL * 1000,
    });
  }
}

/**
 * Factory function to create an EventCacheService instance
 */
export function createEventCacheService(redis?: Redis): EventCacheService {
  const cacheService = createCacheService(redis);
  return new EventCacheServiceImpl(cacheService);
}
