import type { EntityProcessor } from "../../types/entities";
import type { CivicEngagement } from "../../types/types";
import { CivicEngagementStatus } from "../../types/types";
import type { Point } from "geojson";
import { UnifiedSpatialCacheService } from "../UnifiedSpatialCacheService";

export class CivicEngagementProcessor
  implements EntityProcessor<CivicEngagement>
{
  readonly entityType = "civic_engagement";
  private eventCacheService: UnifiedSpatialCacheService;

  constructor(eventCacheService: UnifiedSpatialCacheService) {
    this.eventCacheService = eventCacheService;
  }

  async processEntity(
    operation: string,
    entity: CivicEngagement,
  ): Promise<void> {
    console.log(
      `[CivicEngagementProcessor] Processing ${operation} for civic engagement ${entity.id}`,
    );

    // Update cache and spatial index based on operation
    switch (operation.toUpperCase()) {
      case "CREATE":
      case "INSERT":
        this.eventCacheService.addCivicEngagement(entity);
        break;
      case "UPDATE":
        this.eventCacheService.updateCivicEngagement(entity);
        break;
      case "DELETE":
        this.eventCacheService.removeCivicEngagement(entity.id);
        break;
    }
  }

  validateEntity(entity: CivicEngagement): boolean {
    return !!(
      entity.id &&
      entity.title &&
      entity.type &&
      entity.status &&
      entity.creatorId &&
      entity.createdAt
    );
  }

  normalizeEntity(data: unknown): CivicEngagement {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid civic engagement data");
    }

    const civicEngagement = data as CivicEngagement;

    // Ensure required fields are present
    if (
      !civicEngagement.id ||
      !civicEngagement.title ||
      !civicEngagement.type ||
      !civicEngagement.status
    ) {
      throw new Error("Missing required civic engagement fields");
    }

    return civicEngagement;
  }

  getSpatialBounds(
    entity: CivicEngagement,
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
    entity: CivicEngagement,
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
    entity: CivicEngagement,
    context: {
      viewport?: { minX: number; minY: number; maxX: number; maxY: number };
      currentTime: Date;
      userLocation?: Point;
    },
  ): number {
    let score = 0;

    // Status-based scoring
    switch (entity.status) {
      case CivicEngagementStatus.IMPLEMENTED:
        score += 15; // High relevance for implemented items
        break;
      case CivicEngagementStatus.APPROVED:
        score += 10; // Medium relevance for approved items
        break;
      case CivicEngagementStatus.UNDER_REVIEW:
        score += 5; // Lower relevance for items under review
        break;
      case CivicEngagementStatus.PENDING:
        score += 3; // Lowest relevance for pending items
        break;
      case CivicEngagementStatus.REJECTED:
        score += 1; // Minimal relevance for rejected items
        break;
    }

    // Time-based scoring (newer items get higher scores)
    const createdAt = new Date(entity.createdAt);
    const timeDiff = context.currentTime.getTime() - createdAt.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff <= 7) score += 10;
    else if (daysDiff <= 30) score += 5;
    else if (daysDiff <= 90) score += 2;

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

    // Type-based scoring
    switch (entity.type) {
      case "IDEA":
        score += 5; // Ideas are generally more interesting
        break;
      case "POSITIVE_FEEDBACK":
        score += 3; // Positive feedback is good to see
        break;
      case "NEGATIVE_FEEDBACK":
        score += 4; // Negative feedback might need attention
        break;
    }

    return Math.min(score, 100); // Cap at 100
  }

  isAccessible(entity: CivicEngagement, userId: string): boolean {
    // Civic engagements are generally public, but creator gets special access
    if (entity.creatorId === userId) {
      return true;
    }

    // For now, all civic engagements are public
    // In the future, you might want to add privacy controls
    return true;
  }

  formatForWebSocket(
    entity: CivicEngagement,
    operation: string,
  ): Record<string, unknown> {
    // For DELETE operations, we only need the entity ID
    if (operation.toUpperCase() === "DELETE") {
      return {
        type: "civic_engagement",
        operation,
        data: {
          id: entity.id,
        },
      };
    }

    // For CREATE and UPDATE operations, send full entity data
    return {
      type: "civic_engagement",
      operation,
      data: {
        id: entity.id,
        title: entity.title,
        description: entity.description,
        type: entity.type,
        status: entity.status,
        location: entity.location,
        address: entity.address,
        locationNotes: entity.locationNotes,
        imageUrls: entity.imageUrls,
        creatorId: entity.creatorId,
        adminNotes: entity.adminNotes,
        implementedAt: entity.implementedAt,
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
