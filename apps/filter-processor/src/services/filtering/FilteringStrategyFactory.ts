import type { FilteringStrategy } from "../../types/entities";
import { MapMojiFilterStrategy } from "./MapMojiFilterStrategy";

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
      default:
        return [];
    }
  }
}
