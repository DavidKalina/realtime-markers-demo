import RBush from "rbush";
import { Event, CivicEngagement, SpatialItem } from "../types/types";

export interface UnifiedSpatialCacheService {
  // Event management
  addEvent(event: Event): void;
  updateEvent(event: Event): void;
  removeEvent(eventId: string): void;
  getEvent(eventId: string): Event | undefined;
  getAllEvents(): Event[];

  // Civic engagement management
  addCivicEngagement(civicEngagement: CivicEngagement): void;
  updateCivicEngagement(civicEngagement: CivicEngagement): void;
  removeCivicEngagement(civicEngagementId: string): void;
  getCivicEngagement(civicEngagementId: string): CivicEngagement | undefined;
  getAllCivicEngagements(): CivicEngagement[];

  // Unified spatial operations
  getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): { type: string; entities: (Event | CivicEngagement)[] }[];

  // Spatial index management (legacy methods for backward compatibility)
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
    civicEngagementCacheSize: number;
  };

  // Verification
  verifyEventInSpatialIndex(eventId: string, expectedEvent: Event): boolean;

  // Internal access for legacy compatibility
  getSpatialIndex(): RBush<SpatialItem>;
  getEventCache(): Map<string, Event>;
  getCivicEngagementCache(): Map<string, CivicEngagement>;
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
  const civicEngagementCache = new Map<string, CivicEngagement>();
  const spatialIndex = new RBush<SpatialItem>();

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
   * Convert a civic engagement to a spatial item for the RBush index
   */
  function civicEngagementToSpatialItem(
    civicEngagement: CivicEngagement,
  ): SpatialItem {
    // Validate location and coordinates
    if (
      !civicEngagement.location?.coordinates ||
      !Array.isArray(civicEngagement.location.coordinates) ||
      civicEngagement.location.coordinates.length !== 2
    ) {
      throw new Error(
        `Civic engagement ${civicEngagement.id} has invalid coordinates: ${JSON.stringify(civicEngagement.location)}`,
      );
    }

    const [lng, lat] = civicEngagement.location.coordinates;
    return {
      minX: lng,
      minY: lat,
      maxX: lng,
      maxY: lat,
      id: civicEngagement.id,
      civicEngagement,
      type: "civic_engagement",
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
    const allItems = spatialIndex.all();
    const itemToRemove = allItems.find((item) => item.id === eventId);
    if (itemToRemove) {
      spatialIndex.remove(itemToRemove);
    }
  }

  /**
   * Get all entities in viewport across all entity types
   */
  function getEntitiesInViewport(viewport: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): { type: string; entities: (Event | CivicEngagement)[] }[] {
    if (!enableSpatialIndex) {
      // Fallback to cache if spatial index is disabled
      return [
        { type: "event", entities: getAllEvents() },
        { type: "civic_engagement", entities: getAllCivicEngagements() },
      ];
    }

    const spatialItems = spatialIndex.search(viewport);

    // Group entities by type
    const events: Event[] = [];
    const civicEngagements: CivicEngagement[] = [];

    spatialItems.forEach((item) => {
      if (item.event) {
        events.push(item.event);
      } else if (item.civicEngagement) {
        civicEngagements.push(item.civicEngagement);
      }
    });

    return [
      { type: "event", entities: events },
      { type: "civic_engagement", entities: civicEngagements },
    ];
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
    }
  }

  /**
   * Get service statistics
   */
  function getStats(): {
    cacheSize: number;
    spatialIndexSize: number;
    civicEngagementCacheSize: number;
  } {
    return {
      cacheSize: eventCache.size,
      spatialIndexSize: spatialIndex.all().length,
      civicEngagementCacheSize: civicEngagementCache.size,
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

      const spatialItems = spatialIndex.all();
      const spatialItem = spatialItems.find((item) => item.id === eventId);

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

  /**
   * Add a civic engagement to both cache and spatial index
   */
  function addCivicEngagement(civicEngagement: CivicEngagement): void {
    // Add to cache
    civicEngagementCache.set(civicEngagement.id, civicEngagement);

    // Add to spatial index if enabled and has location
    if (enableSpatialIndex && civicEngagement.location) {
      addCivicEngagementToSpatialIndex(civicEngagement);
    }

    // Enforce cache size limit
    if (civicEngagementCache.size > maxCacheSize) {
      const firstKey = civicEngagementCache.keys().next().value;
      if (firstKey) {
        removeCivicEngagement(firstKey);
      }
    }
  }

  /**
   * Update an existing civic engagement
   */
  function updateCivicEngagement(civicEngagement: CivicEngagement): void {
    // Update cache
    civicEngagementCache.set(civicEngagement.id, civicEngagement);

    // Update spatial index if enabled and has location
    if (enableSpatialIndex && civicEngagement.location) {
      updateCivicEngagementSpatialIndex(civicEngagement);
    }
  }

  /**
   * Remove a civic engagement from both cache and spatial index
   */
  function removeCivicEngagement(civicEngagementId: string): void {
    // Remove from cache
    civicEngagementCache.delete(civicEngagementId);

    // Remove from spatial index if enabled
    if (enableSpatialIndex) {
      removeCivicEngagementFromSpatialIndex(civicEngagementId);
    }
  }

  /**
   * Get a civic engagement from cache
   */
  function getCivicEngagement(
    civicEngagementId: string,
  ): CivicEngagement | undefined {
    return civicEngagementCache.get(civicEngagementId);
  }

  /**
   * Get all civic engagements from cache
   */
  function getAllCivicEngagements(): CivicEngagement[] {
    return Array.from(civicEngagementCache.values());
  }

  /**
   * Add civic engagement to spatial index
   */
  function addCivicEngagementToSpatialIndex(
    civicEngagement: CivicEngagement,
  ): void {
    try {
      const spatialItem = civicEngagementToSpatialItem(civicEngagement);
      spatialIndex.insert(spatialItem);
    } catch (error) {
      console.warn(
        `[EventCacheService] Failed to add civic engagement ${civicEngagement.id} to spatial index:`,
        error,
      );
    }
  }

  /**
   * Update civic engagement in spatial index
   */
  function updateCivicEngagementSpatialIndex(
    civicEngagement: CivicEngagement,
  ): void {
    try {
      // Remove old entry
      removeCivicEngagementFromSpatialIndex(civicEngagement.id);
      // Add new entry
      addCivicEngagementToSpatialIndex(civicEngagement);
    } catch (error) {
      console.warn(
        `[EventCacheService] Failed to update civic engagement ${civicEngagement.id} in spatial index:`,
        error,
      );
    }
  }

  /**
   * Remove civic engagement from spatial index
   */
  function removeCivicEngagementFromSpatialIndex(
    civicEngagementId: string,
  ): void {
    const allItems = spatialIndex.all();
    const itemToRemove = allItems.find(
      (item) =>
        item.id === civicEngagementId && item.type === "civic_engagement",
    );
    if (itemToRemove) {
      spatialIndex.remove(itemToRemove);
    }
  }

  return {
    addEvent,
    updateEvent,
    removeEvent,
    getEvent,
    getAllEvents,
    addCivicEngagement,
    updateCivicEngagement,
    removeCivicEngagement,
    getCivicEngagement,
    getAllCivicEngagements,
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
    getCivicEngagementCache: () => civicEngagementCache,
  };
}
