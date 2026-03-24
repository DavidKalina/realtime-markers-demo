import RBush from "rbush";
import { Event, CommunityItinerary, SpatialItem } from "../types/types";

export interface UnifiedSpatialCacheService {
  // Event methods
  addEvent(event: Event): void;
  updateEvent(event: Event): void;
  removeEvent(eventId: string): void;
  getEvent(eventId: string): Event | undefined;
  getAllEvents(): Event[];

  // Itinerary methods
  addItinerary(itinerary: CommunityItinerary): void;
  updateItinerary(itinerary: CommunityItinerary): void;
  removeItinerary(itineraryId: string): void;
  getItinerary(itineraryId: string): CommunityItinerary | undefined;
  getAllItineraries(): CommunityItinerary[];
  getItinerariesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): CommunityItinerary[];

  // Shared spatial methods
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
    itineraryCacheSize: number;
    itinerarySpatialIndexSize: number;
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

  // Private state — events
  const eventCache = new Map<string, Event>();
  const spatialItemMap = new Map<string, SpatialItem>();
  let spatialIndexFailures = 0;

  // Private state — itineraries (share the same RBush)
  const itineraryCache = new Map<string, CommunityItinerary>();
  const itinerarySpatialItemMap = new Map<string, SpatialItem>();

  // Shared spatial index for both events and itineraries
  const spatialIndex = new RBush<SpatialItem>();

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

  function getEventsInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): Event[] {
    if (!enableSpatialIndex) {
      return getAllEvents();
    }

    const spatialItems = spatialIndex.search(viewport);
    return spatialItems
      .map((item) => item.event)
      .filter((event): event is Event => event !== undefined);
  }

  // ── Itinerary methods ──────────────────────────────────────────────

  function itineraryToSpatialItem(
    itinerary: CommunityItinerary,
  ): SpatialItem {
    if (itinerary.entryLongitude == null || itinerary.entryLatitude == null) {
      throw new Error(
        `Itinerary ${itinerary.id} has no entry coordinates`,
      );
    }
    const lng = itinerary.entryLongitude;
    const lat = itinerary.entryLatitude;
    return {
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
      id: itinerary.id,
      itinerary,
      type: "itinerary",
    };
  }

  function addItinerary(itinerary: CommunityItinerary): void {
    itineraryCache.set(itinerary.id, itinerary);

    if (enableSpatialIndex) {
      try {
        const spatialItem = itineraryToSpatialItem(itinerary);
        spatialIndex.insert(spatialItem);
        itinerarySpatialItemMap.set(itinerary.id, spatialItem);
      } catch (error) {
        spatialIndexFailures++;
        itineraryCache.delete(itinerary.id);
        console.warn(
          `[SpatialCache] Failed to add itinerary ${itinerary.id} to spatial index:`,
          error,
        );
      }
    }
  }

  function updateItinerary(itinerary: CommunityItinerary): void {
    removeItinerary(itinerary.id);
    addItinerary(itinerary);
  }

  function removeItinerary(itineraryId: string): void {
    itineraryCache.delete(itineraryId);
    const itemToRemove = itinerarySpatialItemMap.get(itineraryId);
    if (itemToRemove) {
      spatialIndex.remove(itemToRemove);
      itinerarySpatialItemMap.delete(itineraryId);
    }
  }

  function getItinerary(
    itineraryId: string,
  ): CommunityItinerary | undefined {
    return itineraryCache.get(itineraryId);
  }

  function getAllItineraries(): CommunityItinerary[] {
    return Array.from(itineraryCache.values());
  }

  function getItinerariesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): CommunityItinerary[] {
    if (!enableSpatialIndex) {
      return getAllItineraries();
    }

    const spatialItems = spatialIndex.search(viewport);
    return spatialItems
      .map((item) => item.itinerary)
      .filter(
        (itin): itin is CommunityItinerary => itin !== undefined,
      );
  }

  // ── Shared methods ─────────────────────────────────────────────────

  function clearAll(): void {
    eventCache.clear();
    spatialIndex.clear();
    spatialItemMap.clear();
    itineraryCache.clear();
    itinerarySpatialItemMap.clear();
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
    itineraryCacheSize: number;
    itinerarySpatialIndexSize: number;
  } {
    return {
      cacheSize: eventCache.size,
      spatialIndexSize: spatialItemMap.size,
      spatialIndexFailures,
      itineraryCacheSize: itineraryCache.size,
      itinerarySpatialIndexSize: itinerarySpatialItemMap.size,
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
    addItinerary,
    updateItinerary,
    removeItinerary,
    getItinerary,
    getAllItineraries,
    getItinerariesInViewport,
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
