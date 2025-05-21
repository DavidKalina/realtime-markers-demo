import type { JobData } from "../../services/JobQueue";
import { JobQueue } from "../../services/JobQueue";
import { RedisService } from "../../services/shared/RedisService";

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
      progress: 1,
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
      progress: 1,
      result,
      eventId,
      completed: new Date().toISOString(),
    });
  }
}
