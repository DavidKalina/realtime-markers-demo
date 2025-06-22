import type { JobData } from "../../services/JobQueue";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";

export interface JobHandlerContext {
  jobQueue: JobQueue;
  redisService: RedisService;
  // Add other services as needed
}

export interface JobHandler {
  /**
   * The type of job this handler processes
   */
  readonly jobType: string;

  /**
   * Process a job
   * @param jobId The ID of the job to process
   * @param job The job data
   * @param context The context containing required services
   */
  handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void>;

  /**
   * Validate if this handler can process the given job
   * @param job The job to validate
   */
  canHandle(job: JobData): boolean;
}

export abstract class BaseJobHandler implements JobHandler {
  abstract readonly jobType: string;

  abstract handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void>;

  canHandle(job: JobData): boolean {
    return job.type === this.jobType;
  }

  protected async startJob(
    jobId: string,
    context: JobHandlerContext,
    stepDescription: string = "Starting job processing",
  ): Promise<void> {
    await this.updateJobProgress(jobId, context, {
      status: "processing",
      progress: 5,
      progressStep: stepDescription,
      progressDetails: {
        currentStep: "1",
        totalSteps: this.getTotalStepsForJobType(),
        stepProgress: 0,
        stepDescription: stepDescription,
      },
    });
  }

  protected async updateJobProgress(
    jobId: string,
    context: JobHandlerContext,
    updates: Partial<JobData>,
  ): Promise<void> {
    await context.jobQueue.updateJobStatus(jobId, updates);
  }

  protected async failJob(
    jobId: string,
    context: JobHandlerContext,
    error: Error | string,
    message?: string,
  ): Promise<void> {
    await this.updateJobProgress(jobId, context, {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? error.message : error,
      message: message || "An error occurred while processing the job",
      completed: new Date().toISOString(),
    });
  }

  protected async completeJob(
    jobId: string,
    context: JobHandlerContext,
    result: JobData["result"],
    eventId?: string,
  ): Promise<void> {
    await this.updateJobProgress(jobId, context, {
      status: "completed",
      progress: 100,
      result,
      eventId,
      completed: new Date().toISOString(),
    });
  }

  private getTotalStepsForJobType(): number {
    const stepCounts: Record<string, number> = {
      process_flyer: 6,
      process_private_event: 4,
      process_multi_event_flyer: 8,
      cleanup_outdated_events: 3,
      process_civic_engagement: 4,
    };

    return stepCounts[this.jobType] || 5;
  }
}
