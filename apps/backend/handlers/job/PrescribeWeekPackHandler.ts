import type { JobData } from "../../services/JobQueue";
import type { JobHandlerContext } from "./BaseJobHandler";
import { BaseJobHandler } from "./BaseJobHandler";
import type { SidequestPrescriptionService } from "../../services/SidequestPrescriptionService";
import type { SidequestProgressCallback } from "../../services/SidequestPrescriptionService";
import {
  createJobTracker,
  WEEK_PACK_PIPELINE,
} from "../../services/shared/JobPipeline";
import type { JobNotificationService } from "../../services/JobNotificationService";

export class PrescribeWeekPackHandler extends BaseJobHandler {
  readonly jobType = "prescribe_week_pack";

  constructor(
    private readonly sidequestPrescriptionService: SidequestPrescriptionService,
    private readonly jobNotificationService: JobNotificationService,
  ) {
    super();
  }

  async handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void> {
    const tracker = createJobTracker(jobId, WEEK_PACK_PIPELINE, {
      jobQueue: context.jobQueue,
      redisService: context.redisService,
      notificationService: this.jobNotificationService,
    });

    try {
      const { userId, latitude, longitude, timezone } = job.data as {
        userId: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      };

      await tracker.step("generate_1");

      const onProgress: SidequestProgressCallback = async (progress, label) => {
        // Map batch-level progress to the appropriate pipeline step
        if (progress < 50) {
          await tracker.stepProgress(progress * 2, label);
        } else {
          // Switch to generate_2 step once past 50%
          await tracker.step("generate_2");
          await tracker.stepProgress((progress - 50) * 2, label);
        }
      };

      const result = await this.sidequestPrescriptionService.prescribeWeekPack(
        userId,
        { latitude, longitude, timezone },
        onProgress,
      );

      await tracker.step("save");
      await tracker.complete({
        batchId: result.batchId,
        sidequestIds: result.quests.map((q) => q.id),
        titles: result.quests.map((q) => q.title),
        questCount: result.quests.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[PrescribeWeekPackHandler] Failed:", message);
      await tracker.fail(message, "Failed to prescribe week pack");
    }
  }
}
