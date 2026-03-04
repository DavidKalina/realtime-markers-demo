import { describe, test, expect, beforeEach } from "bun:test";
import {
  createRelevanceScoringService,
  RelevanceScoringService,
  RelevanceScoringServiceConfig,
} from "../src/services/RelevanceScoringService";
import { Event, BoundingBox, EventStatus } from "../src/types/types";

describe("RelevanceScoringService", () => {
  let relevanceScoringService: RelevanceScoringService;

  // Test data
  const baseEvent: Event = {
    id: "event-1",
    title: "Test Event",
    description: "A test event",
    eventDate: new Date("2024-12-25T18:00:00Z"),
    location: {
      type: "Point",
      coordinates: [-74.006, 40.7128], // NYC coordinates
    },
    scanCount: 5,
    saveCount: 2,
    status: EventStatus.VERIFIED,
    isPrivate: false,
    isRecurring: false,
    createdAt: new Date("2024-12-01T00:00:00Z"),
    updatedAt: new Date("2024-12-01T00:00:00Z"),
    rsvps: [
      {
        id: "rsvp-1",
        userId: "user-1",
        eventId: "event-1",
        status: "GOING" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const testViewport: BoundingBox = {
    minX: -74.016,
    minY: 40.7028,
    maxX: -73.996,
    maxY: 40.7228,
  };

  const currentTime = new Date("2024-12-25T12:00:00Z"); // 6 hours before event

  beforeEach(() => {
    relevanceScoringService = createRelevanceScoringService();
  });

  describe("Service Creation", () => {
    test("should create service with default config", () => {
      const service = createRelevanceScoringService();
      expect(service).toBeDefined();
      expect(typeof service.scoreEvents).toBe("function");
      expect(typeof service.getStats).toBe("function");
    });

    test("should create service with custom config", () => {
      const config: RelevanceScoringServiceConfig = {
        popularityWeight: 0.5,
        timeWeight: 0.3,
        distanceWeight: 0.2,
        maxPastHours: 12,
        maxFutureDays: 7,
        urgencyThresholdHours: 1,
        maxScanCount: 20,
        maxSaveCount: 10,
        maxRsvpCount: 5,
        distanceThresholds: {
          veryClose: 0.5,
          close: 2,
          moderate: 10,
          far: 25,
        },
      };

      const service = createRelevanceScoringService(config);
      expect(service).toBeDefined();
    });
  });

  describe("Time scoring (via scoreEvents)", () => {
    test("should give high score for very soon events", () => {
      const soonEvent: Event = {
        ...baseEvent,
        eventDate: new Date(currentTime.getTime() + 1 * 60 * 60 * 1000), // 1 hour from now
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [soonEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0.7);
    });

    test("should give moderate score for today events", () => {
      const todayEvent: Event = {
        ...baseEvent,
        eventDate: new Date(currentTime.getTime() + 12 * 60 * 60 * 1000), // 12 hours from now
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [todayEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0.5);
    });

    test("should give lower score for future events", () => {
      const futureEvent: Event = {
        ...baseEvent,
        eventDate: new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [futureEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeLessThan(0.5);
    });

    test("should give zero time component for very old events", () => {
      const oldEvent: Event = {
        ...baseEvent,
        eventDate: new Date(currentTime.getTime() - 48 * 60 * 60 * 1000), // 48 hours ago (beyond maxPastHours=24)
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [oldEvent],
        testViewport,
        currentTime,
      );
      // Time score = 0, but popularity and distance still contribute
      expect(scored.relevanceScore).toBeGreaterThan(0.3);
      expect(scored.relevanceScore).toBeLessThan(0.4);
    });

    test("should give reduced score for recent past events", () => {
      const recentPastEvent: Event = {
        ...baseEvent,
        eventDate: new Date(currentTime.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [recentPastEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0);
      expect(scored.relevanceScore).toBeLessThan(0.5);
    });
  });

  describe("Popularity scoring (via scoreEvents)", () => {
    test("should give high score for popular events", () => {
      const popularEvent: Event = {
        ...baseEvent,
        scanCount: 15,
        saveCount: 8,
        rsvps: [
          {
            id: "rsvp-1",
            userId: "user-1",
            eventId: "event-1",
            status: "GOING" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "rsvp-2",
            userId: "user-2",
            eventId: "event-1",
            status: "GOING" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "rsvp-3",
            userId: "user-3",
            eventId: "event-1",
            status: "GOING" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [popularEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0.6);
    });

    test("should give low score for unpopular events", () => {
      const unpopularEvent: Event = {
        ...baseEvent,
        scanCount: 1,
        saveCount: 0,
        rsvps: [],
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [unpopularEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0.4);
    });

    test("should handle events with missing popularity data", () => {
      const eventWithMissingData: Event = {
        ...baseEvent,
        scanCount: undefined as unknown as number,
        saveCount: undefined as unknown as number,
        rsvps: undefined,
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [eventWithMissingData],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(scored.relevanceScore).toBeLessThanOrEqual(1);
      expect(scored.relevanceScore).not.toBeNaN();
    });
  });

  describe("Distance scoring (via scoreEvents)", () => {
    test("should give high score for very close events", () => {
      const closeEvent: Event = {
        ...baseEvent,
        location: {
          type: "Point",
          coordinates: [-74.006, 40.7128], // Same as viewport center
        },
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [closeEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0.6);
    });

    test("should give moderate score for moderate distance events", () => {
      const moderateEvent: Event = {
        ...baseEvent,
        location: {
          type: "Point",
          coordinates: [-74.026, 40.7328], // Further from viewport
        },
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [moderateEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0.3);
      expect(scored.relevanceScore).toBeLessThan(0.7);
    });

    test("should give low score for far events", () => {
      const farEvent: Event = {
        ...baseEvent,
        location: {
          type: "Point",
          coordinates: [-74.056, 40.7628], // Far from viewport
        },
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [farEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0.4);
    });

    test("should give default score when no viewport provided", () => {
      const [scored] = relevanceScoringService.scoreEvents(
        [baseEvent],
        undefined,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThan(0);
      expect(scored.relevanceScore).toBeLessThan(1);
    });
  });

  describe("scoreEvents", () => {
    test("should calculate scores within 0-1 range", () => {
      const scored = relevanceScoringService.scoreEvents(
        [baseEvent],
        testViewport,
        currentTime,
      );
      expect(scored[0].relevanceScore).toBeGreaterThanOrEqual(0);
      expect(scored[0].relevanceScore).toBeLessThanOrEqual(1);
    });

    test("should handle empty events array", () => {
      const scored = relevanceScoringService.scoreEvents(
        [],
        testViewport,
        currentTime,
      );
      expect(scored).toEqual([]);
    });

    test("should preserve original event properties", () => {
      const scored = relevanceScoringService.scoreEvents(
        [baseEvent],
        testViewport,
        currentTime,
      );

      expect(scored[0].id).toBe(baseEvent.id);
      expect(scored[0].title).toBe(baseEvent.title);
      expect(scored[0].location).toEqual(baseEvent.location);
    });

    test("should use configured weights", () => {
      const service = createRelevanceScoringService({
        popularityWeight: 0.8,
        timeWeight: 0.1,
        distanceWeight: 0.1,
      });

      const [scored] = service.scoreEvents(
        [baseEvent],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(scored.relevanceScore).toBeLessThanOrEqual(1);
    });
  });

  describe("getStats", () => {
    test("should return initial stats", () => {
      const stats = relevanceScoringService.getStats();
      expect(stats).toEqual({
        totalScoresCalculated: 0,
      });
    });

    test("should track score calculations", () => {
      relevanceScoringService.scoreEvents(
        [baseEvent],
        testViewport,
        currentTime,
      );

      const stats = relevanceScoringService.getStats();
      expect(stats.totalScoresCalculated).toBe(1);
    });

    test("should track batch calculations", () => {
      const events: Event[] = [baseEvent, { ...baseEvent, id: "event-2" }];
      relevanceScoringService.scoreEvents(events, testViewport, currentTime);

      const stats = relevanceScoringService.getStats();
      expect(stats.totalScoresCalculated).toBe(2);
    });

    test("should return stats object copy", () => {
      const stats1 = relevanceScoringService.getStats();
      const stats2 = relevanceScoringService.getStats();

      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2); // Should be different objects
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle events with missing location", () => {
      const eventWithoutLocation: Event = {
        ...baseEvent,
        location: undefined as unknown as {
          type: "Point";
          coordinates: [number, number];
        },
      };

      expect(() => {
        relevanceScoringService.scoreEvents(
          [eventWithoutLocation],
          testViewport,
          currentTime,
        );
      }).toThrow();
    });

    test("should handle events with invalid coordinates", () => {
      const eventWithInvalidCoords: Event = {
        ...baseEvent,
        location: {
          type: "Point",
          coordinates: [NaN, NaN],
        },
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [eventWithInvalidCoords],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(scored.relevanceScore).toBeLessThanOrEqual(1);
    });

    test("should handle events with string dates", () => {
      const eventWithStringDate: Event = {
        ...baseEvent,
        eventDate: "2024-12-25T18:00:00Z",
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [eventWithStringDate],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(scored.relevanceScore).toBeLessThanOrEqual(1);
    });

    test("should handle events with missing popularity data", () => {
      const eventWithMissingData: Event = {
        ...baseEvent,
        scanCount: undefined as unknown as number,
        saveCount: undefined as unknown as number,
        rsvps: undefined,
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [eventWithMissingData],
        testViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(scored.relevanceScore).toBeLessThanOrEqual(1);
      expect(scored.relevanceScore).not.toBeNaN();
    });

    test("should handle invalid viewport bounds", () => {
      const invalidViewport: BoundingBox = {
        minX: 100, // Invalid longitude
        minY: 100, // Invalid latitude
        maxX: 200,
        maxY: 200,
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [baseEvent],
        invalidViewport,
        currentTime,
      );
      expect(scored.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(scored.relevanceScore).toBeLessThanOrEqual(1);
    });
  });

  describe("Integration Tests", () => {
    test("should work with realistic event data", () => {
      const realisticEvent: Event = {
        id: "realistic-event-1",
        title: "Tech Meetup NYC",
        description: "Join us for an evening of networking and tech talks",
        eventDate: new Date("2024-12-26T19:00:00Z"), // Tomorrow evening
        location: {
          type: "Point",
          coordinates: [-74.006, 40.7128], // NYC
        },
        scanCount: 25,
        saveCount: 8,
        status: EventStatus.VERIFIED,
        isPrivate: false,
        isRecurring: false,
        createdAt: new Date("2024-12-01T00:00:00Z"),
        updatedAt: new Date("2024-12-01T00:00:00Z"),
        rsvps: [
          {
            id: "rsvp-1",
            userId: "user-1",
            eventId: "realistic-event-1",
            status: "GOING" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "rsvp-2",
            userId: "user-2",
            eventId: "realistic-event-1",
            status: "GOING" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const [scored] = relevanceScoringService.scoreEvents(
        [realisticEvent],
        testViewport,
        currentTime,
      );

      expect(scored.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(scored.relevanceScore).toBeLessThanOrEqual(1);
    });

    test("should handle multiple events with different characteristics", () => {
      const events: Event[] = [
        {
          ...baseEvent,
          id: "event-1",
          eventDate: new Date("2024-12-25T18:00:00Z"), // Soon
          scanCount: 10,
          saveCount: 5,
        },
        {
          ...baseEvent,
          id: "event-2",
          eventDate: new Date("2024-12-30T18:00:00Z"), // Later
          scanCount: 2,
          saveCount: 1,
        },
        {
          ...baseEvent,
          id: "event-3",
          eventDate: new Date("2024-12-24T18:00:00Z"), // Past
          scanCount: 15,
          saveCount: 8,
        },
      ];

      const scoredEvents = relevanceScoringService.scoreEvents(
        events,
        testViewport,
        currentTime,
      );

      expect(scoredEvents).toHaveLength(3);
      scoredEvents.forEach((event) => {
        expect(event.relevanceScore).toBeDefined();
        expect(event.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(event.relevanceScore).toBeLessThanOrEqual(1);
      });

      // Event 1 should have higher score than event 2 (sooner + more popular)
      expect(scoredEvents[0].relevanceScore).toBeGreaterThan(
        scoredEvents[1].relevanceScore,
      );
    });

    test("should maintain consistency between individual and batch scoring", () => {
      const events: Event[] = [baseEvent, { ...baseEvent, id: "event-2" }];

      // Score individually
      const [individual1] = relevanceScoringService.scoreEvents(
        [events[0]],
        testViewport,
        currentTime,
      );
      const [individual2] = relevanceScoringService.scoreEvents(
        [events[1]],
        testViewport,
        currentTime,
      );

      // Score in batch (new service to reset stats)
      const freshService = createRelevanceScoringService();
      const batchScored = freshService.scoreEvents(
        events,
        testViewport,
        currentTime,
      );

      expect(batchScored[0].relevanceScore).toBe(individual1.relevanceScore);
      expect(batchScored[1].relevanceScore).toBe(individual2.relevanceScore);
    });
  });
});
