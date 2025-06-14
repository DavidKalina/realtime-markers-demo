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

export interface UserFilterService {
  fetchUserFiltersAndPublish: (userId: string) => Promise<void>;
  publishEmptyFilter: (userId: string) => Promise<void>;
}

export interface UserFilterServiceDependencies {
  redisService: RedisService;
  backendUrl: string;
}

export function createUserFilterService(
  dependencies: UserFilterServiceDependencies,
): UserFilterService {
  return {
    async fetchUserFiltersAndPublish(userId: string): Promise<void> {
      try {
        console.log(`🔍 Fetching filters for user ${userId}`);

        const response = await fetch(
          `${dependencies.backendUrl}/api/internal/filters?userId=${userId}`,
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

        console.log("FILTERS", filters);
        console.log(`📊 Fetched ${filters.length} filters for user ${userId}`);

        // Get only active filters
        const activeFilters = filters.filter((filter) => filter.isActive);
        console.log(
          `📊 User ${userId} has ${activeFilters.length} active filters`,
        );

        // Publish to filter-changes
        await dependencies.redisService.publish(
          "filter-changes",
          JSON.stringify({
            userId,
            filters: activeFilters,
            timestamp: new Date().toISOString(),
          }),
        );

        console.log(
          `📤 Published filter update for user ${userId} with ${activeFilters.length} active filters`,
        );
      } catch (error) {
        console.error(`Error fetching filters for user ${userId}:`, error);
        await this.publishEmptyFilter(userId);
      }
    },

    async publishEmptyFilter(userId: string): Promise<void> {
      console.log(
        `📤 Publishing default empty filter for user ${userId} (will match all events)`,
      );

      await dependencies.redisService.publish(
        "filter-changes",
        JSON.stringify({
          userId,
          filters: [], // Empty array means "match all events"
          timestamp: new Date().toISOString(),
        }),
      );
    },
  };
}
