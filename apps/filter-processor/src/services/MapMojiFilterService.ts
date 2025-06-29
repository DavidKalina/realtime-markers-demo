import { Event, BoundingBox, RecurrenceFrequency } from "../types/types";

interface FilterConfig {
  maxEvents: number;
  viewportBounds: BoundingBox;

  currentTime: Date;
  weights: {
    timeProximity: number; // 0.60 - how soon the event is (increased from 0.35)
    recency: number; // 0.40 - how recently discovered/created (increased from 0.15)
  };
  timeDecayHours: number; // 72 - events lose relevance after X hours
  maxDistanceKm: number; // 50 - maximum relevant distance
  clusteringEnabled: boolean; // true - prevent overcrowding
  minClusterDistance: number; // 0.5 - minimum km between events
}

interface EventScore {
  event: Event;
  rawScore: number; // Original calculated score
  relativeScore: number; // Normalized score relative to other events
  percentileRank: number; // 0-1 ranking within the current set
  components: {
    timeScore: number;
    popularityScore: number;
    recencyScore: number;
    confidenceScore: number;
  };
}

export class MapMojiFilterService {
  private config: FilterConfig;

  constructor(config?: Partial<FilterConfig>) {
    // Default configuration
    this.config = {
      maxEvents: 50,
      viewportBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      currentTime: new Date(),
      weights: {
        timeProximity: 0.6,
        recency: 0.4,
      },
      timeDecayHours: 72,
      maxDistanceKm: 50,
      clusteringEnabled: true,
      minClusterDistance: 0.5,
      ...config,
    };
  }

  /**
   * Apply MapMoji filtering algorithm to a set of events
   */
  async filterEvents(
    events: Event[],
  ): Promise<Array<Event & { relevanceScore?: number }>> {
    if (process.env.NODE_ENV !== "production") {
      console.log("[MapMoji] Starting filter algorithm:", {
        totalEvents: events.length,
        viewportBounds: this.config.viewportBounds,
        maxEvents: this.config.maxEvents,
        currentTime: this.config.currentTime,
      });
    }

    // Step 1: Pre-filter by basic criteria
    const preFiltered = this.preFilter(events);

    if (process.env.NODE_ENV !== "production") {
      console.log("[MapMoji] Pre-filtering complete:", {
        originalCount: events.length,
        preFilteredCount: preFiltered.length,
        removedCount: events.length - preFiltered.length,
      });
    }

    // Step 2: For civic engagement, show all events when there are few
    const sparseEventThreshold = 20; // Show all events if 10 or fewer
    if (preFiltered.length <= sparseEventThreshold) {
      console.log(
        "[MapMoji] Sparse events detected - showing all events for civic engagement:",
        {
          eventCount: preFiltered.length,
          threshold: sparseEventThreshold,
        },
      );

      return preFiltered.map((event) => ({
        ...event,
        relevanceScore: 1.0, // Give all events maximum relevance in sparse scenarios
      }));
    }

    // Step 3: Only apply scoring when we have many events
    const scoredEvents = preFiltered.map((event) => this.scoreEvent(event));

    // Step 4: Apply relative scoring normalization
    const normalizedEvents = this.applyRelativeScoring(scoredEvents);

    // Step 5: Sort by normalized score (highest first)
    normalizedEvents.sort((a, b) => b.relativeScore - a.relativeScore);

    console.log("[MapMoji] Scoring and sorting complete:", {
      scoredCount: scoredEvents.length,
      topScores: normalizedEvents.slice(0, 3).map((se) => ({
        eventId: se.event.id,
        title: se.event.title,
        rawScore: Math.round(se.rawScore * 100) / 100,
        relativeScore: Math.round(se.relativeScore * 100) / 100,
      })),
    });

    // Step 6: Apply geographic clustering to prevent overcrowding
    const clusteredEvents = this.config.clusteringEnabled
      ? this.applyClustering(normalizedEvents)
      : normalizedEvents;

    console.log("[MapMoji] Clustering complete:", {
      beforeClustering: normalizedEvents.length,
      afterClustering: clusteredEvents.length,
      removedByClustering: normalizedEvents.length - clusteredEvents.length,
      clusteringEnabled: this.config.clusteringEnabled,
    });

    // Step 7: Take top N events and attach relevance scores
    const topEvents = clusteredEvents.slice(0, this.config.maxEvents);

    console.log("[MapMoji] Filter algorithm complete:", {
      finalEventCount: topEvents.length,
      maxEvents: this.config.maxEvents,
      topEventScores: topEvents.slice(0, 3).map((se) => ({
        eventId: se.event.id,
        title: se.event.title,
        relevanceScore: Math.round(se.relativeScore * 100) / 100,
      })),
    });

    return topEvents.map((se) => ({
      ...se.event,
      relevanceScore: se.relativeScore,
    }));
  }

  /**
   * Update configuration for a specific request
   */
  updateConfig(config: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private preFilter(events: Event[]): Event[] {
    const now = this.config.currentTime;

    return events.filter((event) => {
      // Must be verified or pending (not rejected/expired)
      if (event.status === "REJECTED" || event.status === "EXPIRED") {
        return false;
      }

      // Must be within viewport
      if (!this.isInViewport(event)) {
        return false;
      }

      // Must not be too far in the past (unless recurring)
      const eventDate = new Date(event.eventDate);
      if (!this.isRecurringEvent(event) && eventDate < now) {
        const hoursSincePast =
          (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
        if (hoursSincePast > 24) {
          // Hide events more than 24h past
          return false;
        }
      }

      // Must not be too far in the future
      const hoursInFuture =
        (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursInFuture > 24 * 30) {
        // Hide events more than 30 days future
        return false;
      }

      return true;
    });
  }

  private scoreEvent(event: Event): EventScore {
    const timeScore = this.calculateTimeScore(event);
    const recencyScore = this.calculateRecencyScore(event);

    const rawScore =
      timeScore * this.config.weights.timeProximity +
      recencyScore * this.config.weights.recency;

    return {
      event,
      rawScore,
      relativeScore: 0, // Will be calculated in applyRelativeScoring
      percentileRank: 0, // Will be calculated in applyRelativeScoring
      components: {
        timeScore,
        popularityScore: 0,
        recencyScore,
        confidenceScore: 0,
      },
    };
  }

  private calculateTimeScore(event: Event): number {
    const now = this.config.currentTime;
    const eventTime = new Date(event.eventDate);

    // Handle recurring events - find next occurrence
    const relevantTime = this.isRecurringEvent(event)
      ? this.getNextRecurrence(event, now)
      : eventTime;

    if (!relevantTime) return 0;

    const hoursUntilEvent =
      (relevantTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Events happening soon get higher scores
    // Peak score at 2-24 hours from now, decay after that
    if (hoursUntilEvent < 0) {
      // Past events (but within 24h) get lower scores
      return Math.max(0, 1 + hoursUntilEvent / 24);
    } else if (hoursUntilEvent <= 2) {
      // Very soon - high urgency
      return 1.0;
    } else if (hoursUntilEvent <= 24) {
      // Today - good relevance
      return 0.8;
    } else if (hoursUntilEvent <= this.config.timeDecayHours) {
      // Within time window - decreasing relevance
      const decay =
        (this.config.timeDecayHours - hoursUntilEvent) /
        this.config.timeDecayHours;
      return 0.3 + decay * 0.5;
    } else {
      // Too far out
      return 0.1;
    }
  }

  private calculateRecencyScore(event: Event): number {
    const now = this.config.currentTime;
    const createdAt = new Date(event.createdAt);
    const hoursOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    // Newer events get higher scores
    if (hoursOld <= 1) return 1.0; // Brand new
    if (hoursOld <= 6) return 0.9; // Very recent
    if (hoursOld <= 24) return 0.7; // Recent
    if (hoursOld <= 72) return 0.5; // Few days old
    if (hoursOld <= 168) return 0.3; // Week old
    return 0.1; // Older than a week
  }

  private applyClustering(scoredEvents: EventScore[]): EventScore[] {
    const result: EventScore[] = [];
    const minDistanceKm = this.config.minClusterDistance;

    for (const candidate of scoredEvents) {
      let tooClose = false;

      for (const accepted of result) {
        const distance = this.haversineDistance(
          candidate.event.location.coordinates[1],
          candidate.event.location.coordinates[0],
          accepted.event.location.coordinates[1],
          accepted.event.location.coordinates[0],
        );

        if (distance < minDistanceKm) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        result.push(candidate);
      }
    }

    return result;
  }

  private applyRelativeScoring(scoredEvents: EventScore[]): EventScore[] {
    if (scoredEvents.length === 0) return scoredEvents;

    // Sort by raw score to establish rankings
    const sortedByRawScore = [...scoredEvents].sort(
      (a, b) => b.rawScore - a.rawScore,
    );

    // Calculate min and max raw scores for normalization
    const maxRawScore = sortedByRawScore[0].rawScore;
    const minRawScore = sortedByRawScore[sortedByRawScore.length - 1].rawScore;
    const scoreRange = maxRawScore - minRawScore;

    // Apply different scoring strategies based on the number of events
    return scoredEvents.map((eventScore) => {
      const rankPosition = sortedByRawScore.findIndex(
        (se) => se.event.id === eventScore.event.id,
      );
      const percentileRank =
        scoredEvents.length === 1
          ? 1.0
          : (scoredEvents.length - rankPosition - 1) /
            (scoredEvents.length - 1);

      let relativeScore: number;

      if (scoredEvents.length === 1) {
        // Single event gets maximum relevance
        relativeScore = 1.0;
      } else if (scoredEvents.length <= 3) {
        // Few events: use gentle curve to maintain high scores
        relativeScore = 0.6 + 0.4 * percentileRank;
      } else if (scoredEvents.length <= 10) {
        // Medium set: balanced distribution
        relativeScore = 0.3 + 0.7 * percentileRank;
      } else {
        // Many events: steep curve to create clear winners
        // Use power curve to emphasize top events
        const powerFactor = Math.min(2.0, 1.0 + scoredEvents.length / 50);
        relativeScore = Math.pow(percentileRank, 1 / powerFactor);
      }

      // Apply score normalization bonus/penalty based on raw score distribution
      if (scoreRange > 0) {
        const normalizedRawScore =
          (eventScore.rawScore - minRawScore) / scoreRange;
        // Blend relative ranking with raw score quality
        const qualityWeight = Math.min(0.3, scoredEvents.length / 100); // More weight on quality with more events
        relativeScore =
          relativeScore * (1 - qualityWeight) +
          normalizedRawScore * qualityWeight;
      }

      return {
        ...eventScore,
        relativeScore: Math.max(0, Math.min(1, relativeScore)), // Clamp to 0-1
        percentileRank,
      };
    });
  }

  private isInViewport(event: Event): boolean {
    const lat = event.location.coordinates[1];
    const lng = event.location.coordinates[0];
    const bounds = this.config.viewportBounds;

    return (
      lat >= bounds.minY &&
      lat <= bounds.maxY &&
      lng >= bounds.minX &&
      lng <= bounds.maxX
    );
  }

  private isRecurringEvent(event: Event): boolean {
    return event.isRecurring === true;
  }

  private getNextRecurrence(event: Event, from: Date): Date | null {
    if (!event.isRecurring || !event.recurrenceFrequency) return null;

    // Simplified recurrence calculation - you'd want more sophisticated logic
    const startDate = event.recurrenceStartDate
      ? new Date(event.recurrenceStartDate)
      : new Date(event.eventDate);
    const endDate = event.recurrenceEndDate
      ? new Date(event.recurrenceEndDate)
      : null;

    if (endDate && from > endDate) return null;

    const nextDate = new Date(startDate);
    const interval = event.recurrenceInterval || 1;

    // Find next occurrence after 'from'
    while (nextDate <= from) {
      switch (event.recurrenceFrequency) {
        case RecurrenceFrequency.DAILY:
          nextDate.setDate(nextDate.getDate() + interval);
          break;
        case RecurrenceFrequency.WEEKLY:
          nextDate.setDate(nextDate.getDate() + 7 * interval);
          break;
        case RecurrenceFrequency.BIWEEKLY:
          nextDate.setDate(nextDate.getDate() + 14 * interval);
          break;
        case RecurrenceFrequency.MONTHLY:
          nextDate.setMonth(nextDate.getMonth() + interval);
          break;
        case RecurrenceFrequency.YEARLY:
          nextDate.setFullYear(nextDate.getFullYear() + interval);
          break;
      }
    }

    return nextDate;
  }

  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
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
}
