import { mock } from "bun:test";
import type { JobData } from "../../services/JobQueue";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import type { EventService } from "../../services/EventServiceRefactored";
import type { EventProcessingService } from "../../services/EventProcessingService";
import type { PlanService } from "../../services/PlanService";
import type { StorageService } from "../../services/shared/StorageService";
import type { JobHandlerContext } from "../job/BaseJobHandler";

/**
 * Factory function to create mock JobQueue
 */
export function createMockJobQueue(): JobQueue {
  return {
    updateJobStatus: mock(() => Promise.resolve()),
    createJob: mock(() => Promise.resolve("job-123")),
    failJob: mock(() => Promise.resolve()),
    completeJob: mock(() => Promise.resolve()),
    getJob: mock(() => Promise.resolve(null)),
    getJobs: mock(() => Promise.resolve([])),
    sortJobsChronologically: mock(() => []),
    enqueueCleanupJob: mock(() => Promise.resolve("job-456")),
  } as unknown as JobQueue;
}

/**
 * Factory function to create mock RedisService
 */
export function createMockRedisService(): RedisService {
  return {
    getClient: mock(() => ({})),
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve("OK")),
    del: mock(() => Promise.resolve(1)),
    exists: mock(() => Promise.resolve(0)),
    expire: mock(() => Promise.resolve(1)),
    publish: mock(() => Promise.resolve(1)),
  } as unknown as RedisService;
}

/**
 * Factory function to create mock EventService
 */
export function createMockEventService(): EventService {
  return {
    createEvent: mock(() => Promise.resolve({ id: "event-123" })),
    updateEvent: mock(() => Promise.resolve()),
    deleteEvent: mock(() => Promise.resolve()),
    getEvent: mock(() => Promise.resolve(null)),
    getEvents: mock(() => Promise.resolve([])),
    cleanupOutdatedEvents: mock(() =>
      Promise.resolve({
        deletedCount: 0,
        hasMore: false,
        deletedEvents: [],
      }),
    ),
  } as unknown as EventService;
}

/**
 * Factory function to create mock EventProcessingService
 */
export function createMockEventProcessingService(): EventProcessingService {
  return {
    processFlyer: mock(() => Promise.resolve({ id: "event-123" })),
    processPrivateEvent: mock(() => Promise.resolve({ id: "event-123" })),
    cleanupOutdatedEvents: mock(() => Promise.resolve()),
  } as unknown as EventProcessingService;
}

/**
 * Factory function to create mock PlanService
 */
export function createMockPlanService(): PlanService {
  return {
    checkUserPlan: mock(() => Promise.resolve({ canScan: true })),
    incrementScanCount: mock(() => Promise.resolve()),
    resetWeeklyScans: mock(() => Promise.resolve()),
  } as unknown as PlanService;
}

/**
 * Factory function to create mock StorageService
 */
export function createMockStorageService(): StorageService {
  return {
    uploadFile: mock(() => Promise.resolve("https://example.com/file.jpg")),
    deleteFile: mock(() => Promise.resolve()),
    getSignedUrl: mock(() => Promise.resolve("https://example.com/signed-url")),
  } as unknown as StorageService;
}

/**
 * Factory function to create JobHandlerContext
 */
export function createMockJobHandlerContext(
  jobQueue?: JobQueue,
  redisService?: RedisService,
): JobHandlerContext {
  return {
    jobQueue: jobQueue || createMockJobQueue(),
    redisService: redisService || createMockRedisService(),
  };
}

/**
 * Factory function to create test JobData
 */
export function createTestJobData(overrides: Partial<JobData> = {}): JobData {
  return {
    id: "job-123",
    type: "test_job",
    status: "pending",
    created: new Date().toISOString(),
    data: { creatorId: "user-123" },
    ...overrides,
  };
}

/**
 * Factory function to create process_flyer JobData
 */
export function createProcessFlyerJobData(
  overrides: Partial<JobData> = {},
): JobData {
  return createTestJobData({
    type: "process_flyer",
    data: {
      creatorId: "user-123",
      imageUrl: "https://example.com/image.jpg",
    },
    ...overrides,
  });
}

/**
 * Factory function to create process_private_event JobData
 */
export function createProcessPrivateEventJobData(
  overrides: Partial<JobData> = {},
): JobData {
  return createTestJobData({
    type: "process_private_event",
    data: {
      creatorId: "user-123",
      eventData: {
        title: "Private Event",
        description: "A private event",
        eventDate: new Date().toISOString(),
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      },
    },
    ...overrides,
  });
}

/**
 * Factory function to create cleanup_outdated_events JobData
 */
export function createCleanupEventsJobData(
  overrides: Partial<JobData> = {},
): JobData {
  return createTestJobData({
    type: "cleanup_outdated_events",
    data: {
      batchSize: 100,
    },
    ...overrides,
  });
}

/**
 * Helper function to wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper function to create a mock that resolves after a delay
 */
export function createDelayedMock<T>(
  result: T,
  delayMs: number = 100,
): ReturnType<typeof mock> {
  return mock(
    () =>
      new Promise<T>((resolve) => setTimeout(() => resolve(result), delayMs)),
  );
}

/**
 * Helper function to create a mock that rejects after a delay
 */
export function createDelayedRejectMock(
  error: Error | string,
  delayMs: number = 100,
): ReturnType<typeof mock> {
  return mock(
    () =>
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(error), delayMs),
      ),
  );
}

/**
 * Helper function to verify job progress updates
 */
export function verifyJobProgress(
  updateJobStatusMock: ReturnType<typeof mock>,
  jobId: string,
  expectedUpdates: Array<Partial<JobData>>,
): void {
  expect(updateJobStatusMock).toHaveBeenCalledTimes(expectedUpdates.length);

  expectedUpdates.forEach((expectedUpdate, index) => {
    expect(updateJobStatusMock).toHaveBeenNthCalledWith(
      index + 1,
      jobId,
      expect.objectContaining(expectedUpdate),
    );
  });
}

/**
 * Helper function to create test event data
 */
export function createTestEventData(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-123",
    title: "Test Event",
    description: "A test event",
    eventDate: new Date().toISOString(),
    location: { type: "Point", coordinates: [-122.4194, 37.7749] },
    creatorId: "user-123",
    isPrivate: false,
    isRecurring: false,
    ...overrides,
  };
}

/**
 * Helper function to create test user data
 */
export function createTestUserData(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-123",
    email: "test@example.com",
    displayName: "Test User",
    username: "testuser",
    planType: "FREE",
    scanCount: 0,
    saveCount: 0,
    weeklyScanCount: 0,
    ...overrides,
  };
}
