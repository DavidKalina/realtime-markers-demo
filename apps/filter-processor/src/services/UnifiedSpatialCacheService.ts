import RBush from "rbush";
import { Event, SpatialItem } from "../types/types";

export interface UnifiedSpatialCacheService {
  addEvent(event: Event): void;
  updateEvent(event: Event): void;
  removeEvent(eventId: string): void;
  getEvent(eventId: string): Event | undefined;
  getAllEvents(): Event[];

  getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): { type: string; entities: Event[] }[];
  addToSpatialIndex(event: Event): boolean;
  updateSpatialIndex(event: Event): void;
  removeFromSpatialIndex(eventId: string): void;
  getEventsInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): Event[];
  clearAll(): void;
  bulkLoad(events: Event[]): void;
  getStats(): {
    cacheSize: number;
    spatialIndexSize: number;
    spatialIndexFailures: number;
  };
  verifyEventInSpatialIndex(eventId: string, expectedEvent: Event): boolean;
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
  let spatialIndexFailures = 0;

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

  function addEvent(event: Event): void {
    // Add to cache
    eventCache.set(event.id, event);

    // Add to spatial index if enabled — remove from cache on failure to prevent divergence
    if (enableSpatialIndex) {
      if (!addToSpatialIndex(event)) {
        eventCache.delete(event.id);
        return;
      }
    }

    // Enforce cache size limit
    if (eventCache.size > maxCacheSize) {
      const firstKey = eventCache.keys().next().value;
      if (firstKey) {
        removeEvent(firstKey);
      }
    }
  }

  function updateEvent(event: Event): void {
    // Update cache
    eventCache.set(event.id, event);

    // Update spatial index if enabled
    if (enableSpatialIndex) {
      updateSpatialIndex(event);
    }
  }

  function removeEvent(eventId: string): void {
    // Remove from cache
    eventCache.delete(eventId);

    // Remove from spatial index if enabled
    if (enableSpatialIndex) {
      removeFromSpatialIndex(eventId);
    }
  }

  function getEvent(eventId: string): Event | undefined {
    return eventCache.get(eventId);
  }

  function getAllEvents(): Event[] {
    return Array.from(eventCache.values());
  }

  function addToSpatialIndex(event: Event): boolean {
    try {
      const spatialItem = eventToSpatialItem(event);
      spatialIndex.insert(spatialItem);
      spatialItemMap.set(event.id, spatialItem);
      return true;
    } catch (error) {
      spatialIndexFailures++;
      console.warn(
        `[EventCacheService] Failed to add event ${event.id} to spatial index (total failures: ${spatialIndexFailures}):`,
        error,
      );
      return false;
    }
  }

  function updateSpatialIndex(event: Event): void {
    // Remove old entry
    removeFromSpatialIndex(event.id);
    // Add new entry — if it fails, remove from cache to prevent divergence
    if (!addToSpatialIndex(event)) {
      eventCache.delete(event.id);
    }
  }

  function removeFromSpatialIndex(eventId: string): void {
    const itemToRemove = spatialItemMap.get(eventId);
    if (itemToRemove) {
      spatialIndex.remove(itemToRemove);
      spatialItemMap.delete(eventId);
    }
  }

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

  function clearAll(): void {
    eventCache.clear();
    spatialIndex.clear();
    spatialItemMap.clear();
  }

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

  function getStats(): {
    cacheSize: number;
    spatialIndexSize: number;
    spatialIndexFailures: number;
  } {
    return {
      cacheSize: eventCache.size,
      spatialIndexSize: spatialItemMap.size,
      spatialIndexFailures,
    };
  }

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
