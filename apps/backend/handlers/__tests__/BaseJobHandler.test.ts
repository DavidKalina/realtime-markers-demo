import { describe, it, expect, beforeEach, mock } from "bun:test";
import { BaseJobHandler, type JobHandlerContext } from "../job/BaseJobHandler";
import type { JobData } from "../../services/JobQueue";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";

// Create a concrete implementation of BaseJobHandler for testing
class TestJobHandler extends BaseJobHandler {
  readonly jobType = "test_job";

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    // Simulate job processing
    await this.startJob(jobId, context, "Starting test job");

    // Simulate progress updates
    await this.updateJobProgress(jobId, context, {
      progress: 50,
      progressStep: "Processing test data",
    });

    // Simulate completion
    await this.completeJob(jobId, context, { success: true }, "event-123");
  }
}

// Create a handler that fails for testing error scenarios
class FailingJobHandler extends BaseJobHandler {
  readonly jobType = "failing_job";

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    await this.startJob(jobId, context, "Starting failing job");

    // Simulate an error
    throw new Error("Test error occurred");
  }
}

describe("BaseJobHandler", () => {
  let testHandler: TestJobHandler;
  let failingHandler: FailingJobHandler;
  let mockJobQueue: JobQueue;
  let mockRedisService: RedisService;
  let mockContext: JobHandlerContext;

  beforeEach(() => {
    // Create mock services
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

    mockContext = {
      jobQueue: mockJobQueue,
      redisService: mockRedisService,
    };

    testHandler = new TestJobHandler();
    failingHandler = new FailingJobHandler();
  });

  describe("Job Type Validation", () => {
    it("should correctly identify job types", () => {
      const testJob: JobData = {
        id: "job-123",
        type: "test_job",
        status: "pending",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const otherJob: JobData = {
        id: "job-456",
        type: "other_job",
        status: "pending",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      expect(testHandler.canHandle(testJob)).toBe(true);
      expect(testHandler.canHandle(otherJob)).toBe(false);
      expect(failingHandler.canHandle(testJob)).toBe(false);
      expect(failingHandler.canHandle(otherJob)).toBe(false);
    });

    it("should have correct job type property", () => {
      expect(testHandler.jobType).toBe("test_job");
      expect(failingHandler.jobType).toBe("failing_job");
    });
  });

  describe("Job Processing Flow", () => {
    it("should process a job successfully", async () => {
      const testJob: JobData = {
        id: "job-123",
        type: "test_job",
        status: "pending",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      await testHandler.handle("job-123", testJob, mockContext);

      // Verify that job status was updated to processing
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "processing",
        progress: 5,
        progressStep: "Starting test job",
        progressDetails: {
          currentStep: "1",
          totalSteps: 5, // Default for unknown job type
          stepProgress: 0,
          stepDescription: "Starting test job",
        },
      });

      // Verify that progress was updated
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        progress: 50,
        progressStep: "Processing test data",
      });

      // Verify that job was completed
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "completed",
        progress: 100,
        result: { success: true },
        eventId: "event-123",
        completed: expect.any(String),
      });
    });

    it("should handle job processing errors", async () => {
      const testJob: JobData = {
        id: "job-123",
        type: "failing_job",
        status: "pending",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      try {
        await failingHandler.handle("job-123", testJob, mockContext);
      } catch (error) {
        // Expected to throw
      }

      // Verify that job was started
      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "processing",
        progress: 5,
        progressStep: "Starting failing job",
        progressDetails: {
          currentStep: "1",
          totalSteps: 5,
          stepProgress: 0,
          stepDescription: "Starting failing job",
        },
      });
    });
  });

  describe("Protected Methods", () => {
    it("should start job with correct progress", async () => {
      await testHandler["startJob"](
        "job-123",
        mockContext,
        "Custom start message",
      );

      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "processing",
        progress: 5,
        progressStep: "Custom start message",
        progressDetails: {
          currentStep: "1",
          totalSteps: 5,
          stepProgress: 0,
          stepDescription: "Custom start message",
        },
      });
    });

    it("should update job progress correctly", async () => {
      const updates = {
        progress: 75,
        progressStep: "Almost done",
        progressDetails: {
          currentStep: "3",
          totalSteps: 4,
          stepProgress: 90,
          stepDescription: "Final processing step",
        },
      };

      await testHandler["updateJobProgress"]("job-123", mockContext, updates);

      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith(
        "job-123",
        updates,
      );
    });

    it("should fail job with error details", async () => {
      const error = new Error("Test error");
      const message = "A test error occurred";

      await testHandler["failJob"]("job-123", mockContext, error, message);

      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "failed",
        progress: 100,
        error: "Test error",
        message: "A test error occurred",
        completed: expect.any(String),
      });
    });

    it("should fail job with string error", async () => {
      const errorMessage = "String error message";

      await testHandler["failJob"]("job-123", mockContext, errorMessage);

      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "failed",
        progress: 100,
        error: "String error message",
        message: "An error occurred while processing the job",
        completed: expect.any(String),
      });
    });

    it("should complete job with result", async () => {
      const result = {
        eventId: "event-456",
        success: true,
        data: { processed: true },
      };
      const eventId = "event-456";

      await testHandler["completeJob"]("job-123", mockContext, result, eventId);

      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "completed",
        progress: 100,
        result,
        eventId,
        completed: expect.any(String),
      });
    });

    it("should complete job without eventId", async () => {
      const result = { success: true };

      await testHandler["completeJob"]("job-123", mockContext, result);

      expect(mockJobQueue.updateJobStatus).toHaveBeenCalledWith("job-123", {
        status: "completed",
        progress: 100,
        result,
        completed: expect.any(String),
      });
    });
  });

  describe("Step Count Logic", () => {
    it("should return correct step counts for known job types", () => {
      // Test with a handler that has a known job type
      const processFlyerHandler = new (class extends BaseJobHandler {
        readonly jobType = "process_flyer";
        async handle(): Promise<void> {}
      })();

      const processPrivateEventHandler = new (class extends BaseJobHandler {
        readonly jobType = "process_private_event";
        async handle(): Promise<void> {}
      })();

      const cleanupHandler = new (class extends BaseJobHandler {
        readonly jobType = "cleanup_outdated_events";
        async handle(): Promise<void> {}
      })();

      // These should match the stepCounts in BaseJobHandler
      expect(processFlyerHandler["getTotalStepsForJobType"]()).toBe(6);
      expect(processPrivateEventHandler["getTotalStepsForJobType"]()).toBe(4);
      expect(cleanupHandler["getTotalStepsForJobType"]()).toBe(3);
    });

    it("should return default step count for unknown job types", () => {
      expect(testHandler["getTotalStepsForJobType"]()).toBe(5);
    });
  });

  describe("Job Handler Interface", () => {
    it("should implement the JobHandler interface correctly", () => {
      // Test that the handler has all required properties and methods
      expect(testHandler.jobType).toBeDefined();
      expect(typeof testHandler.handle).toBe("function");
      expect(typeof testHandler.canHandle).toBe("function");

      // Test that handle method is async
      const handleResult = testHandler.handle(
        "job-123",
        {
          id: "job-123",
          type: "test_job",
          status: "pending",
          created: new Date().toISOString(),
          data: { creatorId: "user-123" },
        },
        mockContext,
      );

      expect(handleResult).toBeInstanceOf(Promise);
    });
  });
});
