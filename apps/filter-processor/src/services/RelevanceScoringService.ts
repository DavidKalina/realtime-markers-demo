import { Event, BoundingBox } from "../types/types";

export interface RelevanceScoringService {
  // MapMoji scoring (complex algorithm)
  calculateMapMojiScore(
    event: Event,
    viewport?: BoundingBox,
    currentTime?: Date,
  ): number;

  // Simple scoring (for traditional filters)
  calculateSimpleScore(
    event: Event,
    viewport?: BoundingBox,
    currentTime?: Date,
  ): number;

  // Batch scoring
  addRelevanceScoresToEvents(
    events: Event[],
    viewport?: BoundingBox,
    currentTime?: Date,
    scoringMethod?: "mapmoji" | "simple",
  ): Event[];

  // Configuration
  updateMapMojiConfig(config: {
    viewportBounds?: BoundingBox;
    maxEvents?: number;
    currentTime?: Date;
    popularityWeight?: number;
    timeWeight?: number;
    distanceWeight?: number;
  }): void;

  // Stats
  getStats(): {
    mapMojiScoresCalculated: number;
    simpleScoresCalculated: number;
    totalScoresCalculated: number;
  };
}

export interface RelevanceScoringServiceConfig {
  // MapMoji algorithm weights
  popularityWeight?: number;
  timeWeight?: number;
  distanceWeight?: number;

  // Time-based scoring parameters
  maxPastHours?: number;
  maxFutureDays?: number;
  urgencyThresholdHours?: number;

  // Popularity scoring parameters
  maxScanCount?: number;
  maxSaveCount?: number;
  maxRsvpCount?: number;

  // Distance scoring parameters
  distanceThresholds?: {
    veryClose: number; // km
    close: number; // km
    moderate: number; // km
    far: number; // km
  };
}

export function createRelevanceScoringService(
  config: RelevanceScoringServiceConfig = {},
): RelevanceScoringService {
  const {
    popularityWeight = 0.4,
    timeWeight = 0.4,
    distanceWeight = 0.2,
    maxPastHours = 24,
    maxFutureDays = 30,
    urgencyThresholdHours = 2,
    maxScanCount = 10,
    maxSaveCount = 5,
    maxRsvpCount = 3,
    distanceThresholds = {
      veryClose: 1,
      close: 5,
      moderate: 15,
      far: 50,
    },
  } = config;

  // Private state
  let mapMojiConfig = {
    viewportBounds: undefined as BoundingBox | undefined,
    maxEvents: 1000,
    currentTime: new Date(),
    popularityWeight,
    timeWeight,
    distanceWeight,
  };

  const stats = {
    mapMojiScoresCalculated: 0,
    simpleScoresCalculated: 0,
    totalScoresCalculated: 0,
  };

  /**
   * Calculate time proximity score (0-1)
   */
  function calculateTimeScore(
    event: Event,
    currentTime: Date = new Date(),
  ): number {
    const eventDate = new Date(event.eventDate);
    const hoursUntilEvent =
      (eventDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

    if (hoursUntilEvent < 0) {
      // Past events (within maxPastHours) get lower scores
      const pastHours = Math.abs(hoursUntilEvent);
      if (pastHours > maxPastHours) {
        return 0; // Too far in the past
      }
      return Math.max(0, 0.5 + hoursUntilEvent / (maxPastHours * 2));
    } else if (hoursUntilEvent <= urgencyThresholdHours) {
      // Very soon - high urgency
      return 1.0;
    } else if (hoursUntilEvent <= 24) {
      // Today - good relevance
      return 0.8;
    } else if (hoursUntilEvent <= 72) {
      // Within 3 days - moderate relevance
      return 0.6;
    } else if (hoursUntilEvent <= maxFutureDays * 24) {
      // Within maxFutureDays - lower relevance
      return 0.3;
    } else {
      // Too far in the future
      return 0;
    }
  }

  /**
   * Calculate popularity score (0-1)
   */
  function calculatePopularityScore(event: Event): number {
    const scanScore = Math.min(event.scanCount / maxScanCount, 1.0);
    const saveScore = Math.min((event.saveCount || 0) / maxSaveCount, 1.0);
    const rsvpScore = Math.min((event.rsvps?.length || 0) / maxRsvpCount, 1.0);

    // Weighted combination: saves and RSVPs are more valuable than scans
    return (scanScore + saveScore * 2 + rsvpScore * 3) / 6;
  }

  /**
   * Calculate distance score (0-1)
   */
  function calculateDistanceScore(
    event: Event,
    viewport?: BoundingBox,
  ): number {
    if (!viewport) {
      return 0.5; // Default score when no viewport
    }

    const centerLat = (viewport.maxY + viewport.minY) / 2;
    const centerLng = (viewport.maxX + viewport.minX) / 2;
    const eventLat = event.location.coordinates[1];
    const eventLng = event.location.coordinates[0];

    // Simple distance calculation (Haversine would be more accurate)
    const latDiff = Math.abs(eventLat - centerLat);
    const lngDiff = Math.abs(eventLng - centerLng);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion

    if (distance <= distanceThresholds.veryClose) return 1.0;
    if (distance <= distanceThresholds.close) return 0.8;
    if (distance <= distanceThresholds.moderate) return 0.6;
    if (distance <= distanceThresholds.far) return 0.4;
    return 0.2;
  }

  /**
   * Calculate MapMoji relevance score (complex algorithm)
   */
  function calculateMapMojiScore(
    event: Event,
    viewport?: BoundingBox,
    currentTime?: Date,
  ): number {
    const time = currentTime || mapMojiConfig.currentTime;
    const bounds = viewport || mapMojiConfig.viewportBounds;

    // Basic pre-filter checks
    const validStatus =
      event.status !== "REJECTED" && event.status !== "EXPIRED";
    if (!validStatus) {
      return 0;
    }

    // Calculate component scores
    const timeScore = calculateTimeScore(event, time);
    const popularityScore = calculatePopularityScore(event);
    const distanceScore = calculateDistanceScore(event, bounds);

    // Apply MapMoji weights
    const relevanceScore =
      timeScore * mapMojiConfig.timeWeight +
      popularityScore * mapMojiConfig.popularityWeight +
      distanceScore * mapMojiConfig.distanceWeight;

    stats.mapMojiScoresCalculated++;
    stats.totalScoresCalculated++;

    return Math.max(0, Math.min(1, relevanceScore)); // Clamp to 0-1
  }

  /**
   * Calculate simple relevance score (for traditional filters)
   */
  function calculateSimpleScore(
    event: Event,
    viewport?: BoundingBox,
    currentTime?: Date,
  ): number {
    const time = currentTime || new Date();

    // Calculate component scores
    const timeScore = calculateTimeScore(event, time);
    const popularityScore = calculatePopularityScore(event);
    const distanceScore = calculateDistanceScore(event, viewport);

    // Simple weighted combination
    const relevanceScore =
      timeScore * 0.4 + popularityScore * 0.4 + distanceScore * 0.2;

    stats.simpleScoresCalculated++;
    stats.totalScoresCalculated++;

    return Math.max(0, Math.min(1, relevanceScore)); // Clamp to 0-1
  }

  /**
   * Add relevance scores to a batch of events
   */
  function addRelevanceScoresToEvents(
    events: Event[],
    viewport?: BoundingBox,
    currentTime?: Date,
    scoringMethod: "mapmoji" | "simple" = "simple",
  ): Event[] {
    if (events.length === 0) return events;

    const time = currentTime || new Date();

    return events.map((event) => {
      const relevanceScore =
        scoringMethod === "mapmoji"
          ? calculateMapMojiScore(event, viewport, time)
          : calculateSimpleScore(event, viewport, time);

      return {
        ...event,
        relevanceScore,
      };
    });
  }

  /**
   * Update MapMoji configuration
   */
  function updateMapMojiConfig(config: {
    viewportBounds?: BoundingBox;
    maxEvents?: number;
    currentTime?: Date;
    popularityWeight?: number;
    timeWeight?: number;
    distanceWeight?: number;
  }): void {
    mapMojiConfig = { ...mapMojiConfig, ...config };
  }

  /**
   * Get service statistics
   */
  function getStats(): {
    mapMojiScoresCalculated: number;
    simpleScoresCalculated: number;
    totalScoresCalculated: number;
  } {
    return { ...stats };
  }

  return {
    calculateMapMojiScore,
    calculateSimpleScore,
    addRelevanceScoresToEvents,
    updateMapMojiConfig,
    getStats,
  };
}
