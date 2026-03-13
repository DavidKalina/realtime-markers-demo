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

  clearUserState(userId: string): void;

  getStats(): Record<string, unknown>;
}

export interface UnifiedFilteringServiceConfig {
  mapMojiConfig?: {
    maxEvents?: number;
  };
}

function computeContentHash(event: Event): string {
  // NOTE: relevanceScore is intentionally excluded — it's a computed display value
  // that shifts every cycle due to relative scoring, which would cause false diffs.
  return `${event.id}:${event.updatedAt}:${event.scanCount ?? 0}:${event.saveCount ?? 0}:${event.status}`;
}

export function createUnifiedFilteringService(
  filterMatcher: FilterMatcher,
  mapMojiFilter: MapMojiFilterService,
  eventPublisher: EventPublisher,
  clientConfigService: ClientConfigService,
  config: UnifiedFilteringServiceConfig = {},
): UnifiedFilteringService {
  const { mapMojiConfig = {} } = config;

  // Per-user last-sent state: userId -> Map<eventId, contentHash>
  const userLastSentState = new Map<string, Map<string, string>>();

  // Stats for monitoring
  const stats = {
    mapMojiFilterApplied: 0,
    totalEventsFiltered: 0,
    unifiedMessagesSent: 0,
    diffsSent: 0,
    fullSendsFallback: 0,
    noopSkipped: 0,
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

      // Build new state map
      const newState = new Map<string, string>();
      const eventById = new Map<string, Event>();
      for (const event of filteredEvents) {
        newState.set(event.id, computeContentHash(event));
        eventById.set(event.id, event);
      }

      const previousState = userLastSentState.get(userId);

      // First connection or no prior state: send full list
      if (!previousState) {
        console.log(
          `[UnifiedFiltering] First send for user ${userId}, publishing full list (${filteredEvents.length} events)`,
        );

        await eventPublisher.publishFilteredEvents(
          userId,
          viewport ? "viewport" : "all",
          filteredEvents,
        );

        userLastSentState.set(userId, newState);
        stats.fullSendsFallback++;
        stats.totalEventsFiltered += filteredEvents.length;
        stats.unifiedMessagesSent++;
        return;
      }

      // Compute diff
      const creates: Event[] = [];
      const updates: Event[] = [];
      const deletes: string[] = [];

      // Find creates and updates
      for (const [eventId, hash] of newState) {
        const previousHash = previousState.get(eventId);
        if (!previousHash) {
          creates.push(eventById.get(eventId)!);
        } else if (previousHash !== hash) {
          updates.push(eventById.get(eventId)!);
        }
      }

      // Find deletes
      for (const eventId of previousState.keys()) {
        if (!newState.has(eventId)) {
          deletes.push(eventId);
        }
      }

      // Noop: nothing changed
      if (
        creates.length === 0 &&
        updates.length === 0 &&
        deletes.length === 0
      ) {
        stats.noopSkipped++;
        return;
      }

      const totalChanges = creates.length + updates.length + deletes.length;
      const totalEvents = Math.max(previousState.size, newState.size, 1);

      // If diff is large (>50% of events changed), fall back to full send.
      // Sending hundreds of individual messages is worse than one batch.
      if (totalChanges > totalEvents * 0.5) {
        console.log(
          `[UnifiedFiltering] Large diff for user ${userId} (${totalChanges}/${totalEvents} changes), falling back to full send`,
        );

        await eventPublisher.publishFilteredEvents(
          userId,
          viewport ? "viewport" : "all",
          filteredEvents,
        );

        userLastSentState.set(userId, newState);
        stats.fullSendsFallback++;
        stats.totalEventsFiltered += filteredEvents.length;
        stats.unifiedMessagesSent++;
        return;
      }

      console.log(`[UnifiedFiltering] Sending diff to user ${userId}:`, {
        creates: creates.length,
        updates: updates.length,
        deletes: deletes.length,
      });

      // Publish individual messages for incremental updates
      const publishPromises: Promise<void>[] = [];

      for (const event of creates) {
        publishPromises.push(eventPublisher.publishAddEvent(userId, event));
      }
      for (const event of updates) {
        publishPromises.push(eventPublisher.publishUpdateEvent(userId, event));
      }
      for (const eventId of deletes) {
        publishPromises.push(
          eventPublisher.publishDeleteEvent(userId, eventId),
        );
      }

      await Promise.all(publishPromises);

      // Update stored state
      userLastSentState.set(userId, newState);

      stats.diffsSent++;
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
   * Clear stored state for a user (call on disconnect to prevent memory leaks)
   */
  function clearUserState(userId: string): void {
    userLastSentState.delete(userId);
  }

  /**
   * Get current statistics
   */
  function getStats(): Record<string, unknown> {
    return {
      ...stats,
      trackedUsers: userLastSentState.size,
    };
  }

  return {
    calculateAndSendDiff,
    clearUserState,
    getStats,
  };
}
