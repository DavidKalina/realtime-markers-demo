import type { EntityRegistry } from "../types/entities";
import type { Point } from "geojson";

export interface UnifiedFilteringService {
  filterEntities(
    entityType: string,
    entities: unknown[],
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: Point;
      maxResults?: number;
      filters?: Record<string, unknown>;
    },
  ): Promise<Array<unknown & { relevanceScore?: number }>>;

  getFilteringStats(): Record<string, unknown>;
}

export function createUnifiedFilteringService(
  entityRegistry: EntityRegistry,
): UnifiedFilteringService {
  const stats = {
    totalRequests: 0,
    requestsByEntityType: {} as Record<string, number>,
    requestsByStrategy: {} as Record<string, number>,
  };

  async function filterEntities(
    entityType: string,
    entities: unknown[],
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: Point;
      maxResults?: number;
      filters?: Record<string, unknown>;
    },
  ): Promise<Array<unknown & { relevanceScore?: number }>> {
    stats.totalRequests++;
    stats.requestsByEntityType[entityType] =
      (stats.requestsByEntityType[entityType] || 0) + 1;

    const filteringStrategy = entityRegistry.getFilteringStrategy(entityType);
    if (!filteringStrategy) {
      console.warn(
        `[UnifiedFilteringService] No filtering strategy found for entity type: ${entityType}`,
      );
      // Return entities with default scores
      return entities.map((entity) =>
        Object.assign({}, entity, { relevanceScore: 0.5 }),
      );
    }

    const strategyName =
      entityRegistry.getEntityType(entityType)?.filtering.strategy || "unknown";
    stats.requestsByStrategy[strategyName] =
      (stats.requestsByStrategy[strategyName] || 0) + 1;

    console.log(
      `[UnifiedFilteringService] Filtering ${entities.length} ${entityType} entities using ${strategyName} strategy`,
    );

    try {
      const filteredEntities = await filteringStrategy.filterEntities(
        entities,
        context,
      );

      console.log(
        `[UnifiedFilteringService] Filtered ${entities.length} ${entityType} entities to ${filteredEntities.length} results`,
      );

      return filteredEntities;
    } catch (error) {
      console.error(
        `[UnifiedFilteringService] Error filtering ${entityType} entities:`,
        error,
      );
      // Return entities with default scores on error
      return entities.map((entity) =>
        Object.assign({}, entity, { relevanceScore: 0.5 }),
      );
    }
  }

  function getFilteringStats(): Record<string, unknown> {
    return {
      ...stats,
      strategies: Object.fromEntries(
        entityRegistry
          .getAllFilteringStrategies()
          .map((strategy) => [strategy.entityType, strategy.getStats()]),
      ),
    };
  }

  return {
    filterEntities,
    getFilteringStats,
  };
}
