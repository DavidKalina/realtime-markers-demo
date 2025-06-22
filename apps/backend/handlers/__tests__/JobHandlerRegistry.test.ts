import { describe, it, expect, beforeEach, mock } from "bun:test";
import { JobHandlerRegistry } from "../job/JobHandlerRegistry";
import type { JobData } from "../../services/JobQueue";
import type { EventProcessingService } from "../../services/EventProcessingService";
import type { EventService } from "../../services/EventServiceRefactored";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import type { StorageService } from "../../services/shared/StorageService";

describe("JobHandlerRegistry", () => {
  let registry: JobHandlerRegistry;
  let mockEventProcessingService: EventProcessingService;
  let mockEventService: EventService;
  let mockJobQueue: JobQueue;
  let mockRedisService: RedisService;
  let mockStorageService: StorageService;

  beforeEach(() => {
    // Create mock services
    mockEventProcessingService = {
      processFlyer: mock(() => Promise.resolve({ id: "event-123" })),
      processPrivateEvent: mock(() => Promise.resolve({ id: "event-123" })),
      cleanupOutdatedEvents: mock(() => Promise.resolve()),
    } as unknown as EventProcessingService;

    mockEventService = {
      createEvent: mock(() => Promise.resolve({ id: "event-123" })),
      updateEvent: mock(() => Promise.resolve()),
      deleteEvent: mock(() => Promise.resolve()),
      getEvent: mock(() => Promise.resolve(null)),
      getEvents: mock(() => Promise.resolve([])),
    } as unknown as EventService;

    mockJobQueue = {
      updateJobStatus: mock(() => Promise.resolve()),
      createJob: mock(() => Promise.resolve("job-123")),
      failJob: mock(() => Promise.resolve()),
      completeJob: mock(() => Promise.resolve()),
      getJob: mock(() => Promise.resolve(null)),
      getJobs: mock(() => Promise.resolve([])),
      sortJobsChronologically: mock(() => []),
    } as unknown as JobQueue;

    mockRedisService = {
      getClient: mock(() => ({})),
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve("OK")),
      del: mock(() => Promise.resolve(1)),
      exists: mock(() => Promise.resolve(0)),
      expire: mock(() => Promise.resolve(1)),
    } as unknown as RedisService;

    mockStorageService = {
      uploadFile: mock(() => Promise.resolve("https://example.com/file.jpg")),
      deleteFile: mock(() => Promise.resolve()),
      getSignedUrl: mock(() =>
        Promise.resolve("https://example.com/signed-url"),
      ),
    } as unknown as StorageService;

    // Create registry instance
    registry = new JobHandlerRegistry(
      mockEventProcessingService,
      mockEventService,
      mockJobQueue,
      mockRedisService,
      mockStorageService,
    );
  });

  describe("Handler Registration", () => {
    it("should register all handlers during construction", () => {
      const handlers = registry.getAllHandlers();

      expect(handlers).toHaveLength(3);

      const handlerTypes = handlers.map((h) => h.jobType);
      expect(handlerTypes).toContain("process_flyer");
      expect(handlerTypes).toContain("process_private_event");
      expect(handlerTypes).toContain("cleanup_outdated_events");
    });

    it("should register handlers with correct dependencies", () => {
      const handlers = registry.getAllHandlers();

      // Verify that handlers are instances of the expected classes
      const processFlyerHandler = handlers.find(
        (h) => h.jobType === "process_flyer",
      );
      const processPrivateEventHandler = handlers.find(
        (h) => h.jobType === "process_private_event",
      );
      const cleanupHandler = handlers.find(
        (h) => h.jobType === "cleanup_outdated_events",
      );

      expect(processFlyerHandler).toBeDefined();
      expect(processPrivateEventHandler).toBeDefined();
      expect(cleanupHandler).toBeDefined();
    });
  });

  describe("Handler Retrieval", () => {
    it("should retrieve handler by job type", () => {
      const processFlyerHandler = registry.getHandler("process_flyer");
      const processPrivateEventHandler = registry.getHandler(
        "process_private_event",
      );
      const cleanupHandler = registry.getHandler("cleanup_outdated_events");

      expect(processFlyerHandler).toBeDefined();
      expect(processFlyerHandler?.jobType).toBe("process_flyer");

      expect(processPrivateEventHandler).toBeDefined();
      expect(processPrivateEventHandler?.jobType).toBe("process_private_event");

      expect(cleanupHandler).toBeDefined();
      expect(cleanupHandler?.jobType).toBe("cleanup_outdated_events");
    });

    it("should return undefined for unknown job types", () => {
      const unknownHandler = registry.getHandler("unknown_job_type");
      expect(unknownHandler).toBeUndefined();
    });

    it("should return all registered handlers", () => {
      const allHandlers = registry.getAllHandlers();

      expect(allHandlers).toHaveLength(3);

      // Verify each handler has the required interface
      allHandlers.forEach((handler) => {
        expect(handler.jobType).toBeDefined();
        expect(typeof handler.handle).toBe("function");
        expect(typeof handler.canHandle).toBe("function");
      });
    });
  });

  describe("Context Management", () => {
    it("should provide correct context to handlers", () => {
      const context = registry.getContext();

      expect(context).toBeDefined();
      expect(context.jobQueue).toBe(mockJobQueue);
      expect(context.redisService).toBe(mockRedisService);
    });

    it("should provide consistent context across calls", () => {
      const context1 = registry.getContext();
      const context2 = registry.getContext();

      // The context objects are different instances, but contain the same service references
      expect(context1).not.toBe(context2);
      expect(context1.jobQueue).toBe(context2.jobQueue);
      expect(context1.redisService).toBe(context2.redisService);
    });
  });

  describe("Handler Functionality", () => {
    it("should allow handlers to process jobs", async () => {
      const processFlyerHandler = registry.getHandler("process_flyer");
      expect(processFlyerHandler).toBeDefined();

      if (processFlyerHandler) {
        const testJob: JobData = {
          id: "job-123",
          type: "process_flyer",
          status: "pending",
          created: new Date().toISOString(),
          data: {
            creatorId: "user-123",
            imageUrl: "https://example.com/image.jpg",
          },
        };

        const context = registry.getContext();

        // This should not throw
        await expect(
          processFlyerHandler.handle("job-123", testJob, context),
        ).resolves.toBeUndefined();
      }
    });

    it("should validate job types correctly", () => {
      const processFlyerHandler = registry.getHandler("process_flyer");
      expect(processFlyerHandler).toBeDefined();

      if (processFlyerHandler) {
        const validJob: JobData = {
          id: "job-123",
          type: "process_flyer",
          status: "pending",
          created: new Date().toISOString(),
          data: { creatorId: "user-123" },
        };

        const invalidJob: JobData = {
          id: "job-456",
          type: "process_private_event",
          status: "pending",
          created: new Date().toISOString(),
          data: { creatorId: "user-123" },
        };

        expect(processFlyerHandler.canHandle(validJob)).toBe(true);
        expect(processFlyerHandler.canHandle(invalidJob)).toBe(false);
      }
    });
  });

  describe("Registry Integrity", () => {
    it("should maintain handler registry integrity", () => {
      const handlers = registry.getAllHandlers();

      // Verify no duplicate job types
      const jobTypes = handlers.map((h) => h.jobType);
      const uniqueJobTypes = new Set(jobTypes);
      expect(jobTypes.length).toBe(uniqueJobTypes.size);

      // Verify all handlers are unique instances
      const handlerInstances = new Set(handlers);
      expect(handlers.length).toBe(handlerInstances.size);
    });

    it("should handle multiple registry instances independently", () => {
      const registry2 = new JobHandlerRegistry(
        mockEventProcessingService,
        mockEventService,
        mockJobQueue,
        mockRedisService,
        mockStorageService,
      );

      const handlers1 = registry.getAllHandlers();
      const handlers2 = registry2.getAllHandlers();

      expect(handlers1).toHaveLength(handlers2.length);

      // Verify they are different instances
      handlers1.forEach((handler, index) => {
        expect(handler).not.toBe(handlers2[index]);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle missing dependencies gracefully", () => {
      // Test that registry can be created with null/undefined dependencies
      const registryWithNullDeps = new JobHandlerRegistry(
        null as unknown as EventProcessingService,
        null as unknown as EventService,
        null as unknown as JobQueue,
        null as unknown as RedisService,
        null as unknown as StorageService,
      );

      // Should not throw during construction
      expect(registryWithNullDeps).toBeDefined();

      // Should still return handlers (though they may not work properly)
      const handlers = registryWithNullDeps.getAllHandlers();
      expect(handlers).toHaveLength(3);
    });

    it("should provide context even with null dependencies", () => {
      const registryWithNullDeps = new JobHandlerRegistry(
        null as unknown as EventProcessingService,
        null as unknown as EventService,
        null as unknown as JobQueue,
        null as unknown as RedisService,
        null as unknown as StorageService,
      );

      const context = registryWithNullDeps.getContext();
      expect(context).toBeDefined();
      expect(context.jobQueue).toBeNull();
      expect(context.redisService).toBeNull();
    });
  });
});
