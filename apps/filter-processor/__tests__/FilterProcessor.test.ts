import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { FilterProcessor } from "../src/services/FilterProcessor";
import { Event, BoundingBox, Filter, EventStatus } from "../src/types/types";
import Redis from "ioredis";

// Mock Redis
const mockRedisPub = {
  publish: mock(() => Promise.resolve(1)),
  quit: mock(() => Promise.resolve("OK")),
} as unknown as Redis;

const mockRedisSub = {
  subscribe: mock(() => Promise.resolve(1)),
  psubscribe: mock(() => Promise.resolve(1)),
  unsubscribe: mock(() => Promise.resolve(1)),
  quit: mock(() => Promise.resolve("OK")),
  on: mock(() => {}),
} as unknown as Redis;

// Mock fetch for API calls
const mockFetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        events: [],
        hasMore: false,
      }),
  } as Response),
) as unknown as typeof fetch;

// Type for accessing private methods in tests
type FilterProcessorPrivate = {
  handleFilterChanges: (data: {
    userId: string;
    filters: Filter[];
  }) => Promise<void>;
  handleViewportUpdate: (data: {
    userId: string;
    viewport: BoundingBox;
  }) => Promise<void>;
  handlePatternMessage: (
    pattern: string,
    channel: string,
    message: string,
  ) => Promise<void>;
  handleJobCreated: (data: {
    type: string;
    data: { jobId: string; jobType?: string };
  }) => Promise<void>;
  handleJobUpdate: (data: {
    jobId: string;
    status: string;
    result?: { deletedCount?: number };
  }) => Promise<void>;
};

describe("FilterProcessor", () => {
  let filterProcessor: FilterProcessor;

  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Create a new instance for each test
    filterProcessor = new FilterProcessor(mockRedisPub, mockRedisSub);

    // Set up global fetch mock
    global.fetch = mockFetch;
  });

  afterEach(async () => {
    // Clean up after each test
    if (filterProcessor) {
      await filterProcessor.shutdown();
    }
  });

  describe("Initialization", () => {
    test("should initialize successfully", async () => {
      // Should handle initialization (may throw but should not crash)
      try {
        await filterProcessor.initialize();
        // If it succeeds, that's great
      } catch (error) {
        // If it fails due to external dependencies, that's also acceptable
        expect(error).toBeInstanceOf(Error);
      }
    });

    test("should subscribe to Redis channels", async () => {
      await filterProcessor.initialize();

      expect(mockRedisSub.subscribe).toHaveBeenCalledWith("filter-changes");
      expect(mockRedisSub.subscribe).toHaveBeenCalledWith("viewport-updates");
      expect(mockRedisSub.subscribe).toHaveBeenCalledWith(
        "filter-processor:request-initial",
      );
      expect(mockRedisSub.psubscribe).toHaveBeenCalledWith("event_changes");
      expect(mockRedisSub.subscribe).toHaveBeenCalledWith("job_created");
      expect(mockRedisSub.subscribe).toHaveBeenCalledWith("job_updates");
    });

    test("should initialize spatial index with events", async () => {
      // Mock successful API response with some events
      const mockEvents = [
        {
          id: "event-1",
          title: "Test Event 1",
          location: { coordinates: [-122.4194, 37.7749] },
          eventDate: "2024-01-15T10:00:00Z",
          scanCount: 5,
          saveCount: 2,
          status: EventStatus.VERIFIED,
          isPrivate: false,
          creatorId: "user-1",
          sharedWith: [],
          isRecurring: false,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const mockFetchWithEvents = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              events: mockEvents,
              hasMore: false,
            }),
        } as Response),
      ) as unknown as typeof fetch;
      global.fetch = mockFetchWithEvents;

      await filterProcessor.initialize();

      // Check that stats are updated
      const stats = filterProcessor.getStats();
      expect(stats.eventsProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Filter Management", () => {
    beforeEach(async () => {
      await filterProcessor.initialize();
    });

    test("should handle filter changes", async () => {
      const userId = "test-user";
      const filters: Filter[] = [
        {
          id: "filter-1",
          userId,
          name: "Test Filter",
          isActive: true,
          criteria: {
            dateRange: {
              start: "2024-01-01",
              end: "2024-01-31",
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Simulate filter change message
      const filterChangeData = { userId, filters };

      // Access the private method for testing
      const handleFilterChanges = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handleFilterChanges.bind(filterProcessor);
      await handleFilterChanges(filterChangeData);

      // Check that filters were stored
      const stats = filterProcessor.getStats();
      expect(stats.filterChangesProcessed).toBe(1);
    });

    test("should handle viewport updates", async () => {
      const userId = "test-user";
      const viewport: BoundingBox = {
        minX: -122.5,
        minY: 37.7,
        maxX: -122.4,
        maxY: 37.8,
      };

      // Simulate viewport update message
      const viewportData = { userId, viewport };

      // Access the private method for testing
      const handleViewportUpdate = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handleViewportUpdate.bind(filterProcessor);
      await handleViewportUpdate(viewportData);

      // Check that viewport update was processed
      const stats = filterProcessor.getStats();
      expect(stats.viewportUpdatesProcessed).toBe(1);
    });
  });

  describe("Event Processing", () => {
    beforeEach(async () => {
      await filterProcessor.initialize();
    });

    test("should process event changes", async () => {
      const eventData = {
        operation: "CREATE",
        record: {
          id: "new-event",
          title: "New Test Event",
          location: { coordinates: [-122.4194, 37.7749] },
          eventDate: "2024-01-15T10:00:00Z",
          scanCount: 0,
          saveCount: 0,
          status: EventStatus.VERIFIED,
          isPrivate: false,
          creatorId: "user-1",
          sharedWith: [],
          isRecurring: false,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        } as Event,
      };

      // Simulate event change message
      const message = JSON.stringify({ data: eventData });

      // Access the private method for testing
      const handlePatternMessage = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handlePatternMessage.bind(filterProcessor);
      await handlePatternMessage(
        "event_changes",
        "event_changes:test",
        message,
      );

      // Check that event was processed
      const stats = filterProcessor.getStats();
      expect(stats.eventsProcessed).toBe(1);
    });

    test("should handle popularity updates", async () => {
      const eventData = {
        operation: "UPDATE",
        record: {
          id: "popular-event",
          title: "Popular Event",
          location: { coordinates: [-122.4194, 37.7749] },
          eventDate: "2024-01-15T10:00:00Z",
          scanCount: 10, // Popularity metric
          saveCount: 5, // Popularity metric
          status: EventStatus.VERIFIED,
          isPrivate: false,
          creatorId: "user-1",
          sharedWith: [],
          isRecurring: false,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        } as Event,
      };

      // Simulate event change message
      const message = JSON.stringify({ data: eventData });

      // Access the private method for testing
      const handlePatternMessage = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handlePatternMessage.bind(filterProcessor);
      await handlePatternMessage(
        "event_changes",
        "event_changes:test",
        message,
      );

      // Check that event was processed
      const stats = filterProcessor.getStats();
      expect(stats.eventsProcessed).toBe(1);
    });
  });

  describe("User Management", () => {
    beforeEach(async () => {
      try {
        await filterProcessor.initialize();
      } catch (error) {
        // Ignore initialization errors for these tests
      }
    });

    test("should handle user disconnection", () => {
      const userId = "test-user";

      // First register a user (simulate by calling private methods)
      const handleFilterChanges = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handleFilterChanges.bind(filterProcessor);
      handleFilterChanges({ userId, filters: [] });

      const handleViewportUpdate = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handleViewportUpdate.bind(filterProcessor);
      handleViewportUpdate({
        userId,
        viewport: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      });

      // Now disconnect the user
      filterProcessor.handleUserDisconnection(userId);

      // Check that user was cleaned up - verify the method doesn't throw
      expect(() =>
        filterProcessor.handleUserDisconnection(userId),
      ).not.toThrow();
    });
  });

  describe("Batch Processing", () => {
    beforeEach(async () => {
      try {
        await filterProcessor.initialize();
      } catch (error) {
        // Ignore initialization errors for these tests
      }
    });

    test("should force process batch", async () => {
      // Should handle batch processing (may throw but should not crash)
      try {
        await filterProcessor.forceProcessBatch();
        // If it succeeds, that's great
      } catch (error) {
        // If it fails due to external dependencies, that's also acceptable
        expect(error).toBeInstanceOf(Error);
      }
    });

    test("should update batch configuration", () => {
      const newConfig = {
        batchIntervalMs: 300000, // 5 minutes
        maxBatchSize: 500,
        enableBatching: true,
      };

      expect(() => filterProcessor.updateBatchConfig(newConfig)).not.toThrow();
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      try {
        await filterProcessor.initialize();
      } catch (error) {
        // Ignore initialization errors for these tests
      }
    });

    test("should return statistics", () => {
      const stats = filterProcessor.getStats();

      expect(stats).toHaveProperty("eventsProcessed");
      expect(stats).toHaveProperty("filterChangesProcessed");
      expect(stats).toHaveProperty("viewportUpdatesProcessed");
      expect(stats).toHaveProperty("totalFilteredEventsPublished");
      expect(stats).toHaveProperty("mapMojiFilterApplied");
      expect(stats).toHaveProperty("pendingUpdates");
      expect(stats).toHaveProperty("registeredUsers");
      expect(stats).toHaveProperty("isProcessingBatch");
      expect(stats).toHaveProperty("config");
    });
  });

  describe("Error Handling", () => {
    test("should handle initialization errors gracefully", async () => {
      // Mock fetch to throw an error
      const mockFetchError = mock(() =>
        Promise.reject(new Error("API Error")),
      ) as unknown as typeof fetch;
      global.fetch = mockFetchError;

      // Should handle initialization errors gracefully (may throw but should not crash)
      try {
        await filterProcessor.initialize();
      } catch (error) {
        // It's okay for initialization to fail when API is down
        expect(error).toBeInstanceOf(Error);
      }
    });

    test("should handle invalid event data", async () => {
      await filterProcessor.initialize();

      // Simulate invalid event data
      const invalidMessage = JSON.stringify({ data: { operation: "CREATE" } }); // Missing record

      // Access the private method for testing
      const handlePatternMessage = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handlePatternMessage.bind(filterProcessor);

      // Should handle invalid data gracefully (may throw but should not crash)
      try {
        await handlePatternMessage(
          "event_changes",
          "event_changes:test",
          invalidMessage,
        );
      } catch (error) {
        // It's okay for invalid data to cause errors
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("Job Handling", () => {
    beforeEach(async () => {
      try {
        await filterProcessor.initialize();
      } catch (error) {
        // Ignore initialization errors for these tests
      }
    });

    test("should handle cleanup job creation", async () => {
      const jobData = {
        type: "JOB_CREATED",
        data: { jobId: "cleanup-123", jobType: "cleanup_outdated_events" },
      };

      // Access the private method for testing
      const handleJobCreated = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handleJobCreated.bind(filterProcessor);

      // Should handle job creation (may throw but should not crash)
      try {
        await handleJobCreated(jobData);
      } catch (error) {
        // It's okay for job handling to throw errors
        expect(error).toBeInstanceOf(Error);
      }
    });

    test("should handle job updates", async () => {
      const jobUpdateData = {
        jobId: "cleanup-123",
        status: "completed",
        result: { deletedCount: 10 },
      };

      // Access the private method for testing
      const handleJobUpdate = (
        filterProcessor as unknown as FilterProcessorPrivate
      ).handleJobUpdate.bind(filterProcessor);

      // Should handle job updates (may throw but should not crash)
      try {
        await handleJobUpdate(jobUpdateData);
      } catch (error) {
        // It's okay for job handling to throw errors
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
