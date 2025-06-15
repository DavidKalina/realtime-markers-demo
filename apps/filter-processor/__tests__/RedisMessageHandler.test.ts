import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import Redis from "ioredis";
import {
  createRedisMessageHandler,
  RedisMessageHandler,
  MessageHandlers,
  RedisMessageHandlerConfig,
} from "../src/services/RedisMessageHandler";

describe("RedisMessageHandler", () => {
  let redisMessageHandler: RedisMessageHandler;
  let mockHandlers: MessageHandlers;
  let mockRedis: Redis;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRedis = {
      subscribe: mock(() => Promise.resolve()),
      psubscribe: mock(() => Promise.resolve()),
      unsubscribe: mock(() => Promise.resolve()),
      quit: mock(() => Promise.resolve()),
      on: mock(() => {}),
      removeAllListeners: mock(() => {}),
    } as unknown as Redis;

    // Create mock handlers
    mockHandlers = {
      onFilterChanges: mock(() => Promise.resolve()),
      onViewportUpdate: mock(() => Promise.resolve()),
      onInitialRequest: mock(() => Promise.resolve()),
      onEventUpdate: mock(() => Promise.resolve()),
      onJobCreated: mock(() => Promise.resolve()),
      onJobUpdate: mock(() => Promise.resolve()),
    };

    // Create handler instance
    redisMessageHandler = createRedisMessageHandler(mockRedis, mockHandlers);
  });

  afterEach(() => {
    // Clean up listeners
    mockRedis.removeAllListeners();
  });

  describe("Service Creation", () => {
    test("should create handler with default config", () => {
      const handler = createRedisMessageHandler(mockRedis, mockHandlers);
      expect(handler).toBeDefined();
      expect(typeof handler.subscribeToChannels).toBe("function");
      expect(typeof handler.unsubscribe).toBe("function");
      expect(typeof handler.quit).toBe("function");
      expect(typeof handler.getStats).toBe("function");
    });

    test("should create handler with custom config", () => {
      const config: RedisMessageHandlerConfig = {
        channels: {
          filterChanges: "custom-filter-changes",
          viewportUpdates: "custom-viewport-updates",
          initialRequest: "custom-initial-request",
          eventChanges: "custom-event-changes",
          jobCreated: "custom-job-created",
          jobUpdates: "custom-job-updates",
        },
      };

      const handler = createRedisMessageHandler(
        mockRedis,
        mockHandlers,
        config,
      );
      expect(handler).toBeDefined();
    });
  });

  describe("subscribeToChannels", () => {
    test("should subscribe to all channels successfully", async () => {
      await redisMessageHandler.subscribeToChannels();

      expect(mockRedis.subscribe).toHaveBeenCalledTimes(5);
      expect(mockRedis.psubscribe).toHaveBeenCalledTimes(1);
      expect(mockRedis.on).toHaveBeenCalledTimes(2);
    });

    test("should subscribe to custom channels when configured", async () => {
      const config: RedisMessageHandlerConfig = {
        channels: {
          filterChanges: "custom-filter-changes",
          viewportUpdates: "custom-viewport-updates",
        },
      };

      const handler = createRedisMessageHandler(
        mockRedis,
        mockHandlers,
        config,
      );
      await handler.subscribeToChannels();

      expect(mockRedis.subscribe).toHaveBeenCalledWith("custom-filter-changes");
      expect(mockRedis.subscribe).toHaveBeenCalledWith(
        "custom-viewport-updates",
      );
    });

    test("should handle subscription errors", async () => {
      const error = new Error("Subscription failed");
      const mockSubscribe = mockRedis.subscribe as ReturnType<typeof mock>;
      mockSubscribe.mockRejectedValueOnce(error);

      await expect(redisMessageHandler.subscribeToChannels()).rejects.toThrow(
        "Subscription failed",
      );
    });

    test("should set up message handlers", async () => {
      await redisMessageHandler.subscribeToChannels();

      expect(mockRedis.on).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
      expect(mockRedis.on).toHaveBeenCalledWith(
        "pmessage",
        expect.any(Function),
      );
    });
  });

  describe("unsubscribe", () => {
    test("should unsubscribe from all channels", async () => {
      await redisMessageHandler.unsubscribe();

      expect(mockRedis.unsubscribe).toHaveBeenCalled();
    });

    test("should handle unsubscribe errors gracefully", async () => {
      const error = new Error("Unsubscribe failed");
      const mockUnsubscribe = mockRedis.unsubscribe as ReturnType<typeof mock>;
      mockUnsubscribe.mockRejectedValueOnce(error);

      // Should not throw
      await expect(redisMessageHandler.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe("quit", () => {
    test("should quit Redis connection", async () => {
      await redisMessageHandler.quit();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test("should handle quit errors gracefully", async () => {
      const error = new Error("Quit failed");
      const mockQuit = mockRedis.quit as ReturnType<typeof mock>;
      mockQuit.mockRejectedValueOnce(error);

      // Should not throw
      await expect(redisMessageHandler.quit()).resolves.toBeUndefined();
    });
  });

  describe("getStats", () => {
    test("should return initial stats", () => {
      const stats = redisMessageHandler.getStats();

      expect(stats).toEqual({
        messagesReceived: 0,
        filterChangesProcessed: 0,
        viewportUpdatesProcessed: 0,
        initialRequestsProcessed: 0,
        eventUpdatesProcessed: 0,
        jobNotificationsProcessed: 0,
        errors: 0,
      });
    });

    test("should return stats object copy", () => {
      const stats1 = redisMessageHandler.getStats();
      const stats2 = redisMessageHandler.getStats();

      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2); // Should be different objects
    });
  });

  describe("Integration Tests", () => {
    test("should handle complete workflow", async () => {
      // Test the complete workflow without complex mock introspection
      await redisMessageHandler.subscribeToChannels();

      expect(mockRedis.subscribe).toHaveBeenCalledTimes(5);
      expect(mockRedis.psubscribe).toHaveBeenCalledTimes(1);
      expect(mockRedis.on).toHaveBeenCalledTimes(2);

      await redisMessageHandler.unsubscribe();
      expect(mockRedis.unsubscribe).toHaveBeenCalled();

      await redisMessageHandler.quit();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test("should handle custom configuration", async () => {
      const config: RedisMessageHandlerConfig = {
        channels: {
          filterChanges: "test-filter-changes",
          viewportUpdates: "test-viewport-updates",
        },
      };

      const handler = createRedisMessageHandler(
        mockRedis,
        mockHandlers,
        config,
      );
      await handler.subscribeToChannels();

      expect(mockRedis.subscribe).toHaveBeenCalledWith("test-filter-changes");
      expect(mockRedis.subscribe).toHaveBeenCalledWith("test-viewport-updates");
    });
  });

  describe("Error Handling", () => {
    test("should handle Redis connection errors gracefully", async () => {
      const error = new Error("Connection failed");
      const mockSubscribe = mockRedis.subscribe as ReturnType<typeof mock>;
      mockSubscribe.mockRejectedValueOnce(error);

      await expect(redisMessageHandler.subscribeToChannels()).rejects.toThrow(
        "Connection failed",
      );
    });

    test("should handle unsubscribe errors gracefully", async () => {
      const error = new Error("Unsubscribe failed");
      const mockUnsubscribe = mockRedis.unsubscribe as ReturnType<typeof mock>;
      mockUnsubscribe.mockRejectedValueOnce(error);

      // Should not throw
      await expect(redisMessageHandler.unsubscribe()).resolves.toBeUndefined();
    });

    test("should handle quit errors gracefully", async () => {
      const error = new Error("Quit failed");
      const mockQuit = mockRedis.quit as ReturnType<typeof mock>;
      mockQuit.mockRejectedValueOnce(error);

      // Should not throw
      await expect(redisMessageHandler.quit()).resolves.toBeUndefined();
    });
  });

  describe("Configuration Tests", () => {
    test("should use default channel names when no config provided", async () => {
      await redisMessageHandler.subscribeToChannels();

      // Should subscribe to default channels
      expect(mockRedis.subscribe).toHaveBeenCalledWith("filter-changes");
      expect(mockRedis.subscribe).toHaveBeenCalledWith("viewport-updates");
      expect(mockRedis.subscribe).toHaveBeenCalledWith(
        "filter-processor:request-initial",
      );
      expect(mockRedis.subscribe).toHaveBeenCalledWith("job_created");
      expect(mockRedis.subscribe).toHaveBeenCalledWith("job_updates");
      expect(mockRedis.psubscribe).toHaveBeenCalledWith("event_changes");
    });

    test("should use custom channel names when provided", async () => {
      const config: RedisMessageHandlerConfig = {
        channels: {
          filterChanges: "custom-filters",
          viewportUpdates: "custom-viewports",
          initialRequest: "custom-initial",
          eventChanges: "custom-events",
          jobCreated: "custom-jobs-created",
          jobUpdates: "custom-jobs-updated",
        },
      };

      const handler = createRedisMessageHandler(
        mockRedis,
        mockHandlers,
        config,
      );
      await handler.subscribeToChannels();

      expect(mockRedis.subscribe).toHaveBeenCalledWith("custom-filters");
      expect(mockRedis.subscribe).toHaveBeenCalledWith("custom-viewports");
      expect(mockRedis.subscribe).toHaveBeenCalledWith("custom-initial");
      expect(mockRedis.subscribe).toHaveBeenCalledWith("custom-jobs-created");
      expect(mockRedis.subscribe).toHaveBeenCalledWith("custom-jobs-updated");
      expect(mockRedis.psubscribe).toHaveBeenCalledWith("custom-events");
    });

    test("should handle partial configuration", async () => {
      const config: RedisMessageHandlerConfig = {
        channels: {
          filterChanges: "partial-filters",
          // Other channels use defaults
        },
      };

      const handler = createRedisMessageHandler(
        mockRedis,
        mockHandlers,
        config,
      );
      await handler.subscribeToChannels();

      expect(mockRedis.subscribe).toHaveBeenCalledWith("partial-filters");
      expect(mockRedis.subscribe).toHaveBeenCalledWith("viewport-updates"); // Default
      expect(mockRedis.subscribe).toHaveBeenCalledWith(
        "filter-processor:request-initial",
      ); // Default
    });
  });
});
