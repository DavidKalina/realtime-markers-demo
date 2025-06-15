import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { EventProcessor } from "../src/handlers/EventProcessor";
import { createEventInitializationService } from "../src/services/EventInitializationService";
import {
  DayOfWeek,
  EventStatus,
  RecurrenceFrequency,
} from "../src/types/types";

describe("EventInitializationService", () => {
  // Mock dependencies
  let mockEventProcessor: EventProcessor;
  let eventInitializationService: ReturnType<
    typeof createEventInitializationService
  >;

  // Test data
  const mockApiResponse = {
    events: [
      {
        id: "event-1",
        title: "Test Event 1",
        description: "A test event",
        location: { coordinates: [-122.4194, 37.7749] },
        eventDate: "2024-01-15T14:00:00Z",
        start_date: "2024-01-15T14:00:00Z",
        end_date: "2024-01-15T16:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        status: "VERIFIED",
        isPrivate: false,
        creatorId: "user-1",
        scanCount: 5,
        saveCount: 2,
        categories: [{ name: "Music" }],
        isRecurring: false,
      },
      {
        id: "event-2",
        title: "Test Event 2",
        description: "Another test event",
        location: { coordinates: [-122.4, 37.78] },
        startDate: "2024-01-16T10:00:00Z",
        endDate: "2024-01-16T12:00:00Z",
        createdAt: "2024-01-02T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        status: "PENDING",
        isPrivate: true,
        creatorId: "user-2",
        scanCount: 3,
        saveCount: 1,
        categories: [{ name: "Sports" }],
        isRecurring: true,
        recurrenceFrequency: "WEEKLY",
        recurrenceDays: ["MONDAY", "WEDNESDAY"],
        recurrenceStartDate: "2024-01-16T10:00:00Z",
        recurrenceEndDate: "2024-02-16T10:00:00Z",
        recurrenceInterval: 1,
        recurrenceTime: "10:00:00",
        rsvps: [
          {
            id: "rsvp-1",
            userId: "user-3",
            eventId: "event-2",
            status: "GOING",
            createdAt: "2024-01-03T00:00:00Z",
            updatedAt: "2024-01-03T00:00:00Z",
          },
        ],
      },
      {
        id: "event-3",
        title: "Invalid Event",
        description: "Event without location",
        // Missing location coordinates - should be filtered out
      },
    ],
    hasMore: false,
  };

  beforeEach(() => {
    // Create mock EventProcessor
    mockEventProcessor = {
      processEvent: mock(() => Promise.resolve()),
    } as unknown as EventProcessor;

    // Create the service instance
    eventInitializationService = createEventInitializationService(
      mockEventProcessor,
      {
        backendUrl: "http://test-backend:3000",
        pageSize: 50,
        maxRetries: 2,
        retryDelay: 100,
      },
    );

    // Mock global fetch
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response),
    ) as unknown as typeof fetch;

    // Reset console spies
    spyOn(console, "log").mockRestore();
    spyOn(console, "error").mockRestore();
  });

  describe("Constructor and Configuration", () => {
    test("should create service with default configuration", () => {
      const service = createEventInitializationService(mockEventProcessor);

      expect(service).toBeDefined();
      expect(typeof service.initializeEvents).toBe("function");
      expect(typeof service.clearAllEvents).toBe("function");
      expect(typeof service.getStats).toBe("function");
    });

    test("should create service with custom configuration", () => {
      const customConfig = {
        backendUrl: "http://custom-backend:8080",
        pageSize: 200,
        maxRetries: 5,
        retryDelay: 2000,
      };

      const service = createEventInitializationService(
        mockEventProcessor,
        customConfig,
      );

      expect(service).toBeDefined();
    });

    test("should use environment variable for backend URL when not provided", () => {
      const originalEnv = process.env.BACKEND_URL;
      (process.env as NodeJS.ProcessEnv).BACKEND_URL =
        "http://env-backend:4000";

      const service = createEventInitializationService(mockEventProcessor);

      expect(service).toBeDefined();
      (process.env as NodeJS.ProcessEnv).BACKEND_URL = originalEnv;
    });
  });

  describe("initializeEvents", () => {
    test("should successfully initialize events", async () => {
      const consoleSpy = spyOn(console, "log");

      await eventInitializationService.initializeEvents();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-backend:3000/api/internal/events?limit=50&offset=0",
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      expect(mockEventProcessor.processEvent).toHaveBeenCalledTimes(2); // Only 2 valid events
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Initializing events...",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Received 2 events for initialization",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Events initialization complete",
      );
    });

    test("should handle API errors gracefully", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response),
      ) as unknown as typeof fetch;

      const consoleSpy = spyOn(console, "error");

      await eventInitializationService.initializeEvents();

      // The service logs error messages during retries and then stops pagination
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 2/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Max API retries reached for page",
        1,
      );
    });

    test("should handle fetch errors", async () => {
      global.fetch = mock(() =>
        Promise.reject(new Error("Network error")),
      ) as unknown as typeof fetch;

      const consoleSpy = spyOn(console, "error");

      await eventInitializationService.initializeEvents();

      // The service logs error messages during retries and then stops pagination
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 2/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Max API retries reached for page",
        1,
      );
    });

    test("should handle invalid API response format", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ invalid: "format" }),
        } as Response),
      ) as unknown as typeof fetch;

      const consoleSpy = spyOn(console, "error");

      await eventInitializationService.initializeEvents();

      // The service logs error messages during retries and then stops pagination
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 2/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Max API retries reached for page",
        1,
      );
    });

    test("should handle processing errors", async () => {
      mockEventProcessor.processEvent = mock(() =>
        Promise.reject(new Error("Processing error")),
      );

      const consoleSpy = spyOn(console, "error");

      await eventInitializationService.initializeEvents();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Error processing events batch:",
        expect.any(Error),
      );
    });
  });

  describe("fetchAllEvents", () => {
    test("should handle pagination correctly", async () => {
      const multiPageResponse = {
        events: [
          {
            id: "event-1",
            title: "Page 1 Event",
            location: { coordinates: [-122.4194, 37.7749] },
            eventDate: "2024-01-15T14:00:00Z",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
        hasMore: true,
      };

      const finalPageResponse = {
        events: [
          {
            id: "event-2",
            title: "Page 2 Event",
            location: { coordinates: [-122.4, 37.78] },
            eventDate: "2024-01-16T14:00:00Z",
            created_at: "2024-01-02T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ],
        hasMore: false,
      };

      let callCount = 0;
      global.fetch = mock(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              callCount === 1 ? multiPageResponse : finalPageResponse,
            ),
        } as Response);
      }) as unknown as typeof fetch;

      await eventInitializationService.initializeEvents();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        "http://test-backend:3000/api/internal/events?limit=50&offset=0",
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "http://test-backend:3000/api/internal/events?limit=50&offset=50",
        expect.any(Object),
      );
    });

    test("should retry on API failures", async () => {
      let attemptCount = 0;
      global.fetch = mock(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error("Temporary error"));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        } as Response);
      }) as unknown as typeof fetch;

      const consoleSpy = spyOn(console, "error");

      await eventInitializationService.initializeEvents();

      // After 2 failed attempts, the service stops pagination
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 2/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Max API retries reached for page",
        1,
      );
    });

    test("should stop pagination on persistent failure", async () => {
      global.fetch = mock(() =>
        Promise.reject(new Error("Persistent error")),
      ) as unknown as typeof fetch;

      const consoleSpy = spyOn(console, "error");

      await eventInitializationService.initializeEvents();

      expect(global.fetch).toHaveBeenCalledTimes(2); // maxRetries = 2
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 2/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Max API retries reached for page",
        1,
      );
    });

    test("should filter out events without location coordinates", async () => {
      await eventInitializationService.initializeEvents();

      // Only 2 events should be processed (event-1 and event-2)
      // event-3 has no location coordinates and should be filtered out
      expect(mockEventProcessor.processEvent).toHaveBeenCalledTimes(2);
    });

    test("should handle duplicate events", async () => {
      const duplicateResponse = {
        events: [
          {
            id: "event-1",
            title: "Duplicate Event",
            location: { coordinates: [-122.4194, 37.7749] },
            eventDate: "2024-01-15T14:00:00Z",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          {
            id: "event-1", // Same ID
            title: "Same Event Different Data",
            location: { coordinates: [-122.4194, 37.7749] },
            eventDate: "2024-01-15T14:00:00Z",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
        hasMore: false,
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(duplicateResponse),
        } as Response),
      ) as unknown as typeof fetch;

      await eventInitializationService.initializeEvents();

      // Should only process one event (duplicate removed)
      expect(mockEventProcessor.processEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe("normalizeEventData", () => {
    test("should normalize event with all fields", async () => {
      const complexEvent = {
        id: "complex-event",
        emoji: "🎵",
        title: "Complex Event",
        description: "A complex event with all fields",
        location: { coordinates: [-122.4194, 37.7749] },
        eventDate: "2024-01-15T14:00:00Z",
        endDate: "2024-01-15T16:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        categories: [{ name: "Music" }, { name: "Concert" }],
        embedding: "embedding-data",
        status: "VERIFIED",
        isPrivate: false,
        creatorId: "user-1",
        sharedWith: [{ sharedWithId: "user-2" }],
        scanCount: 10,
        saveCount: 5,
        confidenceScore: 0.95,
        timezone: "America/Los_Angeles",
        address: "123 Main St, San Francisco, CA",
        locationNotes: "Near the park",
        isRecurring: true,
        recurrenceFrequency: "WEEKLY",
        recurrenceDays: ["MONDAY", "WEDNESDAY"],
        recurrenceStartDate: "2024-01-15T14:00:00Z",
        recurrenceEndDate: "2024-02-15T14:00:00Z",
        recurrenceInterval: 1,
        recurrenceTime: "14:00:00",
        recurrenceExceptions: ["2024-01-22T14:00:00Z"],
        rsvps: [
          {
            id: "rsvp-1",
            userId: "user-3",
            eventId: "complex-event",
            status: "GOING",
            createdAt: "2024-01-03T00:00:00Z",
            updatedAt: "2024-01-03T00:00:00Z",
          },
        ],
      };

      const response = {
        events: [complexEvent],
        hasMore: false,
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        } as Response),
      ) as unknown as typeof fetch;

      await eventInitializationService.initializeEvents();

      expect(mockEventProcessor.processEvent).toHaveBeenCalledWith({
        operation: "CREATE",
        record: expect.objectContaining({
          id: "complex-event",
          emoji: "🎵",
          title: "Complex Event",
          description: "A complex event with all fields",
          location: {
            type: "Point",
            coordinates: [-122.4194, 37.7749],
          },
          eventDate: "2024-01-15T14:00:00Z",
          endDate: "2024-01-15T16:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          categories: [
            { id: "Music", name: "Music" },
            { id: "Concert", name: "Concert" },
          ],
          embedding: "embedding-data",
          status: EventStatus.VERIFIED,
          isPrivate: false,
          creatorId: "user-1",
          sharedWith: [{ sharedWithId: "user-2", sharedById: "user-1" }],
          scanCount: 10,
          saveCount: 5,
          confidenceScore: 0.95,
          timezone: "America/Los_Angeles",
          address: "123 Main St, San Francisco, CA",
          locationNotes: "Near the park",
          isRecurring: true,
          recurrenceFrequency: RecurrenceFrequency.WEEKLY,
          recurrenceDays: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
          recurrenceStartDate: "2024-01-15T14:00:00Z",
          recurrenceEndDate: "2024-02-15T14:00:00Z",
          recurrenceInterval: 1,
          recurrenceTime: "14:00:00",
          recurrenceExceptions: ["2024-01-22T14:00:00Z"],
          rsvps: [
            {
              id: "rsvp-1",
              userId: "user-3",
              eventId: "complex-event",
              status: "GOING",
              createdAt: "2024-01-03T00:00:00Z",
              updatedAt: "2024-01-03T00:00:00Z",
            },
          ],
        }),
      });
    });

    test("should handle missing optional fields", async () => {
      const minimalEvent = {
        id: "minimal-event",
        title: "Minimal Event",
        location: { coordinates: [-122.4194, 37.7749] },
      };

      const response = {
        events: [minimalEvent],
        hasMore: false,
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        } as Response),
      ) as unknown as typeof fetch;

      await eventInitializationService.initializeEvents();

      expect(mockEventProcessor.processEvent).toHaveBeenCalledWith({
        operation: "CREATE",
        record: expect.objectContaining({
          id: "minimal-event",
          title: "Minimal Event",
          location: {
            type: "Point",
            coordinates: [-122.4194, 37.7749],
          },
          eventDate: expect.any(String), // Should use current date
          createdAt: expect.any(String), // Should use current date
          updatedAt: expect.any(String), // Should use current date
          categories: [],
          status: EventStatus.VERIFIED, // Default status
          isPrivate: false, // Default value
          scanCount: 0, // Default value
          saveCount: 0, // Default value
          isRecurring: false, // Default value
          sharedWith: [],
          rsvps: [],
        }),
      });
    });

    test("should handle alternative field names", async () => {
      const alternativeFieldsEvent = {
        id: "alt-fields-event",
        title: "Alternative Fields Event",
        location: { coordinates: [-122.4194, 37.7749] },
        start_date: "2024-01-15T14:00:00Z", // Alternative to eventDate
        startDate: "2024-01-16T14:00:00Z", // Alternative to eventDate
        end_date: "2024-01-15T16:00:00Z", // Alternative to endDate
        created_at: "2024-01-01T00:00:00Z", // Alternative to createdAt
        updated_at: "2024-01-01T00:00:00Z", // Alternative to updatedAt
      };

      const response = {
        events: [alternativeFieldsEvent],
        hasMore: false,
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        } as Response),
      ) as unknown as typeof fetch;

      await eventInitializationService.initializeEvents();

      expect(mockEventProcessor.processEvent).toHaveBeenCalledWith({
        operation: "CREATE",
        record: expect.objectContaining({
          id: "alt-fields-event",
          title: "Alternative Fields Event",
          eventDate: "2024-01-15T14:00:00Z", // Should use start_date first
          endDate: "2024-01-15T16:00:00Z", // Should use end_date
          createdAt: "2024-01-01T00:00:00Z", // Should use created_at
          updatedAt: "2024-01-01T00:00:00Z", // Should use updated_at
        }),
      });
    });
  });

  describe("clearAllEvents", () => {
    test("should log clearing message", () => {
      const consoleSpy = spyOn(console, "log");

      eventInitializationService.clearAllEvents();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Clearing all events",
      );
    });
  });

  describe("getStats", () => {
    test("should return initial stats", () => {
      const stats = eventInitializationService.getStats();

      expect(stats).toEqual({
        eventsFetched: 0,
        eventsProcessed: 0,
        apiCalls: 0,
        apiErrors: 0,
        retries: 0,
        lastInitializationTime: 0,
      });
    });

    test("should update stats after successful initialization", async () => {
      await eventInitializationService.initializeEvents();

      const stats = eventInitializationService.getStats();

      expect(stats.eventsFetched).toBe(2); // 2 valid events
      expect(stats.eventsProcessed).toBe(2);
      expect(stats.apiCalls).toBe(1);
      expect(stats.apiErrors).toBe(0);
      expect(stats.retries).toBe(0);
      expect(stats.lastInitializationTime).toBeGreaterThan(0);
    });

    test("should track API errors and retries", async () => {
      let attemptCount = 0;
      global.fetch = mock(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error("Temporary error"));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        } as Response);
      }) as unknown as typeof fetch;

      await eventInitializationService.initializeEvents();

      const stats = eventInitializationService.getStats();

      expect(stats.apiErrors).toBe(1);
      expect(stats.retries).toBe(1);
      expect(stats.eventsFetched).toBe(2);
      expect(stats.eventsProcessed).toBe(2);
    });
  });

  describe("Configuration Options", () => {
    test("should use custom page size", async () => {
      const customService = createEventInitializationService(
        mockEventProcessor,
        { pageSize: 25 },
      );

      await customService.initializeEvents();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://backend:3000/api/internal/events?limit=25&offset=0",
        expect.any(Object),
      );
    });

    test("should use custom retry settings", async () => {
      const customService = createEventInitializationService(
        mockEventProcessor,
        { maxRetries: 1, retryDelay: 50 },
      );

      global.fetch = mock(() =>
        Promise.reject(new Error("Error")),
      ) as unknown as typeof fetch;

      const consoleSpy = spyOn(console, "error");

      await customService.initializeEvents();

      expect(global.fetch).toHaveBeenCalledTimes(1); // Only 1 retry attempt
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1/1 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Max API retries reached for page",
        1,
      );
    });

    test("should use custom backend URL", async () => {
      const customService = createEventInitializationService(
        mockEventProcessor,
        { backendUrl: "http://custom-api:8080" },
      );

      await customService.initializeEvents();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://custom-api:8080/api/internal/events?limit=100&offset=0",
        expect.any(Object),
      );
    });
  });

  describe("Error Handling Edge Cases", () => {
    test("should handle empty events array", async () => {
      const emptyResponse = {
        events: [],
        hasMore: false,
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(emptyResponse),
        } as Response),
      ) as unknown as typeof fetch;

      await eventInitializationService.initializeEvents();

      expect(mockEventProcessor.processEvent).not.toHaveBeenCalled();
      expect(eventInitializationService.getStats().eventsFetched).toBe(0);
      expect(eventInitializationService.getStats().eventsProcessed).toBe(0);
    });

    test("should handle malformed event data", async () => {
      const malformedResponse = {
        events: [
          {
            id: "malformed-event",
            // Missing required fields like title and location
          },
        ],
        hasMore: false,
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(malformedResponse),
        } as Response),
      ) as unknown as typeof fetch;

      await eventInitializationService.initializeEvents();

      // Events without location coordinates should be filtered out, not cause errors
      expect(mockEventProcessor.processEvent).not.toHaveBeenCalled();
      expect(eventInitializationService.getStats().eventsFetched).toBe(0);
      expect(eventInitializationService.getStats().eventsProcessed).toBe(0);
    });

    test("should handle network timeout", async () => {
      global.fetch = mock(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100),
          ),
      ) as unknown as typeof fetch;

      const consoleSpy = spyOn(console, "error");

      await eventInitializationService.initializeEvents();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 2/2 failed for page 1:"),
        expect.any(Error),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Max API retries reached for page",
        1,
      );
    });
  });

  describe("Production vs Development Logging", () => {
    test("should log initialization messages", async () => {
      const consoleSpy = spyOn(console, "log");

      await eventInitializationService.initializeEvents();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Initializing events...",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Received 2 events for initialization",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EventInitialization] Events initialization complete",
      );
    });
  });
});
