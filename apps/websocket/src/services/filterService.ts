import type { RedisService } from "./redisService";

export interface Filter {
  isActive: boolean;
  [key: string]: unknown;
}

export interface FilterUpdate {
  userId: string;
  filters: Filter[];
  timestamp: string;
}

export class FilterService {
  private redisService: RedisService;
  private backendUrl: string;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.backendUrl = process.env.BACKEND_URL || "http://backend:3000";
  }

  /**
   * Fetches user filters from backend and publishes them to Redis
   */
  async fetchAndPublishFilters(userId: string): Promise<void> {
    try {
      console.log(`🔍 Fetching filters for user ${userId}`);

      const response = await fetch(
        `${this.backendUrl}/api/internal/filters?userId=${userId}`,
        {
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        console.error(
          `Failed to fetch filters for user ${userId}: ${response.status} ${response.statusText}`,
        );
        await this.publishEmptyFilter(userId);
        return;
      }

      const filters = (await response.json()) as Filter[];
      const activeFilters = filters.filter((filter) => filter.isActive);

      await this.publishFilterUpdate(userId, activeFilters);

      console.log(
        `📤 Published filter update for user ${userId} with ${activeFilters.length} active filters`,
      );
    } catch (error) {
      console.error(`Error fetching filters for user ${userId}:`, error);
      await this.publishEmptyFilter(userId);
    }
  }

  /**
   * Publishes an empty filter set (matches all events)
   */
  async publishEmptyFilter(userId: string): Promise<void> {
    console.log(
      `📤 Publishing default empty filter for user ${userId} (will match all events)`,
    );
    await this.publishFilterUpdate(userId, []);
  }

  /**
   * Publishes a filter update to Redis
   */
  private async publishFilterUpdate(
    userId: string,
    filters: Filter[],
  ): Promise<void> {
    const filterUpdate: FilterUpdate = {
      userId,
      filters,
      timestamp: new Date().toISOString(),
    };

    await this.redisService.publish(
      "filter-changes",
      JSON.stringify(filterUpdate),
    );
  }
}
