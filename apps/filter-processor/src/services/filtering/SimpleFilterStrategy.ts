import type { FilteringStrategy } from "../../types/entities";
import type { CivicEngagement } from "../../types/types";

export class SimpleFilterStrategy
  implements FilteringStrategy<CivicEngagement>
{
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

    let filteredEntities = [...entities];

    // Apply basic viewport filtering
    if (context.viewport) {
      filteredEntities = filteredEntities.filter((entity) =>
        this.isInViewport(entity, context.viewport!),
      );
    }

    // Apply status filtering if specified
    if (context.filters?.status && Array.isArray(context.filters.status)) {
      const allowedStatuses = context.filters.status as string[];
      filteredEntities = filteredEntities.filter((entity) =>
        allowedStatuses.includes(entity.status),
      );
    }

    // Apply type filtering if specified
    if (context.filters?.type && Array.isArray(context.filters.type)) {
      const allowedTypes = context.filters.type as string[];
      filteredEntities = filteredEntities.filter((entity) =>
        allowedTypes.includes(entity.type),
      );
    }

    // Apply date range filtering if specified
    if (context.filters?.dateRange) {
      const dateRange = context.filters.dateRange as {
        start?: string;
        end?: string;
      };

      filteredEntities = filteredEntities.filter((entity) => {
        const createdAt = new Date(entity.createdAt);

        if (dateRange.start) {
          const startDate = new Date(dateRange.start);
          if (createdAt < startDate) return false;
        }

        if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          if (createdAt > endDate) return false;
        }

        return true;
      });
    }

    // Apply distance filtering if user location is provided
    if (context.userLocation && context.filters?.maxDistance) {
      const maxDistance = context.filters.maxDistance as number;
      filteredEntities = filteredEntities.filter((entity) => {
        if (!entity.location) return false;

        const distance = this.calculateDistance(
          context.userLocation!.coordinates,
          entity.location.coordinates,
        );

        return distance <= maxDistance;
      });
    }

    // Sort by creation date (newest first) and apply relevance scoring
    filteredEntities.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    // Apply max results limit
    if (context.maxResults) {
      filteredEntities = filteredEntities.slice(0, context.maxResults);
    }

    // Add simple relevance scores based on recency and status
    const scoredEntities = filteredEntities.map((entity, index) => {
      const relevanceScore = this.calculateSimpleScore(entity, index);
      return {
        ...entity,
        relevanceScore,
      };
    });

    this.stats.totalFiltered += scoredEntities.length;

    // Calculate average score
    if (scoredEntities.length > 0) {
      const totalScore = scoredEntities.reduce(
        (sum, entity) => sum + (entity.relevanceScore || 0),
        0,
      );
      this.stats.averageScore = totalScore / scoredEntities.length;
    }

    return scoredEntities;
  }

  updateConfig(config: Record<string, unknown>): void {
    // Simple strategy doesn't need complex configuration
    console.log("[SimpleFilterStrategy] Config updated:", config);
  }

  getStats(): Record<string, unknown> {
    return {
      ...this.stats,
      strategy: "simple",
      entityType: this.entityType,
    };
  }

  private isInViewport(
    entity: CivicEngagement,
    viewport: { minX: number; minY: number; maxX: number; maxY: number },
  ): boolean {
    if (!entity.location) return false;

    const [lng, lat] = entity.location.coordinates;
    return (
      lat >= viewport.minY &&
      lat <= viewport.maxY &&
      lng >= viewport.minX &&
      lng <= viewport.maxX
    );
  }

  private calculateDistance(point1: number[], point2: number[]): number {
    const [lng1, lat1] = point1;
    const [lng2, lat2] = point2;

    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private calculateSimpleScore(entity: CivicEngagement, index: number): number {
    let score = 0.5; // Base score

    // Status-based scoring
    switch (entity.status) {
      case "IMPLEMENTED":
        score += 0.3;
        break;
      case "APPROVED":
        score += 0.2;
        break;
      case "UNDER_REVIEW":
        score += 0.1;
        break;
      case "PENDING":
        score += 0.05;
        break;
      case "REJECTED":
        score -= 0.2;
        break;
    }

    // Recency bonus (newer items get higher scores)
    const createdAt = new Date(entity.createdAt);
    const now = new Date();
    const daysOld =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysOld <= 1) score += 0.2;
    else if (daysOld <= 7) score += 0.1;
    else if (daysOld <= 30) score += 0.05;

    // Position bonus (earlier in results get slightly higher scores)
    const positionBonus = Math.max(0, (100 - index) / 100) * 0.1;
    score += positionBonus;

    return Math.max(0, Math.min(1, score)); // Clamp to 0-1
  }
}
