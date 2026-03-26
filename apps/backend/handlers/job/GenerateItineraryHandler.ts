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
        itineraryId,
        title,
        city,
        centerLatitude,
        centerLongitude,
        radiusMiles,
        plannedDate,
        budgetMin,
        budgetMax,
        durationHours,
        activityTypes,
        stopCount,
        intention,
        anchorStops,
        surpriseMe,
        timezone,
        isTemplate,
      } = job.data as {
        userId: string;
        itineraryId?: string;
        title?: string;
        city?: string;
        centerLatitude?: number;
        centerLongitude?: number;
        radiusMiles?: number;
        plannedDate?: string;
        budgetMin: number;
        budgetMax: number;
        durationHours: number;
        activityTypes: string[];
        stopCount: number;
        intention?: string;
        surpriseMe?: boolean;
        timezone?: string;
        isTemplate?: boolean;
        anchorStops?: {
          coordinates: [number, number];
          label?: string;
          address?: string;
          placeId?: string;
          primaryType?: string;
          rating?: number;
          note?: string;
        }[];
      };

      await tracker.step("fetch_events");
      await tracker.stepProgress(50, "Searching nearby events");

      await tracker.step("generate");
      await tracker.stepProgress(10, "Calling AI planner");

      const itinerary = await this.itineraryService.create(userId, {
        itineraryId,
        title,
        city,
        centerLatitude,
        centerLongitude,
        radiusMiles,
        plannedDate: plannedDate ? new Date(plannedDate) : undefined,
        isTemplate,
        budgetMin,
        budgetMax,
        durationHours,
        activityTypes,
        stopCount,
        intention,
        anchorStops,
        surpriseMe,
        timezone,
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
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[GenerateItineraryHandler] Failed:", message);
      await tracker.fail(message, "Failed to generate itinerary");
    }
  }
}
