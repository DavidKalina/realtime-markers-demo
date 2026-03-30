import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { SidequestService, SidequestProgressCallback } from "../../services/SidequestService";
import {
  createJobTracker,
  PRESCRIBE_PIPELINE,
} from "../../services/shared/JobPipeline";
import { jobNotificationService } from "../../services/JobNotificationService";

export class PrescribeQuestHandler extends BaseJobHandler {
  readonly jobType = "prescribe_quest";

  constructor(private readonly sidequestService: SidequestService) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    const tracker = createJobTracker(jobId, PRESCRIBE_PIPELINE, {
      jobQueue: context.jobQueue,
      redisService: context.redisService,
      notificationService: jobNotificationService,
    });

    try {
      const { userId, latitude, longitude, timezone } = job.data as {
        userId: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      };

      await tracker.step("generate");

      const onProgress: SidequestProgressCallback = async (progress, label, candidates) => {
        await tracker.stepProgress(progress, label, undefined, candidates);
      };

      const sidequest = await this.sidequestService.prescribeQuest(
        userId,
        { latitude, longitude, timezone },
        onProgress,
      );

      await tracker.step("save");
      await tracker.complete({
        sidequestId: sidequest.id,
        title: sidequest.title,
        summary: sidequest.summary,
        rarity: sidequest.rarity,
        distanceFromHome: sidequest.distanceFromHome,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[PrescribeQuestHandler] Failed:", message);
      await tracker.fail(message, "Failed to prescribe quest");
    }
  }
}
