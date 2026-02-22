import { describe, it, expect, beforeEach, mock } from "bun:test";
import { BaseJobHandler, type JobHandlerContext } from "../job/BaseJobHandler";
import type { JobData } from "../../services/JobQueue";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";

// Create a concrete implementation of BaseJobHandler for testing
class TestJobHandler extends BaseJobHandler {
  readonly jobType = "test_job";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    // No-op for testing
  }
}

describe("BaseJobHandler", () => {
  let testHandler: TestJobHandler;
  let mockJobQueue: JobQueue;
  let mockRedisService: RedisService;
  let mockContext: JobHandlerContext;

  beforeEach(() => {
    mockJobQueue = {
      updateJobStatus: mock(() => Promise.resolve()),
      getJobStatus: mock(() => Promise.resolve(null)),
    } as unknown as JobQueue;

    mockRedisService = {
      getClient: mock(() => ({})),
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve("OK")),
      del: mock(() => Promise.resolve(1)),
    } as unknown as RedisService;

    mockContext = {
      jobQueue: mockJobQueue,
      redisService: mockRedisService,
    };

    testHandler = new TestJobHandler();
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
    });

    it("should have correct job type property", () => {
      expect(testHandler.jobType).toBe("test_job");
    });
  });

  describe("Job Handler Interface", () => {
    it("should implement the JobHandler interface correctly", () => {
      expect(testHandler.jobType).toBeDefined();
      expect(typeof testHandler.handle).toBe("function");
      expect(typeof testHandler.canHandle).toBe("function");

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
