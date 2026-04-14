import type { JobData, JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import type { SidequestPrescriptionService } from "../../services/SidequestPrescriptionService";
import type { SidequestProgressCallback } from "../../services/SidequestService";
import {
  createJobTracker,
  PRESCRIBE_PIPELINE,
} from "../../services/shared/JobPipeline";
import type { JobNotificationService } from "../../services/JobNotificationService";

export class PrescribeQuestHandler {
  constructor(
    private readonly sidequestPrescriptionService: SidequestPrescriptionService,
    private readonly jobNotificationService: JobNotificationService,
  ) {}

  async handle(
    jobId: string,
    job: JobData,
    context: { jobQueue: JobQueue; redisService: RedisService },
  ): Promise<void> {
    const tracker = createJobTracker(jobId, PRESCRIBE_PIPELINE, {
      jobQueue: context.jobQueue,
      redisService: context.redisService,
      notificationService: this.jobNotificationService,
    });

    try {
      const { userId, latitude, longitude, timezone, model, questType, challengeCategory } = job.data as {
        userId: string;
        latitude: number;
        longitude: number;
        timezone?: string;
        model?: string;
        questType?: "venue" | "challenge";
        challengeCategory?: string;
      };

      await tracker.step("generate");

      const onProgress: SidequestProgressCallback = async (progress, label, candidates) => {
        await tracker.stepProgress(progress, label, undefined, candidates);
      };

      const sidequest = await this.sidequestPrescriptionService.prescribeQuest(
        userId,
        { latitude, longitude, timezone, model, questType, challengeCategory },
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
