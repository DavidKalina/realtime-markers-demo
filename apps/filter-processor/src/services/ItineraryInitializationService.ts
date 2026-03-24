import { CommunityItinerary } from "../types/types";
import { UnifiedSpatialCacheService } from "./UnifiedSpatialCacheService";

export interface ItineraryInitializationServiceConfig {
  backendUrl?: string;
  pageSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class ItineraryInitializationService {
  readonly entityType = "itinerary";
  private spatialCache: UnifiedSpatialCacheService;
  private backendUrl: string;
  private pageSize: number;
  private maxRetries: number;
  private retryDelay: number;

  private stats = {
    itinerariesFetched: 0,
    itinerariesProcessed: 0,
    apiCalls: 0,
    apiErrors: 0,
    retries: 0,
    lastInitializationTime: 0,
  };

  constructor(
    spatialCache: UnifiedSpatialCacheService,
    config: ItineraryInitializationServiceConfig = {},
  ) {
    this.spatialCache = spatialCache;
    this.backendUrl =
      config.backendUrl || process.env.BACKEND_URL || "http://backend:3000";
    this.pageSize = config.pageSize || 100;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  async initializeEntities(): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 [ItineraryInit] Starting itinerary initialization (attempt ${attempt}/${maxRetries})...`,
        );

        const itineraries = await this.fetchAllItineraries();

        console.log(
          `📊 [ItineraryInit] Received ${itineraries.length} itineraries for initialization`,
        );

        if (itineraries.length === 0) {
          console.warn(
            "⚠️ [ItineraryInit] No published itineraries found",
          );
          return;
        }

        this.processItinerariesBatch(itineraries);
        this.stats.lastInitializationTime = Date.now();

        console.log(
          "✅ [ItineraryInit] Itinerary initialization complete",
        );
        return;
      } catch (error) {
        console.error(
          `❌ [ItineraryInit] Error initializing itineraries (attempt ${attempt}/${maxRetries}):`,
          error,
        );

        if (attempt === maxRetries) {
          console.error(
            "💥 [ItineraryInit] Max retries reached, giving up",
          );
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ [ItineraryInit] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  getStats(): Record<string, unknown> {
    return {
      entityType: this.entityType,
      ...this.stats,
      backendUrl: this.backendUrl,
      pageSize: this.pageSize,
    };
  }

  private async fetchAllItineraries(): Promise<CommunityItinerary[]> {
    let currentPage = 1;
    let hasMorePages = true;
    const allItineraries: CommunityItinerary[] = [];
    const seenIds = new Set<string>();

    while (hasMorePages) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const url = `${this.backendUrl}/api/internal/itineraries?page=${currentPage}&pageSize=${this.pageSize}`;
          console.log(
            `📡 [ItineraryInit] Fetching page ${currentPage}: ${url}`,
          );

          const response = await fetch(url, {
            headers: { Accept: "application/json" },
          });

          if (!response.ok) {
            throw new Error(
              `HTTP error! status: ${response.status} - ${response.statusText}`,
            );
          }

          const data = await response.json();

          if (!data || !Array.isArray(data.itineraries)) {
            throw new Error("Invalid response format from backend");
          }

          const { itineraries, pagination } = data;

          // Filter to only itineraries with valid entry coordinates
          const validItineraries = itineraries.filter(
            (it: CommunityItinerary) => {
              if (it.entryLatitude == null || it.entryLongitude == null) {
                return false;
              }
              if (seenIds.has(it.id)) return false;
              seenIds.add(it.id);
              return true;
            },
          );

          allItineraries.push(...validItineraries);

          console.log(
            `📄 [ItineraryInit] Page ${currentPage}: ${validItineraries.length} valid itineraries (${allItineraries.length} total)`,
          );

          this.stats.apiCalls++;
          this.stats.itinerariesFetched += validItineraries.length;

          hasMorePages = pagination?.hasMore ?? false;
          currentPage++;
          break; // Success
        } catch (error) {
          console.error(
            `❌ [ItineraryInit] Attempt ${attempt}/${this.maxRetries} failed for page ${currentPage}:`,
            error,
          );

          if (attempt === this.maxRetries) {
            hasMorePages = false;
            break;
          }

          this.stats.retries++;
          this.stats.apiErrors++;

          const retryDelay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    console.log(
      `🎯 [ItineraryInit] Total itineraries fetched: ${allItineraries.length}`,
    );
    return allItineraries;
  }

  private processItinerariesBatch(
    itineraries: CommunityItinerary[],
  ): void {
    for (const itinerary of itineraries) {
      try {
        this.spatialCache.addItinerary(itinerary);
        this.stats.itinerariesProcessed++;
      } catch (error) {
        console.error(
          `❌ [ItineraryInit] Error processing itinerary ${itinerary.id}:`,
          error,
        );
      }
    }

    console.log(
      `🎯 [ItineraryInit] Processed ${this.stats.itinerariesProcessed} itineraries`,
    );
  }
}

export function createItineraryInitializationService(
  spatialCache: UnifiedSpatialCacheService,
  config: ItineraryInitializationServiceConfig = {},
): ItineraryInitializationService {
  return new ItineraryInitializationService(spatialCache, config);
}
