import { Event, CivicEngagement, BoundingBox, Filter } from "../types/types";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { MapMojiFilterService } from "./MapMojiFilterService";
import { RelevanceScoringService } from "./RelevanceScoringService";
import { EventPublisher } from "../handlers/EventPublisher";

export interface UnifiedFilteringService {
  calculateAndSendDiff(
    userId: string,
    events: Event[],
    civicEngagements: CivicEngagement[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void>;

  getStats(): Record<string, unknown>;
}

export interface UnifiedFilteringServiceConfig {
  mapMojiConfig?: {
    maxEvents?: number;
    enableHybridMode?: boolean;
  };
  maxCivicEngagements?: number;
}

export function createUnifiedFilteringService(
  filterMatcher: FilterMatcher,
  mapMojiFilter: MapMojiFilterService,
  relevanceScoringService: RelevanceScoringService,
  eventPublisher: EventPublisher,
  config: UnifiedFilteringServiceConfig = {},
): UnifiedFilteringService {
  const { mapMojiConfig = {}, maxCivicEngagements = 100 } = config;

  // Stats for monitoring
  const stats = {
    mapMojiFilterApplied: 0,
    traditionalFilterApplied: 0,
    hybridFilterApplied: 0,
    totalEventsFiltered: 0,
    totalCivicEngagementsFiltered: 0,
    unifiedMessagesSent: 0,
  };

  /**
   * Calculate and send diff for both events and civic engagements in a unified message
   */
  async function calculateAndSendDiff(
    userId: string,
    events: Event[],
    civicEngagements: CivicEngagement[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void> {
    try {
      // Process events
      let filteredEvents: Event[];
      if (viewport) {
        filteredEvents = await processViewportEvents(
          events,
          viewport,
          filters,
          userId,
        );
      } else {
        filteredEvents = await processAllEvents(events, filters, userId);
      }

      // Process civic engagements
      const filteredCivicEngagements =
        processCivicEngagements(civicEngagements);

      console.log(
        `[UnifiedFiltering] Publishing unified message to user ${userId}:`,
        {
          userId,
          viewport: !!viewport,
          filterCount: filters.length,
          eventCount: filteredEvents.length,
          civicEngagementCount: filteredCivicEngagements.length,
          topEventScores: filteredEvents.slice(0, 3).map((event) => ({
            eventId: event.id,
            title: event.title,
            relevanceScore: event.relevanceScore,
          })),
          topCivicEngagementScores: filteredCivicEngagements
            .slice(0, 3)
            .map((ce) => ({
              civicEngagementId: ce.id,
              title: ce.title,
              relevanceScore: (
                ce as CivicEngagement & { relevanceScore?: number }
              ).relevanceScore,
              status: ce.status,
            })),
        },
      );

      // Send unified message with both events and civic engagements
      await eventPublisher.publishFilteredEvents(
        userId,
        viewport ? "viewport" : "all",
        filteredEvents,
        filteredCivicEngagements,
      );

      stats.totalEventsFiltered += filteredEvents.length;
      stats.totalCivicEngagementsFiltered += filteredCivicEngagements.length;
      stats.unifiedMessagesSent++;
    } catch (error) {
      console.error(
        `[UnifiedFiltering] Error in calculateAndSendDiff for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process events for viewport
   */
  async function processViewportEvents(
    events: Event[],
    viewport: BoundingBox,
    filters: Filter[],
    userId: string,
  ): Promise<Event[]> {
    let filteredEvents: Event[];

    if (filters.length === 0) {
      // No custom filters - apply MapMoji algorithm for curated experience
      console.log(
        `[UnifiedFiltering] Applying MapMoji algorithm for user ${userId} (no custom filters)`,
      );

      filteredEvents = await applyMapMojiFiltering(
        events,
        viewport,
        mapMojiConfig.maxEvents || 1000,
      );
    } else {
      // Check if we have date range filters only (hybrid mode)
      const hasDateRangeOnly = filters.every(
        (filter) =>
          filter.criteria.dateRange &&
          !filter.criteria.location &&
          !filter.semanticQuery,
      );

      if (hasDateRangeOnly && mapMojiConfig.enableHybridMode !== false) {
        // Hybrid mode: Apply MapMoji first, then date range filters
        console.log(
          `[UnifiedFiltering] Applying hybrid filtering for user ${userId} (MapMoji + date range)`,
        );

        filteredEvents = await applyHybridFiltering(
          events,
          viewport,
          filters,
          userId,
        );
        stats.hybridFilterApplied++;
      } else {
        // Traditional filtering mode - bypass MapMoji and use traditional filtering
        console.log(
          `[UnifiedFiltering] Using traditional filters for user ${userId} (${filters.length} filters)`,
        );

        filteredEvents = applyTraditionalFiltering(
          events,
          filters,
          userId,
          viewport,
        );
        stats.traditionalFilterApplied++;
      }
    }

    return filteredEvents;
  }

  /**
   * Process all events
   */
  async function processAllEvents(
    events: Event[],
    filters: Filter[],
    userId: string,
  ): Promise<Event[]> {
    let filteredEvents: Event[];

    if (filters.length === 0) {
      // No custom filters - apply MapMoji algorithm for curated experience
      console.log(
        `[UnifiedFiltering] Applying MapMoji algorithm for all events for user ${userId} (no custom filters)`,
      );

      filteredEvents = await applyMapMojiFiltering(
        events,
        undefined,
        mapMojiConfig.maxEvents || 50,
      );
    } else {
      // Check if we have date range filters only (hybrid mode)
      const hasDateRangeOnly = filters.every(
        (filter) =>
          filter.criteria.dateRange &&
          !filter.criteria.location &&
          !filter.semanticQuery,
      );

      if (hasDateRangeOnly && mapMojiConfig.enableHybridMode !== false) {
        // Hybrid mode: Apply MapMoji first, then date range filters
        console.log(
          `[UnifiedFiltering] Applying hybrid filtering for all events for user ${userId} (MapMoji + date range)`,
        );

        filteredEvents = await applyHybridFiltering(
          events,
          undefined,
          filters,
          userId,
        );
        stats.hybridFilterApplied++;
      } else {
        // Traditional filtering mode - bypass MapMoji and use traditional filtering
        console.log(
          `[UnifiedFiltering] Using traditional filters for all events for user ${userId} (${filters.length} filters)`,
        );

        filteredEvents = applyTraditionalFiltering(
          events,
          filters,
          userId,
          undefined,
        );
        stats.traditionalFilterApplied++;
      }
    }

    return filteredEvents;
  }

  /**
   * Process civic engagements
   */
  function processCivicEngagements(
    civicEngagements: CivicEngagement[],
  ): CivicEngagement[] {
    // Basic filtering: only include civic engagements with location and not rejected
    const filteredCivicEngagements = civicEngagements.filter(
      (ce) => ce.location && ce.status !== "REJECTED",
    );

    // Add basic relevance scores
    const civicEngagementsWithScores = filteredCivicEngagements.map((ce) => ({
      ...ce,
      relevanceScore: calculateBasicCivicEngagementScore(ce),
    }));

    // Sort by relevance score and limit
    const limitedCivicEngagements = civicEngagementsWithScores
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, maxCivicEngagements);

    return limitedCivicEngagements;
  }

  /**
   * Apply MapMoji filtering algorithm
   */
  async function applyMapMojiFiltering(
    events: Event[],
    viewport?: BoundingBox,
    maxEvents?: number,
  ): Promise<Event[]> {
    // Update MapMoji configuration for this request
    mapMojiFilter.updateConfig({
      viewportBounds: viewport,
      maxEvents: maxEvents,
      currentTime: new Date(),
    });

    // Apply MapMoji filtering (events will have relevance scores)
    const mapMojiEvents = await mapMojiFilter.filterEvents(events);
    stats.mapMojiFilterApplied++;

    console.log(
      `[UnifiedFiltering] MapMoji filtered ${events.length} events to ${mapMojiEvents.length}`,
    );

    return mapMojiEvents;
  }

  /**
   * Apply hybrid filtering (MapMoji + date range filters)
   */
  async function applyHybridFiltering(
    events: Event[],
    viewport: BoundingBox | undefined,
    filters: Filter[],
    userId: string,
  ): Promise<Event[]> {
    // Update MapMoji configuration for this request
    mapMojiFilter.updateConfig({
      viewportBounds: viewport,
      maxEvents: 100,
      currentTime: new Date(),
    });

    // Apply MapMoji filtering first
    const mapMojiEvents = await mapMojiFilter.filterEvents(events);
    stats.mapMojiFilterApplied++;

    // Then apply date range filters on top of MapMoji results
    const filteredEvents = mapMojiEvents.filter((event) =>
      filterMatcher.eventMatchesFilters(event, filters, userId),
    );

    console.log(
      `[UnifiedFiltering] Hybrid filtered ${events.length} events to ${mapMojiEvents.length} (MapMoji) to ${filteredEvents.length} (with date range)`,
    );

    return filteredEvents;
  }

  /**
   * Apply traditional filtering
   */
  function applyTraditionalFiltering(
    events: Event[],
    filters: Filter[],
    userId: string,
    viewport?: BoundingBox,
  ): Event[] {
    // Apply traditional filters
    const filteredEvents = events.filter((event) =>
      filterMatcher.eventMatchesFilters(event, filters, userId),
    );

    // Add relevance scores for traditionally filtered events
    const eventsWithScores = relevanceScoringService.addRelevanceScoresToEvents(
      filteredEvents,
      viewport,
      new Date(),
      "simple",
    );

    return eventsWithScores;
  }

  /**
   * Calculate basic relevance score for civic engagement
   */
  function calculateBasicCivicEngagementScore(
    civicEngagement: CivicEngagement,
  ): number {
    let score = 0.5; // Base score

    // Status-based scoring
    switch (civicEngagement.status) {
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
    const createdAt = new Date(civicEngagement.createdAt);
    const now = new Date();
    const daysOld =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysOld <= 1) score += 0.2;
    else if (daysOld <= 7) score += 0.1;
    else if (daysOld <= 30) score += 0.05;

    return Math.max(0, Math.min(1, score)); // Clamp to 0-1
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
    };
  }

  return {
    calculateAndSendDiff,
    getStats,
  };
}
