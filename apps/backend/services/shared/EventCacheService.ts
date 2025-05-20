import { Event } from "../../entities/Event";
import { Category } from "../../entities/Category";
import { CacheService } from "./CacheService";

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

export class EventCacheService extends CacheService {
  private static readonly CACHE_PREFIX = "event:";
  private static readonly SEARCH_PREFIX = "search:";
  private static readonly CLUSTER_PREFIX = "cluster-hub:";
  private static readonly EMBEDDING_PREFIX = "embedding:";
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 300; // 5 minutes

  static async getEvent(id: string): Promise<Event | null> {
    return this.get<Event>(`${this.CACHE_PREFIX}${id}`, {
      useMemoryCache: true,
      ttlSeconds: this.DEFAULT_TTL,
    });
  }

  static async setEvent(
    event: Event,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<void> {
    await this.set(`${this.CACHE_PREFIX}${event.id}`, event, {
      useMemoryCache: true,
      ttlSeconds,
    });
  }

  static async invalidateEvent(id: string): Promise<void> {
    await this.invalidate(`${this.CACHE_PREFIX}${id}`);
  }

  static async getSearchResults(key: string): Promise<SearchResults | null> {
    return this.get(`${this.SEARCH_PREFIX}${key}`, {
      useMemoryCache: false,
      ttlSeconds: this.SHORT_TTL,
    });
  }

  static async setSearchResults(
    key: string,
    results: SearchResults,
    ttlSeconds: number = this.SHORT_TTL,
  ): Promise<void> {
    await this.set(`${this.SEARCH_PREFIX}${key}`, results, {
      useMemoryCache: false,
      ttlSeconds,
    });
  }

  static async invalidateSearchCache(): Promise<void> {
    await this.invalidateByPattern(`${this.SEARCH_PREFIX}*`);
  }

  static async getClusterHub(
    markerIds: string[],
  ): Promise<ClusterHubData | null> {
    const key = `${this.CLUSTER_PREFIX}${markerIds.sort().join(",")}`;
    return this.get(key, {
      useMemoryCache: false,
      ttlSeconds: this.SHORT_TTL,
    });
  }

  static async setClusterHub(
    markerIds: string[],
    data: ClusterHubData,
    ttlSeconds: number = this.SHORT_TTL,
  ): Promise<void> {
    const key = `${this.CLUSTER_PREFIX}${markerIds.sort().join(",")}`;
    await this.set(key, data, {
      useMemoryCache: false,
      ttlSeconds,
    });
  }

  static async invalidateClusterHub(markerIds: string[]): Promise<void> {
    const key = `${this.CLUSTER_PREFIX}${markerIds.sort().join(",")}`;
    await this.invalidate(key);
  }

  static async invalidateAllClusterHubs(): Promise<void> {
    await this.invalidateByPattern(`${this.CLUSTER_PREFIX}*`);
  }

  static getCachedEmbedding(text: string): number[] | undefined {
    const key = `${this.EMBEDDING_PREFIX}${text}`;
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as number[];
    }
    return undefined;
  }

  static setCachedEmbedding(text: string, embedding: number[]): void {
    const key = `${this.EMBEDDING_PREFIX}${text}`;
    this.memoryCache.set(key, {
      value: embedding,
      expiresAt: Date.now() + this.DEFAULT_TTL * 1000,
    });
  }
}
