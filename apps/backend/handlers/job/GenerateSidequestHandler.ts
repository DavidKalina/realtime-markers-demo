import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { ItineraryService } from "../../services/ItineraryService";
import {
  createJobTracker,
  SIDEQUEST_PIPELINE,
} from "../../services/shared/JobPipeline";
import { jobNotificationService } from "../../services/JobNotificationService";

export class GenerateSidequestHandler extends BaseJobHandler {
  readonly jobType = "generate_sidequest";

  constructor(private readonly itineraryService: ItineraryService) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    const tracker = createJobTracker(jobId, SIDEQUEST_PIPELINE, {
      jobQueue: context.jobQueue,
      redisService: context.redisService,
      notificationService: jobNotificationService,
    });

    try {
      const {
        userId,
        itineraryId,
        prompt,
        radiusMiles,
        budgetMax,
        latitude,
        longitude,
        timezone,
      } = job.data as {
        userId: string;
        itineraryId?: string;
        prompt: string;
        radiusMiles: number;
        budgetMax: number;
        latitude: number;
        longitude: number;
        timezone?: string;
      };

      await tracker.step("generate");
      await tracker.stepProgress(10, "Scouting nearby waypoints");

      const itinerary = await this.itineraryService.createSidequest(userId, {
        itineraryId,
        prompt,
        radiusMiles,
        budgetMax,
        latitude,
        longitude,
        timezone,
      });

      await tracker.stepProgress(90, "Quest forged");

      await tracker.step("save");
      await tracker.complete({
        itineraryId: itinerary.id,
        title: itinerary.title,
        summary: itinerary.summary,
        itemCount: itinerary.items?.length ?? 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[GenerateSidequestHandler] Failed:", message);
      await tracker.fail(message, "Failed to forge sidequest");
    }
  }
}
