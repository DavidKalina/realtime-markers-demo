import RBush from "rbush";
import { Event, SpatialItem } from "../types/types";

export interface UnifiedSpatialCacheService {
  // Event management
  addEvent(event: Event): void;
  updateEvent(event: Event): void;
  removeEvent(eventId: string): void;
  getEvent(eventId: string): Event | undefined;
  getAllEvents(): Event[];

  // Unified spatial operations
  getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): { type: string; entities: Event[] }[];

  // Spatial index management
  addToSpatialIndex(event: Event): void;
  updateSpatialIndex(event: Event): void;
  removeFromSpatialIndex(eventId: string): void;
  getEventsInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): Event[];

  // Bulk operations
  clearAll(): void;
  bulkLoad(events: Event[]): void;

  // Stats
  getStats(): {
    cacheSize: number;
    spatialIndexSize: number;
  };

  // Verification
  verifyEventInSpatialIndex(eventId: string, expectedEvent: Event): boolean;

  // Internal access for legacy compatibility
  getSpatialIndex(): RBush<SpatialItem>;
  getEventCache(): Map<string, Event>;
}

export interface UnifiedSpatialCacheServiceConfig {
  maxCacheSize?: number;
  enableSpatialIndex?: boolean;
}

export function createUnifiedSpatialCacheService(
  config: UnifiedSpatialCacheServiceConfig = {},
): UnifiedSpatialCacheService {
  const { maxCacheSize = 10000, enableSpatialIndex = true } = config;

  // Private state
  const eventCache = new Map<string, Event>();
  const spatialIndex = new RBush<SpatialItem>();
  const spatialItemMap = new Map<string, SpatialItem>();

  /**
   * Convert an event to a spatial item for the RBush index
   */
  function eventToSpatialItem(event: Event): SpatialItem {
    // Validate location and coordinates
    if (
      !event.location?.coordinates ||
      !Array.isArray(event.location.coordinates) ||
      event.location.coordinates.length !== 2
    ) {
      throw new Error(
        `Event ${event.id} has invalid coordinates: ${JSON.stringify(event.location)}`,
      );
    }

    const [lng, lat] = event.location.coordinates;
    return {
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
      id: event.id,
      event,
      type: "event",
    };
  }

  /**
   * Add an event to both cache and spatial index
   */
  function addEvent(event: Event): void {
    // Add to cache
    eventCache.set(event.id, event);

    // Add to spatial index if enabled
    if (enableSpatialIndex) {
      addToSpatialIndex(event);
    }

    // Enforce cache size limit
    if (eventCache.size > maxCacheSize) {
      const firstKey = eventCache.keys().next().value;
      if (firstKey) {
        removeEvent(firstKey);
      }
    }
  }

  /**
   * Update an existing event
   */
  function updateEvent(event: Event): void {
    // Update cache
    eventCache.set(event.id, event);

    // Update spatial index if enabled
    if (enableSpatialIndex) {
      updateSpatialIndex(event);
    }
  }

  /**
   * Remove an event from both cache and spatial index
   */
  function removeEvent(eventId: string): void {
    // Remove from cache
    eventCache.delete(eventId);

    // Remove from spatial index if enabled
    if (enableSpatialIndex) {
      removeFromSpatialIndex(eventId);
    }
  }

  /**
   * Get an event from cache
   */
  function getEvent(eventId: string): Event | undefined {
    return eventCache.get(eventId);
  }

  /**
   * Get all events from cache
   */
  function getAllEvents(): Event[] {
    return Array.from(eventCache.values());
  }

  /**
   * Add event to spatial index
   */
  function addToSpatialIndex(event: Event): void {
    try {
      const spatialItem = eventToSpatialItem(event);
      spatialIndex.insert(spatialItem);
      spatialItemMap.set(event.id, spatialItem);
    } catch (error) {
      console.warn(
        `[EventCacheService] Failed to add event ${event.id} to spatial index:`,
        error,
      );
    }
  }

  /**
   * Update event in spatial index
   */
  function updateSpatialIndex(event: Event): void {
    try {
      // Remove old entry
      removeFromSpatialIndex(event.id);
      // Add new entry
      addToSpatialIndex(event);
    } catch (error) {
      console.warn(
        `[EventCacheService] Failed to update event ${event.id} in spatial index:`,
        error,
      );
    }
  }

  /**
   * Remove event from spatial index
   */
  function removeFromSpatialIndex(eventId: string): void {
    const itemToRemove = spatialItemMap.get(eventId);
    if (itemToRemove) {
      spatialIndex.remove(itemToRemove);
      spatialItemMap.delete(eventId);
    }
  }

  /**
   * Get all entities in viewport
   */
  function getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): { type: string; entities: Event[] }[] {
    if (!enableSpatialIndex) {
      return [{ type: "event", entities: getAllEvents() }];
    }

    const spatialItems = spatialIndex.search(viewport);
    const events: Event[] = spatialItems
      .map((item) => item.event)
      .filter((event): event is Event => event !== undefined);

    return [{ type: "event", entities: events }];
  }

  /**
   * Get events in a specific viewport
   */
  function getEventsInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): Event[] {
    if (!enableSpatialIndex) {
      // Fallback to cache if spatial index is disabled
      return getAllEvents();
    }

    const spatialItems = spatialIndex.search(viewport);
    return spatialItems
      .map((item) => item.event)
      .filter((event): event is Event => event !== undefined);
  }

  /**
   * Clear all data
   */
  function clearAll(): void {
    eventCache.clear();
    spatialIndex.clear();
    spatialItemMap.clear();
  }

  /**
   * Bulk load events for initialization
   */
  function bulkLoad(events: Event[]): void {
    // Clear existing data
    clearAll();

    // Filter out events without valid coordinates
    const validEvents = events.filter((event) => {
      if (
        !event.location?.coordinates ||
        !Array.isArray(event.location.coordinates) ||
        event.location.coordinates.length !== 2
      ) {
        console.warn(
          `Event ${event.id} has invalid coordinates:`,
          event.location,
        );
        return false;
      }
      return true;
    });

    // Add to cache
    validEvents.forEach((event) => {
      eventCache.set(event.id, event);
    });

    // Bulk load spatial index for performance
    if (enableSpatialIndex) {
      const spatialItems = validEvents.map((event) =>
        eventToSpatialItem(event),
      );
      spatialIndex.load(spatialItems);
      for (const item of spatialItems) {
        spatialItemMap.set(item.id, item);
      }
    }
  }

  /**
   * Get service statistics
   */
  function getStats(): {
    cacheSize: number;
    spatialIndexSize: number;
  } {
    return {
      cacheSize: eventCache.size,
      spatialIndexSize: spatialItemMap.size,
    };
  }

  /**
   * Verify that the spatial index contains the updated event data
   */
  function verifyEventInSpatialIndex(
    eventId: string,
    expectedEvent: Event,
  ): boolean {
    try {
      if (!enableSpatialIndex) {
        return true; // Skip verification if spatial index is disabled
      }

      const spatialItem = spatialItemMap.get(eventId);

      if (!spatialItem) {
        console.warn(
          "[EventCacheService] Event not found in spatial index:",
          eventId,
        );
        return false;
      }

      const cachedEvent = eventCache.get(eventId);
      if (!cachedEvent) {
        console.warn("[EventCacheService] Event not found in cache:", eventId);
        return false;
      }

      // Verify that popularity metrics match
      const spatialEvent = spatialItem.event;
      if (!spatialEvent) {
        console.warn(
          "[EventCacheService] Spatial item has no event data:",
          eventId,
        );
        return false;
      }

      const metricsMatch =
        spatialEvent.scanCount === expectedEvent.scanCount &&
        spatialEvent.saveCount === expectedEvent.saveCount &&
        spatialEvent.rsvps?.length === expectedEvent.rsvps?.length;

      if (!metricsMatch) {
        console.warn(
          "[EventCacheService] Popularity metrics mismatch in spatial index:",
          {
            eventId,
            expected: {
              scanCount: expectedEvent.scanCount,
              saveCount: expectedEvent.saveCount,
              rsvpCount: expectedEvent.rsvps?.length || 0,
            },
            actual: {
              scanCount: spatialEvent.scanCount,
              saveCount: spatialEvent.saveCount,
              rsvpCount: spatialEvent.rsvps?.length || 0,
            },
          },
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "[EventCacheService] Error verifying spatial index update:",
        error,
      );
      return false;
    }
  }

  return {
    addEvent,
    updateEvent,
    removeEvent,
    getEvent,
    getAllEvents,
    getEntitiesInViewport,
    addToSpatialIndex,
    updateSpatialIndex,
    removeFromSpatialIndex,
    getEventsInViewport,
    clearAll,
    bulkLoad,
    getStats,
    verifyEventInSpatialIndex,
    getSpatialIndex: () => spatialIndex,
    getEventCache: () => eventCache,
  };
}
