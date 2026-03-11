import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { ItineraryService } from "../../services/ItineraryService";
import {
  createJobTracker,
  ITINERARY_PIPELINE,
} from "../../services/shared/JobPipeline";
import { jobNotificationService } from "../../services/JobNotificationService";

export class GenerateItineraryHandler extends BaseJobHandler {
  readonly jobType = "generate_itinerary";

  constructor(private readonly itineraryService: ItineraryService) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    const tracker = createJobTracker(jobId, ITINERARY_PIPELINE, {
      jobQueue: context.jobQueue,
      redisService: context.redisService,
      notificationService: jobNotificationService,
    });

    try {
      const {
        userId,
        city,
        plannedDate,
        budgetMin,
        budgetMax,
        durationHours,
        activityTypes,
        stopCount,
        startTime,
        endTime,
      } = job.data as {
        userId: string;
        city: string;
        plannedDate: string;
        budgetMin: number;
        budgetMax: number;
        durationHours: number;
        activityTypes: string[];
        stopCount: number;
        startTime?: string;
        endTime?: string;
      };

      await tracker.step("fetch_events");
      await tracker.stepProgress(50, "Searching city events");

      await tracker.step("generate");
      await tracker.stepProgress(10, "Calling AI planner");

      const itinerary = await this.itineraryService.create(userId, {
        city,
        plannedDate,
        budgetMin,
        budgetMax,
        durationHours,
        activityTypes,
        stopCount,
        startTime,
        endTime,
      });

      await tracker.stepProgress(90, "Itinerary generated");

      await tracker.step("save");
      await tracker.complete({
        itineraryId: itinerary.id,
        title: itinerary.title,
        summary: itinerary.summary,
        itemCount: itinerary.items?.length ?? 0,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[GenerateItineraryHandler] Failed:", message);
      await tracker.fail(message, "Failed to generate itinerary");
    }
  }
}
