import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { SidequestService, SidequestProgressCallback } from "../../services/SidequestService";
import {
  createJobTracker,
  SIDEQUEST_PIPELINE,
} from "../../services/shared/JobPipeline";
import { jobNotificationService } from "../../services/JobNotificationService";

export class GenerateSidequestHandler extends BaseJobHandler {
  readonly jobType = "generate_sidequest";

  constructor(private readonly sidequestService: SidequestService) {
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
        sidequestId,
        prompt,
        radiusMiles,
        budgetMax,
        latitude,
        longitude,
        timezone,
        activityTypes,
        intention,
        city,
        surpriseMe,
        note,
      } = job.data as {
        userId: string;
        sidequestId?: string;
        prompt: string;
        radiusMiles: number;
        budgetMax: number;
        latitude: number;
        longitude: number;
        timezone?: string;
        activityTypes?: string[];
        intention?: string;
        city?: string;
        surpriseMe?: boolean;
        note?: string;
      };

      await tracker.step("generate");

      const onProgress: SidequestProgressCallback = async (progress, label, candidates) => {
        await tracker.stepProgress(progress, label, undefined, candidates);
      };

      const sidequest = await this.sidequestService.create(
        userId,
        {
          sidequestId,
          prompt,
          radiusMiles,
          budgetMax,
          latitude,
          longitude,
          timezone,
          activityTypes,
          intention,
          city,
          surpriseMe,
          note,
        },
        onProgress,
      );

      await tracker.step("save");
      await tracker.complete({
        sidequestId: sidequest.id,
        title: sidequest.title,
        summary: sidequest.summary,
        optionCount: sidequest.children?.length ?? 3,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[GenerateSidequestHandler] Failed:", message);
      await tracker.fail(message, "Failed to forge sidequest");
    }
  }
}
