import { describe, it, expect, beforeEach, mock } from "bun:test";
import { CleanupEventsHandler } from "../job/CleanupEventsHandler";
import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "../job/BaseJobHandler";
import type { EventService } from "../../services/EventServiceRefactored";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import type { Point } from "geojson";
import type { Event } from "../../entities/Event";

describe("CleanupEventsHandler", () => {
  let handler: CleanupEventsHandler;
  let mockEventService: EventService;
  let mockJobQueue: JobQueue;
  let mockRedisService: RedisService;
  let mockContext: JobHandlerContext;

  beforeEach(() => {
    // Create mock services
    mockEventService = {
      cleanupOutdatedEvents: mock(() =>
        Promise.resolve({
          deletedCount: 5,
          hasMore: false,
          deletedEvents: [
            {
              id: "event-1",
              title: "Test Event 1",
              description: "Test Description 1",
              eventDate: new Date(),
              location: {
                type: "Point",
                coordinates: [-122.4194, 37.7749],
              } as Point,
              scanCount: 0,
              saveCount: 0,
              status: "VERIFIED",
              isPrivate: false,
              isRecurring: false,
              creatorId: "user-123",
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Event,
            {
              id: "event-2",
              title: "Test Event 2",
              description: "Test Description 2",
              eventDate: new Date(),
              location: {
                type: "Point",
                coordinates: [-122.4084, 37.7849],
              } as Point,
              scanCount: 0,
              saveCount: 0,
              status: "VERIFIED",
              isPrivate: false,
              isRecurring: false,
              creatorId: "user-123",
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Event,
          ],
        }),
      ),
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
      enqueueCleanupJob: mock(() => Promise.resolve("job-456")),
    } as unknown as JobQueue;

    mockRedisService = {
      getClient: mock(() => ({})),
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve("OK")),
      del: mock(() => Promise.resolve(1)),
      exists: mock(() => Promise.resolve(0)),
      expire: mock(() => Promise.resolve(1)),
      publish: mock(() => Promise.resolve(1)),
    } as unknown as RedisService;

    mockContext = {
      jobQueue: mockJobQueue,
      redisService: mockRedisService,
    };

    handler = new CleanupEventsHandler(mockEventService);
  });

  describe("Job Type and Validation", () => {
    it("should have correct job type", () => {
      expect(handler.jobType).toBe("cleanup_outdated_events");
    });

    it("should handle cleanup job type correctly", () => {
      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 100 },
      };

      expect(handler.canHandle(cleanupJob)).toBe(true);
    });

    it("should not handle other job types", () => {
      const otherJob: JobData = {
        id: "job-456",
        type: "process_flyer",
        status: "pending",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      expect(handler.canHandle(otherJob)).toBe(false);
    });
  });

  describe("Job Processing", () => {
    it("should process cleanup job successfully", async () => {
      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 100 },
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify job was started
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "processing",
        progress: 5,
        progressStep: "Starting cleanup process",
        progressDetails: {
          currentStep: "1",
          totalSteps: 3,
          stepProgress: 0,
          stepDescription: "Starting cleanup process",
        },
      });

      // Verify progress update
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        progress: 0.1,
        message: "Cleaning up outdated events (batch size: 100)",
      });

      // Verify cleanup service was called
      expect(mockEventService.cleanupOutdatedEvents).toHaveBeenCalledWith(100);

      // Verify Redis publish calls for deleted events
      expect(mockRedisService.publish).toHaveBeenCalledTimes(2);
      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "DELETE",
        data: {
          operation: "DELETE",
          record: {
            id: "event-1",
            location: { type: "Point", coordinates: [-122.4194, 37.7749] },
            coordinates: [-122.4194, 37.7749],
          },
        },
      });

      // Verify job completion
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "completed",
        progress: 100,
        result: {
          deletedCount: 5,
          hasMore: false,
        },
        completed: expect.any(String),
      });
    });

    it("should use default batch size when not specified", async () => {
      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: {}, // No batchSize specified
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify default batch size of 100 was used
      expect(mockEventService.cleanupOutdatedEvents).toHaveBeenCalledWith(100);
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        progress: 0.1,
        message: "Cleaning up outdated events (batch size: 100)",
      });
    });

    it("should use custom batch size when specified", async () => {
      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 50 },
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify custom batch size was used
      expect(mockEventService.cleanupOutdatedEvents).toHaveBeenCalledWith(50);
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        progress: 0.1,
        message: "Cleaning up outdated events (batch size: 50)",
      });
    });

    it("should queue another cleanup job when hasMore is true", async () => {
      // Mock cleanup service to return hasMore: true
      mockEventService.cleanupOutdatedEvents = mock(() =>
        Promise.resolve({
          deletedCount: 100,
          hasMore: true,
          deletedEvents: [],
        }),
      );

      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 100 },
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify another cleanup job was queued
      expect(mockJobQueue.enqueueCleanupJob).toHaveBeenCalledWith(100);
    });

    it("should not queue another cleanup job when hasMore is false", async () => {
      // Mock cleanup service to return hasMore: false
      mockEventService.cleanupOutdatedEvents = mock(() =>
        Promise.resolve({
          deletedCount: 5,
          hasMore: false,
          deletedEvents: [],
        }),
      );

      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 100 },
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify no additional cleanup job was queued
      expect(mockJobQueue.enqueueCleanupJob).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle cleanup service errors gracefully", async () => {
      // Mock cleanup service to throw an error
      mockEventService.cleanupOutdatedEvents = mock(() =>
        Promise.reject(new Error("Database connection failed")),
      );

      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 100 },
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify job was started
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "processing",
        progress: 5,
        progressStep: "Starting cleanup process",
        progressDetails: {
          currentStep: "1",
          totalSteps: 3,
          stepProgress: 0,
          stepDescription: "Starting cleanup process",
        },
      });

      // Verify job was failed with error
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "failed",
        progress: 100,
        error: "Database connection failed",
        message:
          "Failed to clean up outdated events. The system will retry automatically.",
        completed: expect.any(String),
      });
    });

    it("should handle non-Error exceptions", async () => {
      // Mock cleanup service to throw a string
      mockEventService.cleanupOutdatedEvents = mock(() =>
        Promise.reject("String error"),
      );

      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 100 },
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify job was failed with "Unknown error"
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "failed",
        progress: 100,
        error: "Unknown error",
        message:
          "Failed to clean up outdated events. The system will retry automatically.",
        completed: expect.any(String),
      });
    });
  });

  describe("Redis Publishing", () => {
    it("should publish deletion notifications for all deleted events", async () => {
      // Mock cleanup service to return multiple deleted events
      mockEventService.cleanupOutdatedEvents = mock(() =>
        Promise.resolve({
          deletedCount: 3,
          hasMore: false,
          deletedEvents: [
            {
              id: "event-1",
              title: "Test Event 1",
              description: "Test Description 1",
              eventDate: new Date(),
              location: {
                type: "Point",
                coordinates: [-122.4194, 37.7749],
              } as Point,
              scanCount: 0,
              saveCount: 0,
              status: "VERIFIED",
              isPrivate: false,
              isRecurring: false,
              creatorId: "user-123",
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Event,
            {
              id: "event-2",
              title: "Test Event 2",
              description: "Test Description 2",
              eventDate: new Date(),
              location: {
                type: "Point",
                coordinates: [-122.4084, 37.7849],
              } as Point,
              scanCount: 0,
              saveCount: 0,
              status: "VERIFIED",
              isPrivate: false,
              isRecurring: false,
              creatorId: "user-123",
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Event,
            {
              id: "event-3",
              title: "Test Event 3",
              description: "Test Description 3",
              eventDate: new Date(),
              location: {
                type: "Point",
                coordinates: [-122.3984, 37.7949],
              } as Point,
              scanCount: 0,
              saveCount: 0,
              status: "VERIFIED",
              isPrivate: false,
              isRecurring: false,
              creatorId: "user-123",
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Event,
          ],
        }),
      );

      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 100 },
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify Redis publish was called for each deleted event
      expect(mockRedisService.publish).toHaveBeenCalledTimes(3);

      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "DELETE",
        data: {
          operation: "DELETE",
          record: {
            id: "event-1",
            location: { type: "Point", coordinates: [-122.4194, 37.7749] },
            coordinates: [-122.4194, 37.7749],
          },
        },
      });

      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "DELETE",
        data: {
          operation: "DELETE",
          record: {
            id: "event-2",
            location: { type: "Point", coordinates: [-122.4084, 37.7849] },
            coordinates: [-122.4084, 37.7849],
          },
        },
      });

      expect(mockRedisService.publish).toHaveBeenCalledWith("event_changes", {
        type: "DELETE",
        data: {
          operation: "DELETE",
          record: {
            id: "event-3",
            location: { type: "Point", coordinates: [-122.3984, 37.7949] },
            coordinates: [-122.3984, 37.7949],
          },
        },
      });
    });

    it("should handle empty deleted events list", async () => {
      // Mock cleanup service to return no deleted events
      mockEventService.cleanupOutdatedEvents = mock(() =>
        Promise.resolve({
          deletedCount: 0,
          hasMore: false,
          deletedEvents: [],
        }),
      );

      const cleanupJob: JobData = {
        id: "job-123",
        type: "cleanup_outdated_events",
        status: "pending",
        created: new Date().toISOString(),
        data: { batchSize: 100 },
      };

      await handler.handle("job-123", cleanupJob, mockContext);

      // Verify no Redis publish calls were made
      expect(mockRedisService.publish).not.toHaveBeenCalled();
    });
  });
});
