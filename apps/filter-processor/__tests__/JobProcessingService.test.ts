import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  createJobProcessingService,
  JobProcessingService,
  JobProcessingServiceConfig,
} from "../src/services/JobProcessingService";
import type { EventPublisher } from "../src/handlers/EventPublisher";

// Create mock types that preserve mock methods while being compatible with real interfaces
interface MockEventPublisher
  extends Pick<EventPublisher, "publishFilteredEvents"> {
  publishFilteredEvents: ReturnType<typeof mock>;
}

// Mock dependencies
const mockEventPublisher: MockEventPublisher = {
  publishFilteredEvents: mock(() => Promise.resolve()),
};

const mockClearEventCache = mock(() => {});
const mockGetAllUserIds = mock(() => []);
const mockMarkUserDirty = mock(() => {});
const mockMarkUserDirtyWithContext = mock(() => {});

describe("JobProcessingService", () => {
  let jobProcessingService: JobProcessingService;
  let config: JobProcessingServiceConfig;

  // Test data
  const testJobId = "job-123";
  const testUserId1 = "user-123";
  const testUserId2 = "user-456";
  const testUserIds = [testUserId1, testUserId2];

  beforeEach(() => {
    // Reset all mocks
    mockEventPublisher.publishFilteredEvents.mockClear();
    mockClearEventCache.mockClear();
    mockGetAllUserIds.mockClear();
    mockMarkUserDirty.mockClear();
    mockMarkUserDirtyWithContext.mockClear();

    // Default configuration
    config = {
      enableEventCacheClearing: true,
      enableUserNotifications: true,
    };

    // Create service instance
    jobProcessingService = createJobProcessingService(
      mockEventPublisher as unknown as EventPublisher,
      mockClearEventCache,
      mockGetAllUserIds,
      mockMarkUserDirty,
      mockMarkUserDirtyWithContext,
      config,
    );
  });

  describe("handleJobCreated", () => {
    test("should handle cleanup job creation with default config", async () => {
      const jobData = {
        type: "JOB_CREATED",
        data: {
          jobId: testJobId,
          jobType: "cleanup_outdated_events",
        },
      };

      mockGetAllUserIds.mockReturnValue(testUserIds);

      await jobProcessingService.handleJobCreated(jobData);

      // Should clear event cache
      expect(mockClearEventCache).toHaveBeenCalledTimes(1);

      // Should mark all users as dirty with context
      expect(mockMarkUserDirtyWithContext).toHaveBeenCalledTimes(2);
      expect(mockMarkUserDirtyWithContext).toHaveBeenCalledWith(testUserId1, {
        reason: "job_completion",
        timestamp: expect.any(Number),
      });
      expect(mockMarkUserDirtyWithContext).toHaveBeenCalledWith(testUserId2, {
        reason: "job_completion",
        timestamp: expect.any(Number),
      });

      // Should update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCreated).toBe(1);
      expect(stats.cacheClears).toBe(1);
      expect(stats.usersMarkedDirty).toBe(2);
    });

    test("should handle cleanup job creation with cache clearing disabled", async () => {
      config.enableEventCacheClearing = false;
      jobProcessingService = createJobProcessingService(
        mockEventPublisher as unknown as EventPublisher,
        mockClearEventCache,
        mockGetAllUserIds,
        mockMarkUserDirty,
        mockMarkUserDirtyWithContext,
        config,
      );

      const jobData = {
        type: "JOB_CREATED",
        data: {
          jobId: testJobId,
          jobType: "cleanup_outdated_events",
        },
      };

      mockGetAllUserIds.mockReturnValue(testUserIds);

      await jobProcessingService.handleJobCreated(jobData);

      // Should not clear event cache
      expect(mockClearEventCache).not.toHaveBeenCalled();

      // Should not mark users as dirty (because user notifications are nested inside cache clearing)
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCreated).toBe(1);
      expect(stats.cacheClears).toBe(0);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should handle cleanup job creation with user notifications disabled", async () => {
      config.enableUserNotifications = false;
      jobProcessingService = createJobProcessingService(
        mockEventPublisher as unknown as EventPublisher,
        mockClearEventCache,
        mockGetAllUserIds,
        mockMarkUserDirty,
        mockMarkUserDirtyWithContext,
        config,
      );

      const jobData = {
        type: "JOB_CREATED",
        data: {
          jobId: testJobId,
          jobType: "cleanup_outdated_events",
        },
      };

      await jobProcessingService.handleJobCreated(jobData);

      // Should clear event cache
      expect(mockClearEventCache).toHaveBeenCalledTimes(1);

      // Should not mark users as dirty
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCreated).toBe(1);
      expect(stats.cacheClears).toBe(1);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should ignore non-cleanup job types", async () => {
      const jobData = {
        type: "JOB_CREATED",
        data: {
          jobId: testJobId,
          jobType: "other_job_type",
        },
      };

      await jobProcessingService.handleJobCreated(jobData);

      // Should not call any dependencies
      expect(mockClearEventCache).not.toHaveBeenCalled();
      expect(mockGetAllUserIds).not.toHaveBeenCalled();
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should not update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCreated).toBe(0);
      expect(stats.cacheClears).toBe(0);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should ignore non-JOB_CREATED event types", async () => {
      const jobData = {
        type: "OTHER_EVENT_TYPE",
        data: {
          jobId: testJobId,
          jobType: "cleanup_outdated_events",
        },
      };

      await jobProcessingService.handleJobCreated(jobData);

      // Should not call any dependencies
      expect(mockClearEventCache).not.toHaveBeenCalled();
      expect(mockGetAllUserIds).not.toHaveBeenCalled();
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should not update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCreated).toBe(0);
      expect(stats.cacheClears).toBe(0);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should handle job without jobType", async () => {
      const jobData = {
        type: "JOB_CREATED",
        data: {
          jobId: testJobId,
        },
      };

      await jobProcessingService.handleJobCreated(jobData);

      // Should not call any dependencies
      expect(mockClearEventCache).not.toHaveBeenCalled();
      expect(mockGetAllUserIds).not.toHaveBeenCalled();
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should not update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCreated).toBe(0);
      expect(stats.cacheClears).toBe(0);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should handle empty user list", async () => {
      const jobData = {
        type: "JOB_CREATED",
        data: {
          jobId: testJobId,
          jobType: "cleanup_outdated_events",
        },
      };

      mockGetAllUserIds.mockReturnValue([]);

      await jobProcessingService.handleJobCreated(jobData);

      // Should clear event cache
      expect(mockClearEventCache).toHaveBeenCalledTimes(1);

      // Should not mark any users as dirty
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCreated).toBe(1);
      expect(stats.cacheClears).toBe(1);
      expect(stats.usersMarkedDirty).toBe(0);
    });
  });

  describe("handleJobUpdate", () => {
    test("should handle completed cleanup job with deleted count", async () => {
      const jobUpdateData = {
        jobId: testJobId,
        status: "completed",
        result: {
          deletedCount: 42,
        },
      };

      mockGetAllUserIds.mockReturnValue(testUserIds);

      await jobProcessingService.handleJobUpdate(jobUpdateData);

      // Should mark all users as dirty with context
      expect(mockMarkUserDirtyWithContext).toHaveBeenCalledTimes(2);
      expect(mockMarkUserDirtyWithContext).toHaveBeenCalledWith(testUserId1, {
        reason: "job_completion",
        timestamp: expect.any(Number),
      });
      expect(mockMarkUserDirtyWithContext).toHaveBeenCalledWith(testUserId2, {
        reason: "job_completion",
        timestamp: expect.any(Number),
      });

      // Should update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCompleted).toBe(1);
      expect(stats.eventsDeleted).toBe(42);
      expect(stats.usersMarkedDirty).toBe(2);
    });

    test("should handle completed cleanup job with user notifications disabled", async () => {
      config.enableUserNotifications = false;
      jobProcessingService = createJobProcessingService(
        mockEventPublisher as unknown as EventPublisher,
        mockClearEventCache,
        mockGetAllUserIds,
        mockMarkUserDirty,
        mockMarkUserDirtyWithContext,
        config,
      );

      const jobUpdateData = {
        jobId: testJobId,
        status: "completed",
        result: {
          deletedCount: 42,
        },
      };

      await jobProcessingService.handleJobUpdate(jobUpdateData);

      // Should not mark users as dirty
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should still update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCompleted).toBe(1);
      expect(stats.eventsDeleted).toBe(42);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should ignore non-completed job status", async () => {
      const jobUpdateData = {
        jobId: testJobId,
        status: "running",
        result: {
          deletedCount: 42,
        },
      };

      await jobProcessingService.handleJobUpdate(jobUpdateData);

      // Should not call any dependencies
      expect(mockGetAllUserIds).not.toHaveBeenCalled();
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should not update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCompleted).toBe(0);
      expect(stats.eventsDeleted).toBe(0);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should ignore completed job without deleted count", async () => {
      const jobUpdateData = {
        jobId: testJobId,
        status: "completed",
        result: {},
      };

      await jobProcessingService.handleJobUpdate(jobUpdateData);

      // Should not call any dependencies
      expect(mockGetAllUserIds).not.toHaveBeenCalled();
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should not update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCompleted).toBe(0);
      expect(stats.eventsDeleted).toBe(0);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should ignore completed job without result", async () => {
      const jobUpdateData = {
        jobId: testJobId,
        status: "completed",
      };

      await jobProcessingService.handleJobUpdate(jobUpdateData);

      // Should not call any dependencies
      expect(mockGetAllUserIds).not.toHaveBeenCalled();
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should not update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCompleted).toBe(0);
      expect(stats.eventsDeleted).toBe(0);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should handle completed job with zero deleted count", async () => {
      const jobUpdateData = {
        jobId: testJobId,
        status: "completed",
        result: {
          deletedCount: 0,
        },
      };

      mockGetAllUserIds.mockReturnValue(testUserIds);

      await jobProcessingService.handleJobUpdate(jobUpdateData);

      // Should not mark users as dirty (because deletedCount is 0, which is falsy)
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should not update stats (because deletedCount is 0, which is falsy)
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCompleted).toBe(0);
      expect(stats.eventsDeleted).toBe(0);
      expect(stats.usersMarkedDirty).toBe(0);
    });

    test("should handle empty user list for job completion", async () => {
      const jobUpdateData = {
        jobId: testJobId,
        status: "completed",
        result: {
          deletedCount: 42,
        },
      };

      mockGetAllUserIds.mockReturnValue([]);

      await jobProcessingService.handleJobUpdate(jobUpdateData);

      // Should not mark any users as dirty
      expect(mockMarkUserDirtyWithContext).not.toHaveBeenCalled();

      // Should still update stats
      const stats = jobProcessingService.getStats();
      expect(stats.jobsCompleted).toBe(1);
      expect(stats.eventsDeleted).toBe(42);
      expect(stats.usersMarkedDirty).toBe(0);
    });
  });

  describe("getStats", () => {
    test("should return initial stats", () => {
      const stats = jobProcessingService.getStats();

      expect(stats).toEqual({
        jobsCreated: 0,
        jobsCompleted: 0,
        eventsDeleted: 0,
        usersMarkedDirty: 0,
        cacheClears: 0,
      });
    });

    test("should return accumulated stats after multiple operations", async () => {
      // Create a job
      const jobData = {
        type: "JOB_CREATED",
        data: {
          jobId: testJobId,
          jobType: "cleanup_outdated_events",
        },
      };

      mockGetAllUserIds.mockReturnValue(testUserIds);

      await jobProcessingService.handleJobCreated(jobData);

      // Complete the job
      const jobUpdateData = {
        jobId: testJobId,
        status: "completed",
        result: {
          deletedCount: 42,
        },
      };

      await jobProcessingService.handleJobUpdate(jobUpdateData);

      // Check accumulated stats
      const stats = jobProcessingService.getStats();

      expect(stats).toEqual({
        jobsCreated: 1,
        jobsCompleted: 1,
        eventsDeleted: 42,
        usersMarkedDirty: 4, // 2 from job creation + 2 from job completion
        cacheClears: 1,
      });
    });

    test("should return separate stats for different service instances", async () => {
      // Create second service instance
      const jobProcessingService2 = createJobProcessingService(
        mockEventPublisher as unknown as EventPublisher,
        mockClearEventCache,
        mockGetAllUserIds,
        mockMarkUserDirty,
        mockMarkUserDirtyWithContext,
        config,
      );

      // Perform operations on first service
      const jobData = {
        type: "JOB_CREATED",
        data: {
          jobId: testJobId,
          jobType: "cleanup_outdated_events",
        },
      };

      mockGetAllUserIds.mockReturnValue(testUserIds);
      await jobProcessingService.handleJobCreated(jobData);

      // Check that second service has different stats
      const stats1 = jobProcessingService.getStats();
      const stats2 = jobProcessingService2.getStats();

      expect(stats1.jobsCreated).toBe(1);
      expect(stats2.jobsCreated).toBe(0);
    });
  });

  describe("integration scenarios", () => {
    test("should handle multiple cleanup jobs in sequence", async () => {
      mockGetAllUserIds.mockReturnValue(testUserIds);

      // Create first job
      await jobProcessingService.handleJobCreated({
        type: "JOB_CREATED",
        data: {
          jobId: "job-1",
          jobType: "cleanup_outdated_events",
        },
      });

      // Complete first job
      await jobProcessingService.handleJobUpdate({
        jobId: "job-1",
        status: "completed",
        result: { deletedCount: 10 },
      });

      // Create second job
      await jobProcessingService.handleJobCreated({
        type: "JOB_CREATED",
        data: {
          jobId: "job-2",
          jobType: "cleanup_outdated_events",
        },
      });

      // Complete second job
      await jobProcessingService.handleJobUpdate({
        jobId: "job-2",
        status: "completed",
        result: { deletedCount: 20 },
      });

      const stats = jobProcessingService.getStats();

      expect(stats).toEqual({
        jobsCreated: 2,
        jobsCompleted: 2,
        eventsDeleted: 30, // 10 + 20
        usersMarkedDirty: 8, // 2 users × 2 jobs × 2 operations
        cacheClears: 2,
      });
    });

    test("should handle mixed job types", async () => {
      mockGetAllUserIds.mockReturnValue(testUserIds);

      // Create cleanup job
      await jobProcessingService.handleJobCreated({
        type: "JOB_CREATED",
        data: {
          jobId: "cleanup-job",
          jobType: "cleanup_outdated_events",
        },
      });

      // Create non-cleanup job (should be ignored)
      await jobProcessingService.handleJobCreated({
        type: "JOB_CREATED",
        data: {
          jobId: "other-job",
          jobType: "other_job_type",
        },
      });

      // Complete cleanup job
      await jobProcessingService.handleJobUpdate({
        jobId: "cleanup-job",
        status: "completed",
        result: { deletedCount: 15 },
      });

      // Complete non-cleanup job (should be ignored because it has no deletedCount)
      await jobProcessingService.handleJobUpdate({
        jobId: "other-job",
        status: "completed",
        result: {}, // No deletedCount
      });

      const stats = jobProcessingService.getStats();

      expect(stats).toEqual({
        jobsCreated: 1, // Only cleanup job counted
        jobsCompleted: 1, // Only cleanup job counted
        eventsDeleted: 15, // Only cleanup job counted
        usersMarkedDirty: 4, // 2 from job creation + 2 from job completion
        cacheClears: 1, // Only cleanup job counted
      });
    });
  });
});
