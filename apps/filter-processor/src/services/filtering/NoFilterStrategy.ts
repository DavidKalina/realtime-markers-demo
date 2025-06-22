import type { FilteringStrategy } from "../../types/entities";
import type { CivicEngagement } from "../../types/types";

export class NoFilterStrategy implements FilteringStrategy<CivicEngagement> {
  readonly entityType = "civic_engagement";
  private stats = {
    totalFiltered: 0,
    totalProcessed: 0,
    averageScore: 0,
  };

  async filterEntities(
    entities: CivicEngagement[],
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: { coordinates: number[] };
      maxResults?: number;
      filters?: Record<string, unknown>;
    },
  ): Promise<Array<CivicEngagement & { relevanceScore?: number }>> {
    this.stats.totalProcessed += entities.length;

    // No filtering - return all entities with default scores
    let scoredEntities = entities.map((entity) => ({
      ...entity,
      relevanceScore: 0.5, // Default neutral score
    }));

    // Apply max results limit if specified
    if (context.maxResults) {
      scoredEntities = scoredEntities.slice(0, context.maxResults);
    }

    this.stats.totalFiltered += scoredEntities.length;
    this.stats.averageScore = 0.5; // Always 0.5 for no-filter strategy

    return scoredEntities;
  }

  updateConfig(config: Record<string, unknown>): void {
    // No-filter strategy ignores configuration
    console.log("[NoFilterStrategy] Config ignored:", config);
  }

  getStats(): Record<string, unknown> {
    return {
      ...this.stats,
      strategy: "none",
      entityType: this.entityType,
    };
  }
}
