import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { createHybridUserUpdateBatcherService } from "../src/services/HybridUserUpdateBatcherService";
import { Event, BoundingBox, Filter } from "../src/types/types";

// Mock services
const mockEventFilteringService = {
  calculateAndSendDiff: mock(async (userId: string, events: Event[]) => {
    console.log(
      `[Mock] Processing user ${userId} with ${events.length} events`,
    );
  }),
  getStats: mock(() => ({})),
};

const mockViewportProcessor = {
  updateUserViewport: mock(async () => {
    console.log("[Mock] Updating viewport");
  }),
};

const mockEventCacheService = {
  getEventsInViewport: mock(() => {
    return [
      {
        id: "event-1",
        title: "Test Event 1",
        location: { coordinates: [-122.4194, 37.7749] },
        eventDate: "2024-01-15T10:00:00Z",
        scanCount: 5,
        saveCount: 2,
        isPrivate: false,
        creatorId: "user-1",
        sharedWith: [],
        isRecurring: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ] as Event[];
  }),
  getAllEvents: mock(() => {
    return [
      {
        id: "event-1",
        title: "Test Event 1",
        location: { coordinates: [-122.4194, 37.7749] },
        eventDate: "2024-01-15T10:00:00Z",
        scanCount: 5,
        saveCount: 2,
        isPrivate: false,
        creatorId: "user-1",
        sharedWith: [],
        isRecurring: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ] as Event[];
  }),
  getStats: mock(() => ({ spatialIndexSize: 1, cacheSize: 1 })),
};

const mockGetUserFilters = mock(() => {
  return [
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
  ] as Filter[];
});

const mockGetUserViewport = mock(() => {
  return {
    minX: -122.5,
    minY: 37.7,
    maxX: -122.4,
    maxY: 37.8,
  } as BoundingBox;
});

describe("HybridUserUpdateBatcherService", () => {
  let batcherService: ReturnType<typeof createHybridUserUpdateBatcherService>;

  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Create a new instance for each test
    batcherService = createHybridUserUpdateBatcherService(
      mockEventFilteringService,
      mockViewportProcessor,
      mockEventCacheService,
      mockGetUserFilters,
      mockGetUserViewport,
      {
        debounceTimeoutMs: 50, // Short timeout for testing
        sweepIntervalMs: 200, // Short interval for testing
        maxBatchSize: 10,
        enableBatching: true,
      },
    );
  });

  afterEach(() => {
    // Clean up after each test
    if (batcherService) {
      batcherService.shutdown();
    }
  });

  describe("Debounce Timer Logic", () => {
    test("should process user immediately when batching is disabled", async () => {
      // Create a new batcher with batching disabled
      const immediateBatcher = createHybridUserUpdateBatcherService(
        mockEventFilteringService,
        mockViewportProcessor,
        mockEventCacheService,
        mockGetUserFilters,
        mockGetUserViewport,
        {
          enableBatching: false,
        },
      );

      // Mark user as dirty
      immediateBatcher.markUserAsDirty("user-1");

      // Should be processed immediately
      expect(
        mockEventFilteringService.calculateAndSendDiff,
      ).toHaveBeenCalledWith(
        "user-1",
        expect.any(Array),
        expect.any(Object),
        expect.any(Array),
      );

      immediateBatcher.shutdown();
    });

    test("should debounce rapid updates for the same user", async () => {
      // Mark user as dirty multiple times rapidly
      batcherService.markUserAsDirty("user-1");
      batcherService.markUserAsDirty("user-1");
      batcherService.markUserAsDirty("user-1");

      // Should not be processed immediately due to debouncing
      expect(
        mockEventFilteringService.calculateAndSendDiff,
      ).not.toHaveBeenCalled();

      // Wait for debounce timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be processed once after debounce
      expect(
        mockEventFilteringService.calculateAndSendDiff,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockEventFilteringService.calculateAndSendDiff,
      ).toHaveBeenCalledWith(
        "user-1",
        expect.any(Array),
        expect.any(Object),
        expect.any(Array),
      );
    });
  });

  describe("Sweeper Logic", () => {
    test("should process all dirty users on sweeper interval", async () => {
      // Mark multiple users as dirty
      batcherService.markUserAsDirty("user-1");
      batcherService.markUserAsDirty("user-2");
      batcherService.markUserAsDirty("user-3");

      // Wait for sweeper to run
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Should process all users
      expect(
        mockEventFilteringService.calculateAndSendDiff,
      ).toHaveBeenCalledTimes(3);
    });

    test("should handle batch size limits", async () => {
      // Create batcher with small batch size
      const smallBatchBatcher = createHybridUserUpdateBatcherService(
        mockEventFilteringService,
        mockViewportProcessor,
        mockEventCacheService,
        mockGetUserFilters,
        mockGetUserViewport,
        {
          debounceTimeoutMs: 50,
          sweepIntervalMs: 200,
          maxBatchSize: 2, // Small batch size
          enableBatching: true,
        },
      );

      // Mark more users than batch size
      smallBatchBatcher.markUserAsDirty("user-1");
      smallBatchBatcher.markUserAsDirty("user-2");
      smallBatchBatcher.markUserAsDirty("user-3");
      smallBatchBatcher.markUserAsDirty("user-4");

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should process in batches
      expect(
        mockEventFilteringService.calculateAndSendDiff,
      ).toHaveBeenCalledTimes(4);

      smallBatchBatcher.shutdown();
    });
  });

  describe("Force Processing", () => {
    test("should force process all dirty users immediately", async () => {
      // Mark users as dirty
      batcherService.markUserAsDirty("user-1");
      batcherService.markUserAsDirty("user-2");

      // Force process
      await batcherService.forceProcessBatch();

      // Should be processed immediately
      expect(
        mockEventFilteringService.calculateAndSendDiff,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe("Statistics", () => {
    test("should track statistics correctly", async () => {
      // Mark users as dirty
      batcherService.markUserAsDirty("user-1");
      batcherService.markUserAsDirty("user-2");

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = batcherService.getStats();
      expect(stats.totalUsersMarkedDirty).toBe(2);
      expect(stats.totalUsersProcessed).toBe(2);
      expect(stats.totalBatchesProcessed).toBeGreaterThan(0);
    });
  });

  describe("Shutdown", () => {
    test("should clean up timers and process remaining users on shutdown", async () => {
      // Mark users as dirty
      batcherService.markUserAsDirty("user-1");
      batcherService.markUserAsDirty("user-2");

      // Shutdown
      batcherService.shutdown();

      // Should process remaining users
      expect(
        mockEventFilteringService.calculateAndSendDiff,
      ).toHaveBeenCalledTimes(2);
    });
  });
});
