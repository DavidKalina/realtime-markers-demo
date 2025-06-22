import type { FilteringStrategy } from "../../types/entities";
import type { Event } from "../../types/types";
import { MapMojiFilterService } from "../MapMojiFilterService";
import type { BoundingBox } from "../../types/types";

export class MapMojiFilterStrategy implements FilteringStrategy<Event> {
  readonly entityType = "event";
  private mapMojiService: MapMojiFilterService;
  private stats = {
    totalFiltered: 0,
    totalProcessed: 0,
    averageScore: 0,
  };

  constructor(config?: Record<string, unknown>) {
    this.mapMojiService = new MapMojiFilterService(config);
  }

  async filterEntities(
    entities: Event[],
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: { coordinates: number[] };
      maxResults?: number;
      filters?: Record<string, unknown>;
    },
  ): Promise<Array<Event & { relevanceScore?: number }>> {
    this.stats.totalProcessed += entities.length;

    // Update MapMoji configuration based on context
    this.mapMojiService.updateConfig({
      currentTime: context.currentTime,
      viewportBounds: context.viewport as BoundingBox,
      maxEvents: context.maxResults || 50,
    });

    // Apply MapMoji filtering
    const filteredEvents = await this.mapMojiService.filterEvents(entities);

    this.stats.totalFiltered += filteredEvents.length;

    // Calculate average score
    if (filteredEvents.length > 0) {
      const totalScore = filteredEvents.reduce(
        (sum, event) => sum + (event.relevanceScore || 0),
        0,
      );
      this.stats.averageScore = totalScore / filteredEvents.length;
    }

    return filteredEvents;
  }

  updateConfig(config: Record<string, unknown>): void {
    this.mapMojiService.updateConfig(config);
  }

  getStats(): Record<string, unknown> {
    return {
      ...this.stats,
      strategy: "mapmoji",
      entityType: this.entityType,
    };
  }
}
