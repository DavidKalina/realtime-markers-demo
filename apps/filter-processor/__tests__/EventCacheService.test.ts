import { describe, test, expect, beforeEach } from "bun:test";
import {
  createEventCacheService,
  EventCacheService,
} from "../src/services/EventCacheService";
import { Event, EventStatus } from "../src/types/types";

describe("EventCacheService", () => {
  let eventCacheService: EventCacheService;

  // Test event factory
  const createTestEvent = (overrides: Partial<Event> = {}): Event => ({
    id: "test-event-1",
    title: "Test Event",
    description: "A test event",
    eventDate: "2024-01-15T14:00:00Z",
    location: { type: "Point", coordinates: [-122.4194, 37.7749] },
    scanCount: 5,
    saveCount: 2,
    status: EventStatus.VERIFIED,
    isPrivate: false,
    creatorId: "user-1",
    isRecurring: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  });

  beforeEach(() => {
    eventCacheService = createEventCacheService();
  });

  describe("Constructor and Configuration", () => {
    test("should create service with default configuration", () => {
      const service = createEventCacheService();

      expect(service).toBeDefined();
      expect(typeof service.addEvent).toBe("function");
      expect(typeof service.updateEvent).toBe("function");
      expect(typeof service.removeEvent).toBe("function");
      expect(typeof service.getEvent).toBe("function");
      expect(typeof service.getAllEvents).toBe("function");
      expect(typeof service.getEventsInViewport).toBe("function");
      expect(typeof service.clearAll).toBe("function");
      expect(typeof service.bulkLoad).toBe("function");
      expect(typeof service.getStats).toBe("function");
    });

    test("should create service with custom configuration", () => {
      const service = createEventCacheService({
        maxCacheSize: 100,
        enableSpatialIndex: false,
      });

      expect(service).toBeDefined();
      const stats = service.getStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.spatialIndexSize).toBe(0);
    });

    test("should create service with spatial index disabled", () => {
      const service = createEventCacheService({ enableSpatialIndex: false });
      const event = createTestEvent();

      service.addEvent(event);
      const viewportEvents = service.getEventsInViewport({
        minX: -122.5,
        minY: 37.7,
        maxX: -122.4,
        maxY: 37.8,
      });

      // Should fallback to cache when spatial index is disabled
      expect(viewportEvents).toHaveLength(1);
      expect(viewportEvents[0].id).toBe(event.id);
    });
  });

  describe("Event Management", () => {
    test("should add event to cache", () => {
      const event = createTestEvent();

      eventCacheService.addEvent(event);

      const retrievedEvent = eventCacheService.getEvent(event.id);
      expect(retrievedEvent).toBeDefined();
      expect(retrievedEvent?.id).toBe(event.id);
      expect(retrievedEvent?.title).toBe(event.title);
    });

    test("should update existing event", () => {
      const event = createTestEvent();
      eventCacheService.addEvent(event);

      const updatedEvent = { ...event, title: "Updated Title", scanCount: 10 };
      eventCacheService.updateEvent(updatedEvent);

      const retrievedEvent = eventCacheService.getEvent(event.id);
      expect(retrievedEvent?.title).toBe("Updated Title");
      expect(retrievedEvent?.scanCount).toBe(10);
    });

    test("should remove event from cache", () => {
      const event = createTestEvent();
      eventCacheService.addEvent(event);

      eventCacheService.removeEvent(event.id);

      const retrievedEvent = eventCacheService.getEvent(event.id);
      expect(retrievedEvent).toBeUndefined();
    });

    test("should get all events from cache", () => {
      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2" });

      eventCacheService.addEvent(event1);
      eventCacheService.addEvent(event2);

      const allEvents = eventCacheService.getAllEvents();
      expect(allEvents).toHaveLength(2);
      expect(allEvents.map((e) => e.id)).toContain("event-1");
      expect(allEvents.map((e) => e.id)).toContain("event-2");
    });

    test("should enforce cache size limit", () => {
      const service = createEventCacheService({ maxCacheSize: 2 });

      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2" });
      const event3 = createTestEvent({ id: "event-3" });

      service.addEvent(event1);
      service.addEvent(event2);
      service.addEvent(event3); // Should evict event1

      const allEvents = service.getAllEvents();
      expect(allEvents).toHaveLength(2);
      expect(allEvents.map((e) => e.id)).toContain("event-2");
      expect(allEvents.map((e) => e.id)).toContain("event-3");
      expect(allEvents.map((e) => e.id)).not.toContain("event-1");
    });
  });

  describe("Spatial Index Management", () => {
    test("should add event to spatial index", () => {
      const event = createTestEvent();

      eventCacheService.addToSpatialIndex(event);

      const spatialIndex = eventCacheService.getSpatialIndex();
      const allItems = spatialIndex.all();
      expect(allItems).toHaveLength(1);
      expect(allItems[0].id).toBe(event.id);
    });

    test("should update event in spatial index", () => {
      const event = createTestEvent();
      eventCacheService.addToSpatialIndex(event);

      const updatedEvent = {
        ...event,
        location: {
          type: "Point" as const,
          coordinates: [-122.5, 37.8] as [number, number],
        },
      };
      eventCacheService.updateSpatialIndex(updatedEvent);

      const spatialIndex = eventCacheService.getSpatialIndex();
      const allItems = spatialIndex.all();
      expect(allItems).toHaveLength(1);
      expect(allItems[0].minX).toBe(-122.5);
      expect(allItems[0].minY).toBe(37.8);
    });

    test("should remove event from spatial index", () => {
      const event = createTestEvent();
      eventCacheService.addToSpatialIndex(event);

      eventCacheService.removeFromSpatialIndex(event.id);

      const spatialIndex = eventCacheService.getSpatialIndex();
      const allItems = spatialIndex.all();
      expect(allItems).toHaveLength(0);
    });

    test("should get events in viewport", () => {
      const event1 = createTestEvent({
        id: "event-1",
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      });
      const event2 = createTestEvent({
        id: "event-2",
        location: { type: "Point", coordinates: [-122.5, 37.8] },
      });
      const event3 = createTestEvent({
        id: "event-3",
        location: { type: "Point", coordinates: [-123.0, 38.0] },
      });

      eventCacheService.addEvent(event1);
      eventCacheService.addEvent(event2);
      eventCacheService.addEvent(event3);

      const viewportEvents = eventCacheService.getEventsInViewport({
        minX: -122.45,
        minY: 37.77,
        maxX: -122.41,
        maxY: 37.78,
      });

      expect(viewportEvents).toHaveLength(1);
      expect(viewportEvents[0].id).toBe("event-1");
    });

    test("should handle empty viewport query", () => {
      const event = createTestEvent();
      eventCacheService.addEvent(event);

      const viewportEvents = eventCacheService.getEventsInViewport({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      });

      expect(viewportEvents).toHaveLength(0);
    });

    test("should handle viewport with no matching events", () => {
      const event = createTestEvent();
      eventCacheService.addEvent(event);

      const viewportEvents = eventCacheService.getEventsInViewport({
        minX: 180,
        minY: 90,
        maxX: 180,
        maxY: 90,
      });

      expect(viewportEvents).toHaveLength(0);
    });
  });

  describe("Bulk Operations", () => {
    test("should bulk load events", () => {
      const events = [
        createTestEvent({ id: "event-1" }),
        createTestEvent({ id: "event-2" }),
        createTestEvent({ id: "event-3" }),
      ];

      eventCacheService.bulkLoad(events);

      const allEvents = eventCacheService.getAllEvents();
      expect(allEvents).toHaveLength(3);
      expect(allEvents.map((e) => e.id)).toContain("event-1");
      expect(allEvents.map((e) => e.id)).toContain("event-2");
      expect(allEvents.map((e) => e.id)).toContain("event-3");
    });

    test("should clear existing data on bulk load", () => {
      const existingEvent = createTestEvent({ id: "existing" });
      eventCacheService.addEvent(existingEvent);

      const newEvents = [createTestEvent({ id: "new-1" })];
      eventCacheService.bulkLoad(newEvents);

      const allEvents = eventCacheService.getAllEvents();
      expect(allEvents).toHaveLength(1);
      expect(allEvents[0].id).toBe("new-1");
    });

    test("should filter out events with invalid coordinates during bulk load", () => {
      const validEvent = createTestEvent({ id: "valid" });
      const invalidEvent1 = createTestEvent({
        id: "invalid-1",
        location: {
          type: "Point",
          coordinates: [] as unknown as [number, number],
        },
      });
      const invalidEvent2 = createTestEvent({
        id: "invalid-2",
        location: {
          type: "Point",
          coordinates: [1] as unknown as [number, number],
        },
      });
      const invalidEvent3 = createTestEvent({
        id: "invalid-3",
        location: {
          type: "Point",
          coordinates: [1, 2, 3] as unknown as [number, number],
        },
      });
      const invalidEvent4 = createTestEvent({
        id: "invalid-4",
        location: undefined as unknown as Event["location"],
      });

      const events = [
        validEvent,
        invalidEvent1,
        invalidEvent2,
        invalidEvent3,
        invalidEvent4,
      ];
      eventCacheService.bulkLoad(events);

      const allEvents = eventCacheService.getAllEvents();
      expect(allEvents).toHaveLength(1);
      expect(allEvents[0].id).toBe("valid");
    });

    test("should clear all data", () => {
      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2" });

      eventCacheService.addEvent(event1);
      eventCacheService.addEvent(event2);

      eventCacheService.clearAll();

      const allEvents = eventCacheService.getAllEvents();
      expect(allEvents).toHaveLength(0);

      const stats = eventCacheService.getStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.spatialIndexSize).toBe(0);
    });
  });

  describe("Statistics", () => {
    test("should return correct statistics", () => {
      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2" });

      eventCacheService.addEvent(event1);
      eventCacheService.addEvent(event2);

      const stats = eventCacheService.getStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.spatialIndexSize).toBe(2);
    });

    test("should return zero statistics for empty cache", () => {
      const stats = eventCacheService.getStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.spatialIndexSize).toBe(0);
    });
  });

  describe("Spatial Index Verification", () => {
    test("should verify event in spatial index", () => {
      const event = createTestEvent();
      eventCacheService.addEvent(event);

      const isValid = eventCacheService.verifyEventInSpatialIndex(
        event.id,
        event,
      );
      expect(isValid).toBe(true);
    });

    test("should return false for non-existent event", () => {
      const event = createTestEvent();
      const isValid = eventCacheService.verifyEventInSpatialIndex(
        event.id,
        event,
      );
      expect(isValid).toBe(false);
    });

    test("should return false for event with mismatched metrics", () => {
      const event = createTestEvent();
      eventCacheService.addEvent(event);

      const differentEvent = { ...event, scanCount: 999, saveCount: 999 };
      const isValid = eventCacheService.verifyEventInSpatialIndex(
        event.id,
        differentEvent,
      );
      expect(isValid).toBe(false);
    });

    test("should return true when spatial index is disabled", () => {
      const service = createEventCacheService({ enableSpatialIndex: false });
      const event = createTestEvent();

      const isValid = service.verifyEventInSpatialIndex(event.id, event);
      expect(isValid).toBe(true);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle events with null/undefined location gracefully", () => {
      const eventWithoutLocation = createTestEvent({
        location: undefined as unknown as Event["location"],
      });

      // Should not throw error
      expect(() => {
        eventCacheService.addEvent(eventWithoutLocation);
      }).not.toThrow();
    });

    test("should handle duplicate event IDs", () => {
      const event1 = createTestEvent({ id: "duplicate" });
      const event2 = createTestEvent({
        id: "duplicate",
        title: "Different Title",
      });

      eventCacheService.addEvent(event1);
      eventCacheService.addEvent(event2);

      const retrievedEvent = eventCacheService.getEvent("duplicate");
      expect(retrievedEvent?.title).toBe("Different Title");
    });

    test("should handle removing non-existent event", () => {
      expect(() => {
        eventCacheService.removeEvent("non-existent");
      }).not.toThrow();
    });

    test("should handle updating non-existent event", () => {
      const event = createTestEvent();
      expect(() => {
        eventCacheService.updateEvent(event);
      }).not.toThrow();

      const retrievedEvent = eventCacheService.getEvent(event.id);
      expect(retrievedEvent).toBeDefined();
    });

    test("should handle spatial index operations with disabled index", () => {
      const service = createEventCacheService({ enableSpatialIndex: false });
      const event = createTestEvent();

      expect(() => {
        service.addToSpatialIndex(event);
        service.updateSpatialIndex(event);
        service.removeFromSpatialIndex(event.id);
      }).not.toThrow();
    });
  });

  describe("Integration Tests", () => {
    test("should maintain consistency between cache and spatial index", () => {
      const event = createTestEvent();

      // Add event
      eventCacheService.addEvent(event);

      // Verify both cache and spatial index have the event
      const cachedEvent = eventCacheService.getEvent(event.id);
      const spatialIndex = eventCacheService.getSpatialIndex();
      const spatialItems = spatialIndex.all();

      expect(cachedEvent).toBeDefined();
      expect(spatialItems).toHaveLength(1);
      expect(spatialItems[0].id).toBe(event.id);

      // Update event
      const updatedEvent = { ...event, title: "Updated" };
      eventCacheService.updateEvent(updatedEvent);

      // Verify both are updated
      const updatedCachedEvent = eventCacheService.getEvent(event.id);
      const updatedSpatialItems = spatialIndex.all();

      expect(updatedCachedEvent?.title).toBe("Updated");
      expect(updatedSpatialItems).toHaveLength(1);

      // Remove event
      eventCacheService.removeEvent(event.id);

      // Verify both are removed
      const removedCachedEvent = eventCacheService.getEvent(event.id);
      const removedSpatialItems = spatialIndex.all();

      expect(removedCachedEvent).toBeUndefined();
      expect(removedSpatialItems).toHaveLength(0);
    });

    test("should handle complex viewport queries", () => {
      const events = [
        createTestEvent({
          id: "event-1",
          location: { type: "Point", coordinates: [-122.4194, 37.7749] },
        }),
        createTestEvent({
          id: "event-2",
          location: { type: "Point", coordinates: [-122.5, 37.8] },
        }),
        createTestEvent({
          id: "event-3",
          location: { type: "Point", coordinates: [-122.4, 37.77] },
        }),
        createTestEvent({
          id: "event-4",
          location: { type: "Point", coordinates: [-123.0, 38.0] },
        }),
      ];

      eventCacheService.bulkLoad(events);

      // Query viewport that should contain only event-1
      const viewportEvents = eventCacheService.getEventsInViewport({
        minX: -122.45,
        minY: 37.77,
        maxX: -122.41,
        maxY: 37.78,
      });

      expect(viewportEvents).toHaveLength(1);
      expect(viewportEvents[0].id).toBe("event-1");
    });

    test("should handle large number of events efficiently", () => {
      const events = Array.from({ length: 1000 }, (_, i) =>
        createTestEvent({
          id: `event-${i}`,
          location: {
            type: "Point",
            coordinates: [-122.4194 + i * 0.001, 37.7749 + i * 0.001],
          },
        }),
      );

      eventCacheService.bulkLoad(events);

      const stats = eventCacheService.getStats();
      expect(stats.cacheSize).toBe(1000);
      expect(stats.spatialIndexSize).toBe(1000);

      // Test viewport query performance
      const viewportEvents = eventCacheService.getEventsInViewport({
        minX: -122.4194,
        minY: 37.7749,
        maxX: -122.4184,
        maxY: 37.7759,
      });

      expect(viewportEvents.length).toBeGreaterThan(0);
      expect(viewportEvents.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("Internal Access Methods", () => {
    test("should provide access to internal spatial index", () => {
      const spatialIndex = eventCacheService.getSpatialIndex();
      expect(spatialIndex).toBeDefined();
      expect(typeof spatialIndex.all).toBe("function");
      expect(typeof spatialIndex.search).toBe("function");
    });

    test("should provide access to internal event cache", () => {
      const eventCache = eventCacheService.getEventCache();
      expect(eventCache).toBeDefined();
      expect(eventCache instanceof Map).toBe(true);
    });

    test("should maintain consistency with internal access", () => {
      const event = createTestEvent();
      eventCacheService.addEvent(event);

      const spatialIndex = eventCacheService.getSpatialIndex();
      const eventCache = eventCacheService.getEventCache();

      expect(eventCache.get(event.id)).toBeDefined();
      expect(spatialIndex.all()).toHaveLength(1);
      expect(spatialIndex.all()[0].id).toBe(event.id);
    });
  });
});
