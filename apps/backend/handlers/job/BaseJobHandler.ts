import type { JobData } from "../../services/JobQueue";
import type { JobQueue } from "../../services/JobQueue";
import type { RedisService } from "../../services/shared/RedisService";

export interface JobHandlerContext {
  jobQueue: JobQueue;
  redisService: RedisService;
}

export interface JobHandler {
  readonly jobType: string;
  handle(
    jobId: string,
    job: JobData,
    context: JobHandlerContext,
  ): Promise<void>;
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
}
