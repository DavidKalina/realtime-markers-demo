import type { EntityProcessor } from "../../types/entities";
import type { Event } from "../../types/types";
import type { Point } from "geojson";
import { UnifiedSpatialCacheService } from "../UnifiedSpatialCacheService";

export class EventProcessor implements EntityProcessor {
  readonly entityType = "event";
  private eventCacheService: UnifiedSpatialCacheService;

  constructor(eventCacheService: UnifiedSpatialCacheService) {
    this.eventCacheService = eventCacheService;
  }

  async processEntity(operation: string, entity: Event): Promise<void> {
    console.log(
      `[EventProcessor] Processing ${operation} for event ${entity.id}`,
    );

    // Update cache and spatial index based on operation
    switch (operation.toUpperCase()) {
      case "CREATE":
      case "INSERT":
        this.eventCacheService.addEvent(entity);
        break;
      case "UPDATE":
        this.eventCacheService.updateEvent(entity);
        break;
      case "DELETE":
        this.eventCacheService.removeEvent(entity.id);
        break;
    }
  }

  validateEntity(entity: Event): boolean {
    return !!(
      entity.id &&
      entity.title &&
      entity.location &&
      entity.creatorId &&
      entity.createdAt
    );
  }

  normalizeEntity(data: unknown): Event {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid event data");
    }

    const event = data as Event;

    // Ensure required fields are present
    if (!event.id || !event.title || !event.location || !event.creatorId) {
      throw new Error("Missing required event fields");
    }

    return event;
  }

  getSpatialBounds(
    entity: Event,
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (!entity.location?.coordinates) {
      return null;
    }

    const [lng, lat] = entity.location.coordinates;
    return {
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
    };
  }

  isInViewport(
    entity: Event,
    viewport: { minX: number; minY: number; maxX: number; maxY: number },
  ): boolean {
    const bounds = this.getSpatialBounds(entity);
    if (!bounds) {
      return false;
    }

    return (
      bounds.minX >= viewport.minX &&
      bounds.minY >= viewport.minY &&
      bounds.maxX <= viewport.maxX &&
      bounds.maxY <= viewport.maxY
    );
  }

  calculateRelevanceScore(
    entity: Event,
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: Point;
    },
  ): number {
    let score = 0;

    // Time-based scoring
    const eventDate = new Date(entity.eventDate);
    const timeDiff = Math.abs(
      context.currentTime.getTime() - eventDate.getTime(),
    );
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff <= 1) score += 10;
    else if (daysDiff <= 7) score += 5;
    else if (daysDiff <= 30) score += 2;

    // Distance-based scoring
    if (context.userLocation && entity.location) {
      const distance = this.calculateDistance(
        context.userLocation.coordinates,
        entity.location.coordinates,
      );

      if (distance <= 1)
        score += 10; // Within 1km
      else if (distance <= 5)
        score += 5; // Within 5km
      else if (distance <= 10) score += 2; // Within 10km
    }

    // Popularity-based scoring
    score += (entity.scanCount || 0) * 0.1;
    score += (entity.saveCount || 0) * 0.2;

    return Math.min(score, 100); // Cap at 100
  }

  isAccessible(entity: Event, userId: string): boolean {
    // Public events are accessible to everyone
    if (!entity.isPrivate) {
      return true;
    }

    // Private events are only accessible to creator and shared users
    if (entity.creatorId === userId) {
      return true;
    }

    // Check if user is in shared list
    return (
      entity.sharedWith?.some((share) => share.sharedWithId === userId) ?? false
    );
  }

  formatForWebSocket(
    entity: Event,
    operation: string,
  ): Record<string, unknown> {
    // For DELETE operations, we only need the entity ID
    if (operation.toUpperCase() === "DELETE") {
      return {
        type: "event",
        operation,
        data: {
          id: entity.id,
        },
      };
    }

    // For CREATE and UPDATE operations, send full entity data
    return {
      type: "event",
      operation,
      data: {
        id: entity.id,
        title: entity.title,
        eventDate: entity.eventDate,
        location: entity.location,
        creatorId: entity.creatorId,
        isPrivate: entity.isPrivate,
        scanCount: entity.scanCount,
        saveCount: entity.saveCount,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
    };
  }

  private calculateDistance(coord1: number[], coord2: number[]): number {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;

    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
