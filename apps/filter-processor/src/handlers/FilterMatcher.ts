import { Event, Filter } from "../types/types";
import { VectorService } from "../services/VectorService";

export class FilterMatcher {
  private vectorService: VectorService;

  constructor(vectorService: VectorService) {
    this.vectorService = vectorService;
  }

  public eventMatchesFilters(
    event: Event,
    filters: Filter[],
    userId?: string,
  ): boolean {
    // If no filters, match everything
    if (filters.length === 0) return true;

    // First check privacy if userId is provided
    if (userId && !this.isEventAccessible(event, userId)) {
      return false;
    }

    // Event matches if it satisfies ANY filter
    return filters.some((filter) => this.matchesSingleFilter(event, filter));
  }

  private matchesSingleFilter(event: Event, filter: Filter): boolean {
    const criteria = filter.criteria;

    // 1. Apply location filter if specified
    if (
      criteria.location?.latitude &&
      criteria.location?.longitude &&
      criteria.location?.radius &&
      !this.matchesLocationFilter(event, criteria.location)
    ) {
      return false;
    }

    // 2. Apply date range filter if specified
    if (
      criteria.dateRange?.start &&
      criteria.dateRange?.end &&
      !this.matchesDateFilter(event, {
        start: criteria.dateRange.start,
        end: criteria.dateRange.end,
      })
    ) {
      return false;
    }

    // If we only have date criteria and no other criteria, return true if we got this far
    if (criteria.dateRange && !criteria.location && !filter.embedding) {
      return true;
    }

    // 3. Apply semantic filter if specified
    if (filter.embedding && event.embedding) {
      const semanticScore = this.calculateSemanticScore(event, filter);
      if (semanticScore < this.getSemanticThreshold(criteria)) {
        return false;
      }
    }

    return true;
  }

  private matchesLocationFilter(
    event: Event,
    location: { latitude: number; longitude: number; radius: number },
  ): boolean {
    const [eventLng, eventLat] = event.location.coordinates;
    const distance = this.calculateDistance(
      eventLat,
      eventLng,
      location.latitude,
      location.longitude,
    );

    if (distance > location.radius) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Location Filter Rejection: Event ${event.id} is ${distance.toFixed(
            0,
          )}m from filter center (radius: ${location.radius}m)`,
        );
      }
      return false;
    }

    return true;
  }

  private matchesDateFilter(
    event: Event,
    dateRange: { start: string; end: string },
  ): boolean {
    try {
      const { start, end } = dateRange;
      const eventTimezone = event.timezone || "UTC";

      // Normalize filter dates to cover the full day in the event's timezone
      const filterStartDate = new Date(start + "T00:00:00.000Z");
      const filterEndDate = new Date(end + "T23:59:59.999Z");

      // Parse event dates
      const eventStartDate = new Date(event.eventDate);
      const eventEndDate = event.endDate
        ? new Date(event.endDate)
        : eventStartDate;

      // Convert to event's timezone
      const eventStartInTimezone = new Date(
        eventStartDate.toLocaleString("en-US", { timeZone: eventTimezone }),
      );
      const eventEndInTimezone = new Date(
        eventEndDate.toLocaleString("en-US", { timeZone: eventTimezone }),
      );
      const filterStartInTimezone = new Date(
        filterStartDate.toLocaleString("en-US", { timeZone: eventTimezone }),
      );
      const filterEndInTimezone = new Date(
        filterEndDate.toLocaleString("en-US", { timeZone: eventTimezone }),
      );

      // Check if event overlaps with filter date range
      return (
        eventStartInTimezone <= filterEndInTimezone &&
        eventEndInTimezone >= filterStartInTimezone
      );
    } catch (error) {
      console.error("Error parsing dates:", error);
      return false;
    }
  }

  private calculateSemanticScore(event: Event, filter: Filter): number {
    try {
      const filterEmbedding = this.vectorService.parseSqlEmbedding(
        filter.embedding,
      );
      const eventEmbedding = this.vectorService.parseSqlEmbedding(
        event.embedding,
      );
      const semanticQuery = filter.semanticQuery?.toLowerCase() || "";

      let compositeScore = 0;
      let totalWeight = 0;

      // Base semantic similarity
      const similarityScore = this.vectorService.calculateSimilarity(
        filterEmbedding,
        eventEmbedding,
      );
      compositeScore += similarityScore * 0.5;
      totalWeight += 0.5;

      // Text matching
      if (filter.semanticQuery) {
        // Title match
        if (event.title.toLowerCase().includes(semanticQuery)) {
          compositeScore += 0.6;
          totalWeight += 0.15;
        }

        // Category matching
        if (event.categories?.length) {
          const categoryMatches = event.categories.filter((cat) =>
            cat.name.toLowerCase().includes(semanticQuery),
          );
          if (categoryMatches.length > 0) {
            compositeScore += 0.8;
            totalWeight += 0.2;
          }
        }

        // Description match
        if (event.description?.toLowerCase().includes(semanticQuery)) {
          compositeScore += 0.7;
          totalWeight += 0.15;
        }

        // Location matches
        if (event.address?.toLowerCase().includes(semanticQuery)) {
          compositeScore += 0.5;
          totalWeight += 0.1;
        }
        if (event.locationNotes?.toLowerCase().includes(semanticQuery)) {
          compositeScore += 0.6;
          totalWeight += 0.1;
        }
      }

      return totalWeight > 0 ? compositeScore / totalWeight : 0;
    } catch (error) {
      console.error("Error calculating semantic similarity:", error);
      return 0;
    }
  }

  private getSemanticThreshold(criteria: Filter["criteria"]): number {
    // Keep threshold low to ensure we catch relevant matches
    let threshold = 0.31;

    // Only slightly lower threshold when combining with other filters
    if (criteria.location || criteria.dateRange) {
      threshold = 0.25;
    }

    return threshold;
  }

  public isEventAccessible(event: Event, userId: string): boolean {
    // Public events are always accessible
    if (!event.isPrivate) return true;

    // Private events are accessible to creator and shared users
    return (
      event.creatorId === userId ||
      (event.sharedWith?.some((share) => share.sharedWithId === userId) ??
        false)
    );
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
