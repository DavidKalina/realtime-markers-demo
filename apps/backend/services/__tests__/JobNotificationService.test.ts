import { describe, it, expect, beforeEach, mock } from "bun:test";
import { JobNotificationService } from "../JobNotificationService";
import type { JobData } from "../JobQueue";
import type { JobCompletionResult } from "../JobNotificationService";

// Mock dependencies
const mockSendToUser = mock(() => Promise.resolve({ success: 1, failed: 0 }));
const mockFindOne = mock(() =>
  Promise.resolve({ id: "user-123", email: "test@example.com" } as {
    id: string;
    email: string;
  } | null),
);

// Mock the PushNotificationService
mock.module("../PushNotificationService", () => ({
  pushNotificationService: {
    sendToUser: mockSendToUser,
  },
}));

// Mock the database
const mockRepository = {
  findOne: mockFindOne,
};

mock.module("../data-source", () => ({
  default: {
    getRepository: mock(() => mockRepository),
  },
}));

describe("JobNotificationService", () => {
  let service: JobNotificationService;

  beforeEach(() => {
    // Reset mocks
    mockSendToUser.mockClear();
    mockFindOne.mockClear();

    service = new JobNotificationService();
  });

  describe("notifyJobCompletion", () => {
    it("should send notification for civic engagement completion", async () => {
      const job: JobData = {
        id: "job-123",
        type: "process_civic_engagement",
        status: "completed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const result: JobCompletionResult = {
        message: "Civic engagement created successfully",
        civicEngagementId: "ce-123",
        type: "FEEDBACK",
        status: "PENDING",
        hasImages: true,
      };

      await service.notifyJobCompletion(job, result);

      expect(mockFindOne).toHaveBeenCalledWith({
        where: { id: "user-123" },
      });

      expect(mockSendToUser).toHaveBeenCalledWith("user-123", {
        title: "✅ Civic Engagement Submitted",
        body: "Your feedback has been successfully submitted and is now under review. We'll notify you when there are updates.",
        data: {
          type: "job_completion",
          jobId: "job-123",
          jobType: "process_civic_engagement",
          result: result,
          timestamp: expect.any(String),
        },
        priority: "normal",
      });
    });

    it("should send notification for flyer completion with single event", async () => {
      const job: JobData = {
        id: "job-456",
        type: "process_flyer",
        status: "completed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const result: JobCompletionResult = {
        eventId: "event-123",
        title: "Summer Festival",
        emoji: "🎉",
        coordinates: [-122.4194, 37.7749],
        message: "Event successfully processed and added to the database!",
      };

      await service.notifyJobCompletion(job, result);

      expect(mockSendToUser).toHaveBeenCalledWith("user-123", {
        title: "🎉 Event Added!",
        body: '"Summer Festival" has been successfully added to the community calendar.',
        data: {
          type: "job_completion",
          jobId: "job-456",
          jobType: "process_flyer",
          result: result,
          timestamp: expect.any(String),
        },
        priority: "normal",
      });
    });

    it("should send notification for flyer completion with multiple events", async () => {
      const job: JobData = {
        id: "job-789",
        type: "process_flyer",
        status: "completed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const result: JobCompletionResult = {
        events: [
          {
            eventId: "event-1",
            title: "Event 1",
            emoji: "🎉",
            coordinates: [-122.4194, 37.7749],
          },
          {
            eventId: "event-2",
            title: "Event 2",
            emoji: "🎊",
            coordinates: [-122.4194, 37.7749],
          },
        ],
        message: "Successfully processed 2 events from the flyer!",
        isMultiEvent: true,
      };

      await service.notifyJobCompletion(job, result);

      expect(mockSendToUser).toHaveBeenCalledWith("user-123", {
        title: "🎉 2 Events Found!",
        body: "We found 2 events in your flyer and added them to the community calendar.",
        data: {
          type: "job_completion",
          jobId: "job-789",
          jobType: "process_flyer",
          result: result,
          timestamp: expect.any(String),
        },
        priority: "normal",
      });
    });

    it("should send notification for duplicate event", async () => {
      const job: JobData = {
        id: "job-101",
        type: "process_flyer",
        status: "completed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const result: JobCompletionResult = {
        eventId: "event-123",
        title: "Existing Event",
        emoji: "🎉",
        coordinates: [-122.4194, 37.7749],
        isDuplicate: true,
        message: "Duplicate event found",
      };

      await service.notifyJobCompletion(job, result);

      expect(mockSendToUser).toHaveBeenCalledWith("user-123", {
        title: "🔍 Event Already Exists",
        body: '"Existing Event" was already in our database, so we linked to the existing event.',
        data: {
          type: "job_completion",
          jobId: "job-101",
          jobType: "process_flyer",
          result: result,
          timestamp: expect.any(String),
        },
        priority: "normal",
      });
    });

    it("should send notification for low confidence result", async () => {
      const job: JobData = {
        id: "job-202",
        type: "process_flyer",
        status: "completed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const result: JobCompletionResult = {
        message: "No event detected in the image",
        confidence: 0.5,
        threshold: 0.75,
      };

      await service.notifyJobCompletion(job, result);

      expect(mockSendToUser).toHaveBeenCalledWith("user-123", {
        title: "❓ No Event Detected",
        body: "We couldn't find a clear event in your image. Please try with a different flyer or contact support.",
        data: {
          type: "job_completion",
          jobId: "job-202",
          jobType: "process_flyer",
          result: result,
          timestamp: expect.any(String),
        },
        priority: "normal",
      });
    });

    it("should skip notification for unknown job types", async () => {
      const job: JobData = {
        id: "job-303",
        type: "unknown_job_type",
        status: "completed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const result: JobCompletionResult = {
        message: "Unknown job completed",
      };

      await service.notifyJobCompletion(job, result);

      expect(mockSendToUser).not.toHaveBeenCalled();
    });

    it("should skip notification when no creator ID", async () => {
      const job: JobData = {
        id: "job-404",
        type: "process_flyer",
        status: "completed",
        created: new Date().toISOString(),
        data: {}, // No creatorId
      };

      const result: JobCompletionResult = {
        message: "Job completed",
      };

      await service.notifyJobCompletion(job, result);

      expect(mockFindOne).not.toHaveBeenCalled();
      expect(mockSendToUser).not.toHaveBeenCalled();
    });

    it("should skip notification when user not found", async () => {
      mockFindOne.mockResolvedValue(
        null as { id: string; email: string } | null,
      );

      const job: JobData = {
        id: "job-505",
        type: "process_flyer",
        status: "completed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const result: JobCompletionResult = {
        message: "Job completed",
      };

      await service.notifyJobCompletion(job, result);

      expect(mockFindOne).toHaveBeenCalled();
      expect(mockSendToUser).not.toHaveBeenCalled();
    });
  });

  describe("notifyJobFailure", () => {
    it("should send notification for civic engagement failure", async () => {
      const job: JobData = {
        id: "job-606",
        type: "process_civic_engagement",
        status: "failed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const error = "Validation failed";
      const message = "Please check your input and try again";

      await service.notifyJobFailure(job, error, message);

      expect(mockSendToUser).toHaveBeenCalledWith("user-123", {
        title: "❌ Civic Engagement Failed",
        body: "Please check your input and try again",
        data: {
          type: "job_failure",
          jobId: "job-606",
          jobType: "process_civic_engagement",
          error: "Validation failed",
          message: "Please check your input and try again",
          timestamp: expect.any(String),
        },
        priority: "high",
      });
    });

    it("should send notification for flyer failure", async () => {
      const job: JobData = {
        id: "job-707",
        type: "process_flyer",
        status: "failed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const error = "Image processing failed";
      const message = "Please try again with a different image";

      await service.notifyJobFailure(job, error, message);

      expect(mockSendToUser).toHaveBeenCalledWith("user-123", {
        title: "❌ Flyer Processing Failed",
        body: "Please try again with a different image",
        data: {
          type: "job_failure",
          jobId: "job-707",
          jobType: "process_flyer",
          error: "Image processing failed",
          message: "Please try again with a different image",
          timestamp: expect.any(String),
        },
        priority: "high",
      });
    });

    it("should skip notification for unknown job types", async () => {
      const job: JobData = {
        id: "job-808",
        type: "unknown_job_type",
        status: "failed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const error = "Unknown error";

      await service.notifyJobFailure(job, error);

      expect(mockSendToUser).not.toHaveBeenCalled();
    });

    it("should handle notification errors gracefully", async () => {
      mockSendToUser.mockRejectedValue(new Error("Push notification failed"));

      const job: JobData = {
        id: "job-909",
        type: "process_flyer",
        status: "failed",
        created: new Date().toISOString(),
        data: { creatorId: "user-123" },
      };

      const error = "Test error";

      // Should not throw
      await service.notifyJobFailure(job, error);

      expect(mockSendToUser).toHaveBeenCalled();
    });
  });
});
