import type { JobData, JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";
import type { SidequestPrescriptionService } from "../../services/SidequestPrescriptionService";
import {
  createJobTracker,
  GENERATE_CONCEPTS_PIPELINE,
} from "../../services/shared/JobPipeline";
import type { JobNotificationService } from "../../services/JobNotificationService";

const PENDING_CONCEPTS_TTL = 24 * 60 * 60; // 24 hours

export class GenerateConceptsHandler {
  constructor(
    private readonly sidequestPrescriptionService: SidequestPrescriptionService,
    private readonly jobNotificationService: JobNotificationService,
  ) {}

  async handle(
    jobId: string,
    job: JobData,
    context: { jobQueue: JobQueue; redisService: RedisService },
  ): Promise<void> {
    const tracker = createJobTracker(jobId, GENERATE_CONCEPTS_PIPELINE, {
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

      await tracker.step("generate");

      const concepts = await this.sidequestPrescriptionService.generateConcepts(
        userId,
        { latitude, longitude, timezone },
      );

      // Store concepts in Redis so the client can fetch them later
      await context.redisService.set(
        `pending_concepts:${userId}`,
        JSON.stringify(concepts),
        PENDING_CONCEPTS_TTL,
      );

      await tracker.complete({
        conceptCount: concepts.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[GenerateConceptsHandler] Failed:", message);
      await tracker.fail(message, "Failed to generate quest concepts");
    }
  }
}
