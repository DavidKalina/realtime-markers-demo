import type { FilteringStrategy } from "../../types/entities";
import { MapMojiFilterStrategy } from "./MapMojiFilterStrategy";
import { SimpleFilterStrategy } from "./SimpleFilterStrategy";
import { NoFilterStrategy } from "./NoFilterStrategy";

export class FilteringStrategyFactory {
  /**
   * Create a filtering strategy for the given entity type and strategy name
   */
  static createStrategy<T = unknown>(
    entityType: string,
    strategyName: string,
    config?: Record<string, unknown>,
  ): FilteringStrategy<T> {
    switch (strategyName.toLowerCase()) {
      case "mapmoji":
        if (entityType === "event") {
          return new MapMojiFilterStrategy(
            config,
          ) as unknown as FilteringStrategy<T>;
        }
        throw new Error(
          `MapMoji strategy is only supported for events, not ${entityType}`,
        );

      case "simple":
        if (entityType === "civic_engagement") {
          return new SimpleFilterStrategy() as unknown as FilteringStrategy<T>;
        }
        throw new Error(
          `Simple strategy is only supported for civic_engagement, not ${entityType}`,
        );

      case "none":
      case "nofilter":
        if (entityType === "civic_engagement") {
          return new NoFilterStrategy() as unknown as FilteringStrategy<T>;
        }
        throw new Error(
          `No-filter strategy is only supported for civic_engagement, not ${entityType}`,
        );

      default:
        throw new Error(
          `Unknown filtering strategy: ${strategyName} for entity type: ${entityType}`,
        );
    }
  }

  /**
   * Get the default strategy for an entity type
   */
  static getDefaultStrategy(entityType: string): string {
    switch (entityType) {
      case "event":
        return "mapmoji";
      case "civic_engagement":
        return "simple";
      default:
        throw new Error(`No default strategy for entity type: ${entityType}`);
    }
  }

  /**
   * Get all available strategies for an entity type
   */
  static getAvailableStrategies(entityType: string): string[] {
    switch (entityType) {
      case "event":
        return ["mapmoji"];
      case "civic_engagement":
        return ["simple", "none"];
      default:
        return [];
    }
  }
}
