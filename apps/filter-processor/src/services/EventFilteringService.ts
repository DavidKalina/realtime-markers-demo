import { Event, BoundingBox, Filter } from "../types/types";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { MapMojiFilterService } from "./MapMojiFilterService";
import { RelevanceScoringService } from "./RelevanceScoringService";
import { EventPublisher } from "../handlers/EventPublisher";

export interface EventFilteringService {
  filterAndSendViewportEvents(
    userId: string,
    viewport: BoundingBox,
    filters: Filter[],
    eventsInViewport: Event[],
  ): Promise<void>;

  filterAndSendAllEvents(
    userId: string,
    filters: Filter[],
    allEvents: Event[],
  ): Promise<void>;

  calculateAndSendDiff(
    userId: string,
    events: Event[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void>;

  getStats(): Record<string, unknown>;
}

export interface EventFilteringServiceConfig {
  mapMojiConfig?: {
    maxEvents?: number;
    enableHybridMode?: boolean;
  };
}

export function createEventFilteringService(
  filterMatcher: FilterMatcher,
  mapMojiFilter: MapMojiFilterService,
  relevanceScoringService: RelevanceScoringService,
  eventPublisher: EventPublisher,
  config: EventFilteringServiceConfig = {},
): EventFilteringService {
  const { mapMojiConfig = {} } = config;

  // Stats for monitoring
  const stats = {
    mapMojiFilterApplied: 0,
    traditionalFilterApplied: 0,
    hybridFilterApplied: 0,
    totalEventsFiltered: 0,
  };

  /**
   * Filter and send events in a specific viewport to a user
   */
  async function filterAndSendViewportEvents(
    userId: string,
    viewport: BoundingBox,
    filters: Filter[],
    eventsInViewport: Event[],
  ): Promise<void> {
    try {
      let filteredEvents: Event[];

      if (filters.length === 0) {
        // No custom filters - apply MapMoji algorithm for curated experience
        console.log(
          `[EventFiltering] Applying MapMoji algorithm for user ${userId} (no custom filters)`,
        );

        filteredEvents = await applyMapMojiFiltering(
          eventsInViewport,
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
            `[EventFiltering] Applying hybrid filtering for user ${userId} (MapMoji + date range)`,
          );

          filteredEvents = await applyHybridFiltering(
            eventsInViewport,
            viewport,
            filters,
            userId,
          );
          stats.hybridFilterApplied++;
        } else {
          // Traditional filtering mode - bypass MapMoji and use traditional filtering
          console.log(
            `[EventFiltering] Using traditional filters for user ${userId} (${filters.length} filters)`,
          );

          filteredEvents = applyTraditionalFiltering(
            eventsInViewport,
            filters,
            userId,
            viewport,
          );
          stats.traditionalFilterApplied++;
        }
      }

      // Send to user's channel
      console.log(
        `[EventFiltering] Publishing ${filteredEvents.length} events to user ${userId} with updated relevance scores:`,
        {
          userId,
          eventCount: filteredEvents.length,
          topEventScores: filteredEvents.slice(0, 3).map((event) => ({
            eventId: event.id,
            title: event.title,
            relevanceScore: event.relevanceScore,
            popularityMetrics: {
              scanCount: event.scanCount,
              saveCount: event.saveCount || 0,
              rsvpCount: event.rsvps?.length || 0,
            },
          })),
          messageType: "viewport",
        },
      );

      await eventPublisher.publishFilteredEvents(
        userId,
        "viewport",
        filteredEvents,
      );

      stats.totalEventsFiltered += filteredEvents.length;
    } catch (error) {
      console.error(
        `Error filtering and sending viewport events for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Filter and send all events to a user
   */
  async function filterAndSendAllEvents(
    userId: string,
    filters: Filter[],
    allEvents: Event[],
  ): Promise<void> {
    try {
      let filteredEvents: Event[];

      if (filters.length === 0) {
        // No custom filters - apply MapMoji algorithm for curated experience
        console.log(
          `[EventFiltering] Applying MapMoji algorithm for all events for user ${userId} (no custom filters)`,
        );

        filteredEvents = await applyMapMojiFiltering(
          allEvents,
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
            `[EventFiltering] Applying hybrid filtering for all events for user ${userId} (MapMoji + date range)`,
          );

          filteredEvents = await applyHybridFiltering(
            allEvents,
            undefined,
            filters,
            userId,
          );
          stats.hybridFilterApplied++;
        } else {
          // Traditional filtering mode - bypass MapMoji and use traditional filtering
          console.log(
            `[EventFiltering] Using traditional filters for all events for user ${userId} (${filters.length} filters)`,
          );

          filteredEvents = applyTraditionalFiltering(
            allEvents,
            filters,
            userId,
            undefined,
          );
          stats.traditionalFilterApplied++;
        }
      }

      // Publish the filtered events
      console.log(
        `[EventFiltering] Publishing ${filteredEvents.length} events to user ${userId} with updated relevance scores:`,
        {
          userId,
          eventCount: filteredEvents.length,
          topEventScores: filteredEvents.slice(0, 3).map((event) => ({
            eventId: event.id,
            title: event.title,
            relevanceScore: event.relevanceScore,
            popularityMetrics: {
              scanCount: event.scanCount,
              saveCount: event.saveCount || 0,
              rsvpCount: event.rsvps?.length || 0,
            },
          })),
          messageType: "all",
        },
      );

      await eventPublisher.publishFilteredEvents(userId, "all", filteredEvents);
      stats.totalEventsFiltered += filteredEvents.length;
    } catch (error) {
      console.error("Error filtering and sending all events:", error);
    }
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
      `[EventFiltering] MapMoji filtered ${events.length} events to ${mapMojiEvents.length}`,
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
      `[EventFiltering] Hybrid filtered ${events.length} events to ${mapMojiEvents.length} (MapMoji) to ${filteredEvents.length} (with date range)`,
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
   * Calculate and send diff for a user - unified interface for the hybrid batcher
   */
  async function calculateAndSendDiff(
    userId: string,
    events: Event[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void> {
    try {
      if (viewport) {
        // User has a viewport - filter and send viewport events
        await filterAndSendViewportEvents(userId, viewport, filters, events);
      } else {
        // User has no viewport - filter and send all events
        await filterAndSendAllEvents(userId, filters, events);
      }
    } catch (error) {
      console.error(
        `[EventFiltering] Error in calculateAndSendDiff for user ${userId}:`,
        error,
      );
      throw error;
    }
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
    filterAndSendViewportEvents,
    filterAndSendAllEvents,
    calculateAndSendDiff,
    getStats,
  };
}
