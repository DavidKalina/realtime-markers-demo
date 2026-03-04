import { Event, BoundingBox, Filter } from "../types/types";
import { FilterMatcher } from "../handlers/FilterMatcher";
import { MapMojiFilterService } from "./MapMojiFilterService";
import { EventPublisher } from "../handlers/EventPublisher";
import type { ClientConfigService } from "./ClientConfigService";

export interface UnifiedFilteringService {
  calculateAndSendDiff(
    userId: string,
    events: Event[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void>;

  getStats(): Record<string, unknown>;
}

export interface UnifiedFilteringServiceConfig {
  mapMojiConfig?: {
    maxEvents?: number;
  };
}

export function createUnifiedFilteringService(
  filterMatcher: FilterMatcher,
  mapMojiFilter: MapMojiFilterService,
  eventPublisher: EventPublisher,
  clientConfigService: ClientConfigService,
  config: UnifiedFilteringServiceConfig = {},
): UnifiedFilteringService {
  const { mapMojiConfig = {} } = config;

  // Stats for monitoring
  const stats = {
    mapMojiFilterApplied: 0,
    totalEventsFiltered: 0,
    unifiedMessagesSent: 0,
  };

  /**
   * Calculate and send filtered events diff for a user based on their viewport and filters
   */
  async function calculateAndSendDiff(
    userId: string,
    events: Event[],
    viewport: BoundingBox | null,
    filters: Filter[],
  ): Promise<void> {
    try {
      // Get client configuration for this user
      const clientConfig = await clientConfigService.getClientConfig(userId);

      console.log(
        `[UnifiedFiltering] Using client config for user ${userId}:`,
        {
          includeEvents: clientConfig.includeEvents,
          maxEvents: clientConfig.maxEvents,
        },
      );

      // Process events based on client config
      let filteredEvents: Event[] = [];
      if (clientConfig.includeEvents) {
        filteredEvents = await processEvents(events, viewport, filters, userId);

        // Apply max events limit from client config
        if (
          clientConfig.maxEvents &&
          filteredEvents.length > clientConfig.maxEvents
        ) {
          filteredEvents = filteredEvents.slice(0, clientConfig.maxEvents);
          console.log(
            `[UnifiedFiltering] Limited events to ${clientConfig.maxEvents} for user ${userId}`,
          );
        }
      }

      console.log(
        `[UnifiedFiltering] Publishing unified message to user ${userId}:`,
        {
          userId,
          viewport: !!viewport,
          filterCount: filters.length,
          eventCount: filteredEvents.length,
          clientConfig: {
            includeEvents: clientConfig.includeEvents,
          },
          topEventScores: filteredEvents.slice(0, 3).map((event) => ({
            eventId: event.id,
            title: event.title,
            relevanceScore: event.relevanceScore,
          })),
        },
      );

      // Send filtered events to user
      await eventPublisher.publishFilteredEvents(
        userId,
        viewport ? "viewport" : "all",
        filteredEvents,
      );

      stats.totalEventsFiltered += filteredEvents.length;
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
   * Single pipeline: MapMoji scoring + optional FilterMatcher
   */
  async function processEvents(
    events: Event[],
    viewport: BoundingBox | null,
    filters: Filter[],
    userId: string,
  ): Promise<Event[]> {
    const maxEvents = viewport ? mapMojiConfig.maxEvents || 1000 : 250;

    // Step 1: Always run MapMoji for relevance scoring and curated sorting
    mapMojiFilter.updateConfig({
      viewportBounds: viewport || undefined,
      maxEvents,
      currentTime: new Date(),
    });

    const scoredEvents = await mapMojiFilter.filterEvents(events);
    stats.mapMojiFilterApplied++;

    // Step 2: If user has filters, apply FilterMatcher on top
    let filteredEvents = scoredEvents;
    if (filters.length > 0) {
      filteredEvents = scoredEvents.filter((event) =>
        filterMatcher.eventMatchesFilters(event, filters, userId),
      );

      console.log(
        `[UnifiedFiltering] Filtered ${events.length} → ${scoredEvents.length} (MapMoji) → ${filteredEvents.length} (with filters) for user ${userId}`,
      );
    } else {
      console.log(
        `[UnifiedFiltering] MapMoji filtered ${events.length} → ${scoredEvents.length} for user ${userId}`,
      );
    }

    return filteredEvents;
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
