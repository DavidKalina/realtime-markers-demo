// src/services/FilterEvaluator.ts

import type { EventFilter, Subscription } from "./types/filters";

/**
 * Evaluates if events match subscription criteria
 */
export class FilterEvaluator {
  /**
   * Check if an event matches a filter
   */
  matchesFilter(event: any, filter: EventFilter): boolean {
    // Category filtering
    if (filter.categories && filter.categories.length > 0) {
      const eventCategories = event.categories?.map((c: any) => c.id) || [];
      if (!filter.categories.some((c) => eventCategories.includes(c))) {
        return false;
      }
    }

    // Date range filtering
    if (filter.dateRange) {
      const eventDate = new Date(event.eventDate);

      if (filter.dateRange.start && eventDate < new Date(filter.dateRange.start)) {
        return false;
      }

      if (filter.dateRange.end && eventDate > new Date(filter.dateRange.end)) {
        return false;
      }
    }

    // Status filtering
    if (filter.status && filter.status.length > 0) {
      if (!filter.status.includes(event.status)) {
        return false;
      }
    }

    // Location filtering
    if (filter.location) {
      if (filter.location.radius && filter.location.center && event.location?.coordinates) {
        const distance = this.calculateDistance(
          { lat: filter.location.center[1], lng: filter.location.center[0] },
          { lat: event.location.coordinates[1], lng: event.location.coordinates[0] }
        );

        if (distance > filter.location.radius) {
          return false;
        }
      } else if (filter.location.boundingBox && event.location?.coordinates) {
        const { minX, minY, maxX, maxY } = filter.location.boundingBox;
        const [lng, lat] = event.location.coordinates;

        if (lng < minX || lng > maxX || lat < minY || lat > maxY) {
          return false;
        }
      }
    }

    // Keyword filtering
    if (filter.keywords && filter.keywords.length > 0) {
      const eventText = `${event.title || ""} ${event.description || ""}`.toLowerCase();
      const hasKeyword = filter.keywords.some((keyword) =>
        eventText.includes(keyword.toLowerCase())
      );

      if (!hasKeyword) {
        return false;
      }
    }

    // Creator filtering
    if (filter.creatorId && event.creatorId !== filter.creatorId) {
      return false;
    }

    // If we passed all filters, it's a match
    return true;
  }

  /**
   * Find all matching subscriptions for an event
   */
  findMatchingSubscriptions(event: any, subscriptions: Map<string, Subscription>): string[] {
    const matchingIds: string[] = [];

    for (const [id, subscription] of subscriptions.entries()) {
      if (this.matchesFilter(event, subscription.filter)) {
        matchingIds.push(id);
      }
    }

    return matchingIds;
  }

  /**
   * Helper method for distance calculation using Haversine formula
   */
  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    // Haversine formula for earth distance
    const R = 6371e3; // Earth radius in meters
    const φ1 = this.toRadians(point1.lat);
    const φ2 = this.toRadians(point2.lat);
    const Δφ = this.toRadians(point2.lat - point1.lat);
    const Δλ = this.toRadians(point2.lng - point1.lng);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

// Create a singleton instance for efficiency
export const filterEvaluator = new FilterEvaluator();
