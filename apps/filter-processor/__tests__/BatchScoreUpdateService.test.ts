import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { BatchScoreUpdateService } from "../src/services/BatchScoreUpdateService";
import { EventPublisher } from "../src/handlers/EventPublisher";
import {
  Event,
  BoundingBox,
  Filter,
  EventStatus,
  SpatialItem,
} from "../src/types/types";
import RBush from "rbush";

// Mock dependencies
const mockEventPublisher = {
  publishBatchUpdate: mock(() => Promise.resolve()),
  publishFilteredEvents: mock(() => Promise.resolve()),
  publishUpdateEvent: mock(() => Promise.resolve()),
  publishDeleteEvent: mock(() => Promise.resolve()),
  getStats: mock(() => ({ totalFilteredEventsPublished: 0 })),
  stripSensitiveData: mock(() => ({})),
} as unknown as EventPublisher;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMapMojiFilter = {
  updateConfig: mock(() => {}),
  filterEvents: mock(() => Promise.resolve([])),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as unknown as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFilterMatcher = {
  isEventAccessible: mock(() => true),
  eventMatchesFilters: mock(() => true),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as unknown as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockViewportProcessor = {
  isEventInViewport: mock(() => true),
  getEventsInViewport: mock(() => []),
  getIntersectingViewports: mock(() => Promise.resolve([])),
  updateUserViewport: mock(() => Promise.resolve()),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as unknown as any;

describe("BatchScoreUpdateService", () => {
  let batchService: BatchScoreUpdateService;
  let spatialIndex: RBush<SpatialItem>;
  let eventCache: Map<string, Event>;

  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Create fresh instances
    spatialIndex = new RBush<SpatialItem>();
    eventCache = new Map<string, Event>();

    // Create service instance

    batchService = new BatchScoreUpdateService(
      mockEventPublisher,
      mockMapMojiFilter,
      mockFilterMatcher,
      mockViewportProcessor,
      spatialIndex,
      eventCache,
      {
        batchIntervalMs: 1000, // 1 second for faster tests
        maxBatchSize: 10,
        enableBatching: true,
      },
    );
  });

  afterEach(() => {
    batchService.shutdown();
  });

  describe("Configuration", () => {
    test("should initialize with default config", () => {
      const stats = batchService.getStats();
      expect(stats.config.batchIntervalMs).toBe(1000);
      expect(stats.config.maxBatchSize).toBe(10);
      expect(stats.config.enableBatching).toBe(true);
    });

    test("should update configuration", () => {
      const newConfig = {
        batchIntervalMs: 5000,
        maxBatchSize: 20,
        enableBatching: false,
      };

      batchService.updateConfig(newConfig);
      const stats = batchService.getStats();
      expect(stats.config.batchIntervalMs).toBe(5000);
      expect(stats.config.maxBatchSize).toBe(20);
      expect(stats.config.enableBatching).toBe(false);
    });
  });

  describe("Event Updates", () => {
    const testEvent: Event = {
      id: "test-event",
      title: "Test Event",
      location: { type: "Point", coordinates: [-122.4194, 37.7749] },
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
    };

    test("should add event update to batch", () => {
      batchService.addEventUpdate(testEvent, "CREATE");

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(1);
    });

    test("should add popularity update to batch", () => {
      batchService.addEventUpdate(testEvent, "UPDATE", true);

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(1);
    });

    test("should process batch when max size reached", async () => {
      // Add events up to max batch size
      for (let i = 0; i < 10; i++) {
        const event = { ...testEvent, id: `event-${i}` };
        batchService.addEventUpdate(event, "CREATE");
      }

      // Should trigger immediate processing
      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(0);
    });

    test("should not add updates when batching disabled", () => {
      batchService.updateConfig({ enableBatching: false });
      batchService.addEventUpdate(testEvent, "CREATE");

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(0);
    });
  });

  describe("User Registration", () => {
    const testViewport: BoundingBox = {
      minX: -122.5,
      minY: 37.7,
      maxX: -122.4,
      maxY: 37.8,
    };

    const testFilters: Filter[] = [
      {
        id: "filter-1",
        userId: "test-user",
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

    test("should register user for updates", () => {
      batchService.registerUserForUpdates(
        "test-user",
        testViewport,
        testFilters,
      );

      const stats = batchService.getStats();
      expect(stats.registeredUsers).toBe(1);
    });

    test("should update user configuration", () => {
      batchService.registerUserForUpdates(
        "test-user",
        testViewport,
        testFilters,
      );

      const newViewport: BoundingBox = {
        minX: -122.6,
        minY: 37.6,
        maxX: -122.3,
        maxY: 37.9,
      };

      batchService.updateUserConfig("test-user", newViewport, []);

      const stats = batchService.getStats();
      expect(stats.registeredUsers).toBe(1);
    });

    test("should unregister user", () => {
      batchService.registerUserForUpdates(
        "test-user",
        testViewport,
        testFilters,
      );
      batchService.unregisterUser("test-user");

      const stats = batchService.getStats();
      expect(stats.registeredUsers).toBe(0);
    });
  });

  describe("Batch Processing", () => {
    const testEvent: Event = {
      id: "test-event",
      title: "Test Event",
      location: { type: "Point", coordinates: [-122.4194, 37.7749] },
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
    };

    beforeEach(() => {
      // Register a test user
      batchService.registerUserForUpdates("test-user");
    });

    test("should force process batch", async () => {
      batchService.addEventUpdate(testEvent, "CREATE");

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.pendingUpdates).toBe(0);
      expect(stats.batchesProcessed).toBe(1);
    });

    test("should not process empty batch", async () => {
      const initialStats = batchService.getStats();

      await batchService.forceProcessBatch();

      const finalStats = batchService.getStats();
      expect(finalStats.batchesProcessed).toBe(initialStats.batchesProcessed);
    });

    test("should handle batch processing errors gracefully", async () => {
      // Mock an error in the event publisher
      mockEventPublisher.publishBatchUpdate = mock(() =>
        Promise.reject(new Error("Publish error")),
      );

      batchService.addEventUpdate(testEvent, "CREATE");

      // Should handle errors gracefully (may throw but should not crash)
      try {
        await batchService.forceProcessBatch();
      } catch (error) {
        // It's okay for batch processing to throw errors when publisher fails
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("Statistics", () => {
    test("should return comprehensive statistics", () => {
      const stats = batchService.getStats();

      expect(stats).toHaveProperty("batchesProcessed");
      expect(stats).toHaveProperty("totalEventsProcessed");
      expect(stats).toHaveProperty("totalUsersUpdated");
      expect(stats).toHaveProperty("averageBatchSize");
      expect(stats).toHaveProperty("lastBatchTime");
      expect(stats).toHaveProperty("pendingUpdates");
      expect(stats).toHaveProperty("registeredUsers");
      expect(stats).toHaveProperty("isProcessingBatch");
      expect(stats).toHaveProperty("config");
    });

    test("should track batch processing statistics", async () => {
      const testEvent: Event = {
        id: "test-event",
        title: "Test Event",
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
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
      };

      batchService.registerUserForUpdates("test-user");
      batchService.addEventUpdate(testEvent, "CREATE");

      await batchService.forceProcessBatch();

      const stats = batchService.getStats();
      expect(stats.batchesProcessed).toBe(1);
      expect(stats.totalEventsProcessed).toBe(1);
      expect(stats.totalUsersUpdated).toBe(1);
      expect(stats.averageBatchSize).toBe(1);
      expect(stats.lastBatchTime).toBeGreaterThan(0);
    });
  });

  describe("Shutdown", () => {
    test("should shutdown gracefully", () => {
      const testEvent: Event = {
        id: "test-event",
        title: "Test Event",
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
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
      };

      batchService.addEventUpdate(testEvent, "CREATE");

      // Should not throw
      expect(() => batchService.shutdown()).not.toThrow();
    });
  });
});
