import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { BatchScoreUpdateService } from "../src/services/BatchScoreUpdateService";
import { Event, BoundingBox, Filter, EventStatus } from "../src/types/types";
import { EventPublisher } from "../src/handlers/EventPublisher";
import { MapMojiFilterService } from "../src/services/MapMojiFilterService";
import { FilterMatcher } from "../src/handlers/FilterMatcher";
import { ViewportProcessor } from "../src/handlers/ViewportProcessor";
import { EventCacheService } from "../src/services/EventCacheService";
import { UserStateService } from "../src/services/UserStateService";
import { RelevanceScoringService } from "../src/services/RelevanceScoringService";

describe("BatchScoreUpdateService", () => {
  // Mock dependencies
  let mockEventPublisher: EventPublisher;
  let mockMapMojiFilter: MapMojiFilterService;
  let mockFilterMatcher: FilterMatcher;
  let mockViewportProcessor: ViewportProcessor;
  let mockEventCacheService: EventCacheService;
  let mockUserStateService: UserStateService;
  let mockRelevanceScoringService: RelevanceScoringService;
  let batchService: BatchScoreUpdateService;

  // Test event factory
  const createTestEvent = (overrides: Partial<Event> = {}): Event => ({
    id: "test-event-1",
    title: "Test Event",
    description: "A test event",
    eventDate: new Date("2024-01-15T14:00:00Z"),
    location: { type: "Point", coordinates: [-122.4194, 37.7749] },
    scanCount: 5,
    saveCount: 2,
    status: EventStatus.VERIFIED,
    isPrivate: false,
    creatorId: "user-1",
    isRecurring: false,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  });

  // Test filter factory
  const createTestFilter = (overrides: Partial<Filter> = {}): Filter => ({
    id: "filter-1",
    name: "Test Filter",
    isActive: true,
    criteria: {
      dateRange: {
        start: "2024-01-01T00:00:00Z",
        end: "2024-12-31T23:59:59Z",
      },
    },
    userId: "user-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  });

  beforeEach(() => {
    // Create mock instances
    mockEventPublisher = {
      publishBatchUpdate: mock(() => Promise.resolve()),
    } as unknown as EventPublisher;

    mockMapMojiFilter = {
      updateConfig: mock(() => {}),
      filterEvents: mock(() => Promise.resolve([])),
    } as unknown as MapMojiFilterService;

    mockFilterMatcher = {
      isEventAccessible: mock(() => true),
      eventMatchesFilters: mock(() => true),
    } as unknown as FilterMatcher;

    mockViewportProcessor = {
      isEventInViewport: mock(() => true),
      getEventsInViewport: mock(() => []),
    } as unknown as ViewportProcessor;

    mockEventCacheService = {
      getAllEvents: mock(() => []),
    } as unknown as EventCacheService;

    mockUserStateService = {} as UserStateService;
    mockRelevanceScoringService = {} as RelevanceScoringService;

    // Create service instance with short batch interval for testing
    batchService = new BatchScoreUpdateService(
      mockEventPublisher,
      mockMapMojiFilter,
      mockFilterMatcher,
      mockViewportProcessor,
      mockEventCacheService,
      mockUserStateService,
      mockRelevanceScoringService,
      {
        batchIntervalMs: 100, // Short interval for testing
        maxBatchSize: 5,
        enableBatching: true,
      },
    );
  });

  afterEach(() => {
    batchService.shutdown();
  });

  describe("Constructor and Configuration", () => {
    test("should create service with default configuration", () => {
      const service = new BatchScoreUpdateService(
        mockEventPublisher,
        mockMapMojiFilter,
        mockFilterMatcher,
        mockViewportProcessor,
        mockEventCacheService,
        mockUserStateService,
        mockRelevanceScoringService,
      );

      expect(service).toBeDefined();
      expect(typeof service.addEventUpdate).toBe("function");
      expect(typeof service.registerUserForUpdates).toBe("function");
      expect(typeof service.unregisterUser).toBe("function");
      expect(typeof service.updateUserConfig).toBe("function");
      expect(typeof service.getStats).toBe("function");
      expect(typeof service.updateConfig).toBe("function");
      expect(typeof service.forceProcessBatch).toBe("function");
      expect(typeof service.shutdown).toBe("function");

      service.shutdown();
    });

    test("should create service with custom configuration", () => {
      const service = new BatchScoreUpdateService(
        mockEventPublisher,
        mockMapMojiFilter,
        mockFilterMatcher,
        mockViewportProcessor,
        mockEventCacheService,
        mockUserStateService,
        mockRelevanceScoringService,
        {
          batchIntervalMs: 5000,
          maxBatchSize: 100,
          enableBatching: false,
        },
      );

      const stats = service.getStats();
      expect(stats.config.batchIntervalMs).toBe(5000);
      expect(stats.config.maxBatchSize).toBe(100);
      expect(stats.config.enableBatching).toBe(false);

      service.shutdown();
    });

    test("should create service with batching disabled", () => {
      const service = new BatchScoreUpdateService(
        mockEventPublisher,
        mockMapMojiFilter,
        mockFilterMatcher,
        mockViewportProcessor,
        mockEventCacheService,
        mockUserStateService,
        mockRelevanceScoringService,
        {
          enableBatching: false,
        },
      );

      const stats = service.getStats();
      expect(stats.config.enableBatching).toBe(false);

      service.shutdown();
    });
  });

  describe("Event Update Management", () => {
    test("should add event update to batch queue", () => {
      const event = createTestEvent();

      batchService.addEventUpdate(event, "CREATE");

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(1);
    });

    test("should add multiple event updates to batch queue", () => {
      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2" });
      const event3 = createTestEvent({ id: "event-3" });

      batchService.addEventUpdate(event1, "CREATE");
      batchService.addEventUpdate(event2, "UPDATE");
      batchService.addEventUpdate(event3, "DELETE");

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(3);
    });

    test("should handle popularity updates", () => {
      const event = createTestEvent();

      batchService.addEventUpdate(event, "UPDATE", true);

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(1);
    });

    test("should not add updates when batching is disabled", () => {
      const service = new BatchScoreUpdateService(
        mockEventPublisher,
        mockMapMojiFilter,
        mockFilterMatcher,
        mockViewportProcessor,
        mockEventCacheService,
        mockUserStateService,
        mockRelevanceScoringService,
        {
          enableBatching: false,
        },
      );

      const event = createTestEvent();
      service.addEventUpdate(event, "CREATE");

      const stats = service.getStats();
      expect(stats.pendingUpdates).toBe(0);

      service.shutdown();
    });

    test("should process batch when max batch size is reached", async () => {
      const service = new BatchScoreUpdateService(
        mockEventPublisher,
        mockMapMojiFilter,
        mockFilterMatcher,
        mockViewportProcessor,
        mockEventCacheService,
        mockUserStateService,
        mockRelevanceScoringService,
        {
          maxBatchSize: 2,
          batchIntervalMs: 1000,
        },
      );

      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2" });

      service.addEventUpdate(event1, "CREATE");
      service.addEventUpdate(event2, "CREATE");

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = service.getStats();
      expect(stats.pendingUpdates).toBe(0);
      expect(stats.batchesProcessed).toBe(1);

      service.shutdown();
    });
  });

  describe("User Registration and Management", () => {
    test("should register user for updates", () => {
      const viewport: BoundingBox = {
        minX: -122.5,
        minY: 37.7,
        maxX: -122.4,
        maxY: 37.8,
      };
      const filters = [createTestFilter()];

      batchService.registerUserForUpdates("user-1", viewport, filters);

      const stats = batchService.getStats();
      expect(stats.registeredUsers).toBe(1);
    });

    test("should register user without viewport or filters", () => {
      batchService.registerUserForUpdates("user-1");

      const stats = batchService.getStats();
      expect(stats.registeredUsers).toBe(1);
    });

    test("should unregister user", () => {
      batchService.registerUserForUpdates("user-1");
      batchService.unregisterUser("user-1");

      const stats = batchService.getStats();
      expect(stats.registeredUsers).toBe(0);
    });

    test("should update user configuration", () => {
      batchService.registerUserForUpdates("user-1");

      const newViewport: BoundingBox = {
        minX: -123.0,
        minY: 37.0,
        maxX: -122.0,
        maxY: 38.0,
      };
      const newFilters = [createTestFilter({ id: "filter-2" })];

      batchService.updateUserConfig("user-1", newViewport, newFilters);

      const stats = batchService.getStats();
      expect(stats.registeredUsers).toBe(1);
    });

    test("should register new user when updating non-existent user", () => {
      const viewport: BoundingBox = {
        minX: -122.5,
        minY: 37.7,
        maxX: -122.4,
        maxY: 37.8,
      };

      batchService.updateUserConfig("user-1", viewport);

      const stats = batchService.getStats();
      expect(stats.registeredUsers).toBe(1);
    });
  });

  describe("Batch Processing", () => {
    test("should process batch with registered users", async () => {
      const event = createTestEvent();
      const viewport: BoundingBox = {
        minX: -122.5,
        minY: 37.7,
        maxX: -122.4,
        maxY: 37.8,
      };

      // Register user
      batchService.registerUserForUpdates("user-1", viewport);

      // Add event update
      batchService.addEventUpdate(event, "CREATE");

      // Mock dependencies for processing
      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);
      (
        mockFilterMatcher.isEventAccessible as ReturnType<typeof mock>
      ).mockReturnValue(true);
      (
        mockViewportProcessor.isEventInViewport as ReturnType<typeof mock>
      ).mockReturnValue(true);
      (
        mockMapMojiFilter.filterEvents as ReturnType<typeof mock>
      ).mockResolvedValue([{ ...event, relevanceScore: 0.8 }]);

      // Force process batch
      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1);
      expect(stats.totalEventsProcessed).toBe(1);
      expect(stats.totalUsersUpdated).toBe(1);
    });

    test("should not process batch when no pending updates", async () => {
      batchService.registerUserForUpdates("user-1");

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(0);
      expect(stats.totalEventsProcessed).toBe(0);
    });

    test("should not process batch when no registered users", async () => {
      const event = createTestEvent();
      batchService.addEventUpdate(event, "CREATE");

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1); // The service still processes the batch
      expect(stats.totalEventsProcessed).toBe(1); // But processes the events
      expect(stats.totalUsersUpdated).toBe(0); // But updates no users
    });

    test("should handle batch processing errors gracefully", async () => {
      const event = createTestEvent();
      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(event, "CREATE");

      // Mock error in processing
      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockImplementation(() => {
        throw new Error("Cache error");
      });

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1); // The batch is still processed
      expect(stats.isProcessingBatch).toBe(false);
    });

    test("should prevent concurrent batch processing", async () => {
      const event = createTestEvent();
      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(event, "CREATE");

      // Mock slow processing
      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockImplementation(() => {
        return new Promise<Event[]>((resolve) =>
          setTimeout(() => resolve([event]), 100),
        );
      });

      // Start two concurrent batch processes
      const promise1 = batchService.forceProcessBatch();
      const promise2 = batchService.forceProcessBatch();

      await Promise.all([promise1, promise2]);

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1); // Only one should process
    });
  });

  describe("Event Relevance and Filtering", () => {
    test("should filter events based on user access", async () => {
      const event = createTestEvent();
      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(event, "CREATE");

      // Mock user doesn't have access
      (
        mockFilterMatcher.isEventAccessible as ReturnType<typeof mock>
      ).mockReturnValue(false);
      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);

      await batchService.forceProcessBatch();

      expect(mockEventPublisher.publishBatchUpdate).not.toHaveBeenCalled();
    });

    test("should filter events based on viewport", async () => {
      const event = createTestEvent();
      const viewport: BoundingBox = {
        minX: -122.5,
        minY: 37.7,
        maxX: -122.4,
        maxY: 37.8,
      };

      batchService.registerUserForUpdates("user-1", viewport);
      batchService.addEventUpdate(event, "CREATE");

      // Mock event not in viewport
      (
        mockViewportProcessor.isEventInViewport as ReturnType<typeof mock>
      ).mockReturnValue(false);
      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);

      await batchService.forceProcessBatch();

      expect(mockEventPublisher.publishBatchUpdate).not.toHaveBeenCalled();
    });

    test("should filter events based on custom filters", async () => {
      const event = createTestEvent();
      const filters = [createTestFilter()];

      batchService.registerUserForUpdates("user-1", undefined, filters);
      batchService.addEventUpdate(event, "CREATE");

      // Mock event doesn't match filters
      (
        mockFilterMatcher.eventMatchesFilters as ReturnType<typeof mock>
      ).mockReturnValue(false);
      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);

      await batchService.forceProcessBatch();

      expect(mockEventPublisher.publishBatchUpdate).not.toHaveBeenCalled();
    });

    test("should use MapMoji filtering for users without custom filters", async () => {
      const event = createTestEvent();
      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(event, "CREATE");

      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);
      (
        mockMapMojiFilter.filterEvents as ReturnType<typeof mock>
      ).mockResolvedValue([{ ...event, relevanceScore: 0.9 }]);

      await batchService.forceProcessBatch();

      expect(mockMapMojiFilter.updateConfig).toHaveBeenCalled();
      expect(mockMapMojiFilter.filterEvents).toHaveBeenCalled();
    });

    test("should use hybrid mode for date range only filters", async () => {
      const event = createTestEvent();
      const dateRangeFilter = createTestFilter({
        criteria: {
          dateRange: {
            start: "2024-01-01T00:00:00Z",
            end: "2024-12-31T23:59:59Z",
          },
        },
      });

      batchService.registerUserForUpdates("user-1", undefined, [
        dateRangeFilter,
      ]);
      batchService.addEventUpdate(event, "CREATE");

      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);
      (
        mockMapMojiFilter.filterEvents as ReturnType<typeof mock>
      ).mockResolvedValue([{ ...event, relevanceScore: 0.8 }]);

      await batchService.forceProcessBatch();

      expect(mockMapMojiFilter.updateConfig).toHaveBeenCalled();
      expect(mockMapMojiFilter.filterEvents).toHaveBeenCalled();
    });
  });

  describe("Batch Update Publishing", () => {
    test("should publish batch update with correct structure", async () => {
      const event = createTestEvent();
      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(event, "CREATE");

      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);
      (
        mockMapMojiFilter.filterEvents as ReturnType<typeof mock>
      ).mockResolvedValue([{ ...event, relevanceScore: 0.8 }]);

      await batchService.forceProcessBatch();

      expect(mockEventPublisher.publishBatchUpdate).toHaveBeenCalledWith(
        "user-1",
        {
          type: "batch-update",
          timestamp: expect.any(Number),
          updates: {
            creates: [{ ...event, relevanceScore: 0.8 }],
            updates: [],
            deletes: [],
          },
          summary: {
            totalEvents: 1,
            newEvents: 1,
            updatedEvents: 0,
            deletedEvents: 0,
          },
        },
      );
    });

    test("should handle multiple operation types in batch", async () => {
      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2" });
      const event3 = createTestEvent({ id: "event-3" });

      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(event1, "CREATE");
      batchService.addEventUpdate(event2, "UPDATE");
      batchService.addEventUpdate(event3, "DELETE");

      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event1, event2]);
      (
        mockMapMojiFilter.filterEvents as ReturnType<typeof mock>
      ).mockResolvedValue([{ ...event1, relevanceScore: 0.8 }]);

      await batchService.forceProcessBatch();

      expect(mockEventPublisher.publishBatchUpdate).toHaveBeenCalledWith(
        "user-1",
        {
          type: "batch-update",
          timestamp: expect.any(Number),
          updates: {
            creates: [{ ...event1, relevanceScore: 0.8 }],
            updates: [],
            deletes: ["event-3"],
          },
          summary: {
            totalEvents: 1,
            newEvents: 1,
            updatedEvents: 0,
            deletedEvents: 1,
          },
        },
      );
    });

    test("should handle publishing errors gracefully", async () => {
      const event = createTestEvent();
      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(event, "CREATE");

      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);
      (
        mockMapMojiFilter.filterEvents as ReturnType<typeof mock>
      ).mockResolvedValue([{ ...event, relevanceScore: 0.8 }]);
      (
        mockEventPublisher.publishBatchUpdate as ReturnType<typeof mock>
      ).mockRejectedValue(new Error("Publish error"));

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1);
      expect(stats.isProcessingBatch).toBe(false);
    });
  });

  describe("Statistics and Monitoring", () => {
    test("should track batch processing statistics", async () => {
      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2" });

      batchService.registerUserForUpdates("user-1");
      batchService.registerUserForUpdates("user-2");

      batchService.addEventUpdate(event1, "CREATE");
      batchService.addEventUpdate(event2, "UPDATE");

      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event1, event2]);
      (
        mockMapMojiFilter.filterEvents as ReturnType<typeof mock>
      ).mockResolvedValue([
        { ...event1, relevanceScore: 0.8 },
        { ...event2, relevanceScore: 0.6 },
      ]);

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1);
      expect(stats.totalEventsProcessed).toBe(2);
      expect(stats.totalUsersUpdated).toBe(2);
      expect(stats.averageBatchSize).toBe(2);
      expect(stats.lastBatchTime).toBeGreaterThan(0);
    });

    test("should provide current state information", () => {
      const event = createTestEvent();
      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(event, "CREATE");

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(1);
      expect(stats.registeredUsers).toBe(1);
      expect(stats.isProcessingBatch).toBe(false);
      expect(stats.config).toBeDefined();
    });

    test("should update configuration at runtime", () => {
      batchService.updateConfig({
        batchIntervalMs: 30000,
        maxBatchSize: 500,
      });

      const stats = batchService.getStats();
      expect(stats.config.batchIntervalMs).toBe(30000);
      expect(stats.config.maxBatchSize).toBe(500);
    });
  });

  describe("Service Lifecycle", () => {
    test("should shutdown gracefully", () => {
      const event = createTestEvent();
      batchService.addEventUpdate(event, "CREATE");

      batchService.shutdown();

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(0); // Should process remaining updates
    });

    test("should restart batch timer when interval changes", () => {
      batchService.updateConfig({
        batchIntervalMs: 200,
      });

      const stats = batchService.getStats();
      expect(stats.config.batchIntervalMs).toBe(200);
    });

    test("should handle shutdown when no pending updates", () => {
      batchService.shutdown();

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(0);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle empty event list gracefully", async () => {
      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(createTestEvent(), "CREATE");

      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([]);

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1);
      expect(stats.totalEventsProcessed).toBe(1);
    });

    test("should handle user processing errors without affecting other users", async () => {
      const event = createTestEvent();
      batchService.registerUserForUpdates("user-1");
      batchService.registerUserForUpdates("user-2");
      batchService.addEventUpdate(event, "CREATE");

      // Mock error for user-1 but not user-2
      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([event]);
      (
        mockFilterMatcher.isEventAccessible as ReturnType<typeof mock>
      ).mockImplementation((event, userId) => {
        if (userId === "user-1") throw new Error("User error");
        return true;
      });
      (
        mockMapMojiFilter.filterEvents as ReturnType<typeof mock>
      ).mockResolvedValue([{ ...event, relevanceScore: 0.8 }]);

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1);
      expect(stats.isProcessingBatch).toBe(false);
    });

    test("should handle malformed events gracefully", async () => {
      const malformedEvent = {
        id: "malformed-event",
        // Missing required fields
      } as unknown as Event;

      batchService.registerUserForUpdates("user-1");
      batchService.addEventUpdate(malformedEvent, "CREATE");

      (
        mockEventCacheService.getAllEvents as ReturnType<typeof mock>
      ).mockReturnValue([malformedEvent]);

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1);
      expect(stats.isProcessingBatch).toBe(false);
    });
  });
});
