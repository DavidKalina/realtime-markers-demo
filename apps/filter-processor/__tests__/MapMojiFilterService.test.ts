import { describe, test, expect, beforeEach } from "bun:test";
import { MapMojiFilterService } from "../src/services/MapMojiFilterService";
import {
  Event,
  BoundingBox,
  EventStatus,
  RecurrenceFrequency,
} from "../src/types/types";

describe("MapMojiFilterService", () => {
  let filterService: MapMojiFilterService;
  const baseTime = new Date("2024-01-15T12:00:00Z");

  // Test event factory
  const createTestEvent = (overrides: Partial<Event> = {}): Event => ({
    id: "test-event-1",
    title: "Test Event",
    description: "A test event",
    eventDate: "2024-01-15T14:00:00Z", // 2 hours in future
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

  const testViewport: BoundingBox = {
    minX: -122.5,
    minY: 37.7,
    maxX: -122.4,
    maxY: 37.8,
  };

  beforeEach(() => {
    filterService = new MapMojiFilterService({
      currentTime: baseTime,
      viewportBounds: testViewport,
      maxEvents: 10,
      clusteringEnabled: false, // Disable clustering for simpler tests
    });
  });

  describe("Constructor and Configuration", () => {
    test("should initialize with default configuration", () => {
      const service = new MapMojiFilterService();

      // Test default values
      expect(service).toBeInstanceOf(MapMojiFilterService);
    });

    test("should accept custom configuration", () => {
      const customConfig = {
        maxEvents: 25,
        currentTime: baseTime,
        viewportBounds: testViewport,
        weights: {
          timeProximity: 0.5,
          popularity: 0.3,
          recency: 0.1,
          confidence: 0.1,
        },
        clusteringEnabled: false,
      };

      const service = new MapMojiFilterService(customConfig);
      expect(service).toBeInstanceOf(MapMojiFilterService);
    });

    test("should update configuration", () => {
      const newConfig = {
        maxEvents: 15,
        clusteringEnabled: true,
        minClusterDistance: 1.0,
      };

      filterService.updateConfig(newConfig);

      // Test that config was updated by running a filter operation
      const events = [createTestEvent()];
      expect(() => filterService.filterEvents(events)).not.toThrow();
    });
  });

  describe("Pre-filtering", () => {
    test("should filter out rejected events", async () => {
      const rejectedEvent = createTestEvent({ status: EventStatus.REJECTED });
      const validEvent = createTestEvent({ status: EventStatus.VERIFIED });

      const result = await filterService.filterEvents([
        rejectedEvent,
        validEvent,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(validEvent.id);
    });

    test("should filter out expired events", async () => {
      const expiredEvent = createTestEvent({ status: EventStatus.EXPIRED });
      const validEvent = createTestEvent({ status: EventStatus.VERIFIED });

      const result = await filterService.filterEvents([
        expiredEvent,
        validEvent,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(validEvent.id);
    });

    test("should filter out events outside viewport", async () => {
      const outsideEvent = createTestEvent({
        location: { type: "Point", coordinates: [-123.0, 38.0] }, // Outside viewport
      });
      const insideEvent = createTestEvent({
        location: { type: "Point", coordinates: [-122.45, 37.75] }, // Inside viewport
      });

      const result = await filterService.filterEvents([
        outsideEvent,
        insideEvent,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(insideEvent.id);
    });

    test("should filter out past events (non-recurring)", async () => {
      const pastEvent = createTestEvent({
        eventDate: "2024-01-14T10:00:00Z", // 26 hours ago
        isRecurring: false,
      });
      const futureEvent = createTestEvent({
        eventDate: "2024-01-15T14:00:00Z", // 2 hours in future
        isRecurring: false,
      });

      const result = await filterService.filterEvents([pastEvent, futureEvent]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(futureEvent.id);
    });

    test("should allow past recurring events", async () => {
      const pastRecurringEvent = createTestEvent({
        eventDate: "2024-01-14T10:00:00Z", // 26 hours ago
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.DAILY,
      });

      const result = await filterService.filterEvents([pastRecurringEvent]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(pastRecurringEvent.id);
    });

    test("should filter out events too far in future", async () => {
      const farFutureEvent = createTestEvent({
        eventDate: "2024-02-20T10:00:00Z", // More than 30 days
      });
      const nearFutureEvent = createTestEvent({
        eventDate: "2024-01-20T10:00:00Z", // Within 30 days
      });

      const result = await filterService.filterEvents([
        farFutureEvent,
        nearFutureEvent,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(nearFutureEvent.id);
    });
  });

  describe("Time Scoring", () => {
    test("should give high scores to events happening soon", async () => {
      const soonEvent = createTestEvent({
        eventDate: "2024-01-15T13:00:00Z", // 1 hour from now
      });
      const laterEvent = createTestEvent({
        eventDate: "2024-01-15T16:00:00Z", // 4 hours from now
      });

      const result = await filterService.filterEvents([soonEvent, laterEvent]);

      expect(result).toHaveLength(2);
      expect(result[0].relevanceScore).toBeGreaterThan(
        result[1].relevanceScore,
      );
    });

    test("should handle past events within 24h", async () => {
      const recentPastEvent = createTestEvent({
        eventDate: "2024-01-15T10:00:00Z", // 2 hours ago
      });

      const result = await filterService.filterEvents([recentPastEvent]);

      expect(result).toHaveLength(1);
      expect(result[0].relevanceScore).toBeGreaterThan(0);
    });

    test("should handle recurring events", async () => {
      const recurringEvent = createTestEvent({
        eventDate: "2024-01-14T10:00:00Z", // Past
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.DAILY,
        recurrenceStartDate: "2024-01-14T10:00:00Z",
      });

      const result = await filterService.filterEvents([recurringEvent]);

      expect(result).toHaveLength(1);
      expect(result[0].relevanceScore).toBeGreaterThan(0);
    });
  });

  describe("Popularity Scoring", () => {
    test("should score based on scan and save counts", async () => {
      const lowEngagementEvent = createTestEvent({
        scanCount: 1,
        saveCount: 0,
      });
      const highEngagementEvent = createTestEvent({
        scanCount: 20,
        saveCount: 10,
      });

      const result = await filterService.filterEvents([
        lowEngagementEvent,
        highEngagementEvent,
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].relevanceScore).toBeGreaterThan(
        result[1].relevanceScore,
      );
    });

    test("should apply scarcity boost for few events", async () => {
      const eventWithEngagement = createTestEvent({
        scanCount: 5,
        saveCount: 2,
      });

      const result = await filterService.filterEvents([eventWithEngagement]);

      expect(result).toHaveLength(1);
      expect(result[0].relevanceScore).toBeGreaterThan(0);
    });

    test("should handle RSVPs in popularity calculation", async () => {
      const eventWithRsvps = createTestEvent({
        scanCount: 5,
        saveCount: 2,
        rsvps: [
          {
            id: "rsvp-1",
            userId: "user-1",
            eventId: "test-event-1",
            status: "GOING",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
      });

      const result = await filterService.filterEvents([eventWithRsvps]);

      expect(result).toHaveLength(1);
      expect(result[0].relevanceScore).toBeGreaterThan(0);
    });
  });

  describe("Recency Scoring", () => {
    test("should give higher scores to newer events", async () => {
      const oldEvent = createTestEvent({
        createdAt: "2024-01-10T00:00:00Z", // 5 days ago
      });
      const newEvent = createTestEvent({
        createdAt: "2024-01-15T10:00:00Z", // 2 hours ago
      });

      const result = await filterService.filterEvents([oldEvent, newEvent]);

      expect(result).toHaveLength(2);
      expect(result[0].relevanceScore).toBeGreaterThan(
        result[1].relevanceScore,
      );
    });
  });

  describe("Confidence Scoring", () => {
    test("should use confidence score when available", async () => {
      const highConfidenceEvent = createTestEvent({
        confidenceScore: 0.9,
      });
      const lowConfidenceEvent = createTestEvent({
        confidenceScore: 0.3,
      });

      const result = await filterService.filterEvents([
        highConfidenceEvent,
        lowConfidenceEvent,
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].relevanceScore).toBeGreaterThan(
        result[1].relevanceScore,
      );
    });

    test("should use default confidence for missing scores", async () => {
      const eventWithoutConfidence = createTestEvent({
        confidenceScore: undefined,
      });

      const result = await filterService.filterEvents([eventWithoutConfidence]);

      expect(result).toHaveLength(1);
      expect(result[0].relevanceScore).toBeGreaterThan(0);
    });
  });

  describe("Relative Scoring", () => {
    test("should normalize scores relative to other events", async () => {
      const event1 = createTestEvent({ id: "event-1", scanCount: 10 });
      const event2 = createTestEvent({ id: "event-2", scanCount: 5 });
      const event3 = createTestEvent({ id: "event-3", scanCount: 1 });

      const result = await filterService.filterEvents([event1, event2, event3]);

      expect(result).toHaveLength(3);
      // Should be sorted by relevance score (highest first)
      expect(result[0].relevanceScore).toBeGreaterThan(
        result[1].relevanceScore,
      );
      expect(result[1].relevanceScore).toBeGreaterThan(
        result[2].relevanceScore,
      );
    });

    test("should handle single event", async () => {
      const singleEvent = createTestEvent();

      const result = await filterService.filterEvents([singleEvent]);

      expect(result).toHaveLength(1);
      expect(result[0].relevanceScore).toBeGreaterThan(0);
    });

    test("should handle empty event list", async () => {
      const result = await filterService.filterEvents([]);

      expect(result).toHaveLength(0);
    });
  });

  describe("Clustering", () => {
    beforeEach(() => {
      filterService.updateConfig({
        clusteringEnabled: true,
        minClusterDistance: 0.1, // 100 meters
      });
    });

    test("should remove events that are too close together", async () => {
      const event1 = createTestEvent({
        id: "event-1",
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      });
      const event2 = createTestEvent({
        id: "event-2",
        location: { type: "Point", coordinates: [-122.4195, 37.775] }, // Very close
      });

      const result = await filterService.filterEvents([event1, event2]);

      // Should only keep one event due to clustering
      expect(result).toHaveLength(1);
    });

    test("should keep events that are far enough apart", async () => {
      const event1 = createTestEvent({
        id: "event-1",
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      });
      const event2 = createTestEvent({
        id: "event-2",
        location: { type: "Point", coordinates: [-122.42, 37.78] }, // Further apart
      });

      const result = await filterService.filterEvents([event1, event2]);

      expect(result).toHaveLength(2);
    });
  });

  describe("Max Events Limit", () => {
    test("should respect maxEvents configuration", async () => {
      filterService.updateConfig({ maxEvents: 3 });

      const events = Array.from({ length: 10 }, (_, i) =>
        createTestEvent({
          id: `event-${i}`,
          scanCount: 10 - i, // Decreasing popularity
        }),
      );

      const result = await filterService.filterEvents(events);

      expect(result).toHaveLength(3);
    });
  });

  describe("Edge Cases", () => {
    test("should handle events with missing optional fields", async () => {
      const minimalEvent: Event = {
        id: "minimal-event",
        title: "Minimal Event",
        eventDate: "2024-01-15T14:00:00Z",
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
        scanCount: 0,
        saveCount: 0,
        status: EventStatus.VERIFIED,
        isPrivate: false,
        isRecurring: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      const result = await filterService.filterEvents([minimalEvent]);

      expect(result).toHaveLength(1);
      expect(result[0].relevanceScore).toBeGreaterThan(0);
    });

    test("should handle events with string dates", async () => {
      const stringDateEvent = createTestEvent({
        eventDate: "2024-01-15T14:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      const result = await filterService.filterEvents([stringDateEvent]);

      expect(result).toHaveLength(1);
    });

    test("should handle events with Date objects", async () => {
      const dateObjectEvent = createTestEvent({
        eventDate: new Date("2024-01-15T14:00:00Z"),
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      });

      const result = await filterService.filterEvents([dateObjectEvent]);

      expect(result).toHaveLength(1);
    });
  });

  describe("Integration Tests", () => {
    test("should process complex event set correctly", async () => {
      const events = [
        createTestEvent({
          id: "event-1",
          scanCount: 20,
          saveCount: 10,
          eventDate: "2024-01-15T13:00:00Z", // 1 hour from now
          createdAt: "2024-01-15T10:00:00Z", // Very recent
          confidenceScore: 0.9,
        }),
        createTestEvent({
          id: "event-2",
          scanCount: 5,
          saveCount: 2,
          eventDate: "2024-01-15T16:00:00Z", // 4 hours from now
          createdAt: "2024-01-10T00:00:00Z", // Older
          confidenceScore: 0.7,
        }),
        createTestEvent({
          id: "event-3",
          scanCount: 1,
          saveCount: 0,
          eventDate: "2024-01-15T18:00:00Z", // 6 hours from now
          createdAt: "2024-01-08T00:00:00Z", // Much older
          confidenceScore: 0.5,
        }),
      ];

      const result = await filterService.filterEvents(events);

      expect(result).toHaveLength(3);
      // Should be sorted by relevance score
      expect(result[0].id).toBe("event-1"); // Highest engagement, soonest, most recent
      expect(result[1].id).toBe("event-2"); // Medium engagement
      expect(result[2].id).toBe("event-3"); // Lowest engagement
    });

    test("should handle mixed event types", async () => {
      const events = [
        createTestEvent({
          id: "regular-event",
          isRecurring: false,
        }),
        createTestEvent({
          id: "recurring-event",
          isRecurring: true,
          recurrenceFrequency: RecurrenceFrequency.DAILY,
          eventDate: "2024-01-14T10:00:00Z", // Past but recurring
        }),
        createTestEvent({
          id: "private-event",
          isPrivate: true,
        }),
      ];

      const result = await filterService.filterEvents(events);

      expect(result).toHaveLength(3);
      expect(result.every((event) => event.relevanceScore !== undefined)).toBe(
        true,
      );
    });
  });
});
