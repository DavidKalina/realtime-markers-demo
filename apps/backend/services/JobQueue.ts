// src/services/JobQueue.ts
import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";

export class JobQueue {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Enqueue a new job
   */
  async enqueue(
    jobType: string,
    data: Record<string, any>,
    options: { bufferData?: Buffer } = {}
  ): Promise<string> {
    const jobId = uuidv4();

    // Create job metadata (excluding large buffer data)
    const jobData = {
      id: jobId,
      type: jobType,
      status: "pending",
      created: new Date().toISOString(),
      data: { ...data, hasBuffer: !!options.bufferData },
      progress: 0,
      progressPercentage: 0,
    };

    // Store job metadata in Redis
    await this.redis.set(`job:${jobId}`, JSON.stringify(jobData));

    // If buffer data is provided, store separately
    if (options.bufferData) {
      await this.redis.set(`job:${jobId}:buffer`, options.bufferData);
    }

    // Add to processing queue
    await this.redis.rpush("jobs:pending", jobId);

    // Publish notification
    await this.redis.publish("job_created", jobId);

    return jobId;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<Record<string, any> | null> {
    const jobData = await this.redis.get(`job:${jobId}`);
    if (!jobData) return null;
    return JSON.parse(jobData);
  }

  /**
   * Enqueue a cleanup job for outdated events
   */
  async enqueueCleanupJob(batchSize = 100): Promise<string> {
    return this.enqueue("cleanup_outdated_events", { batchSize });
  }

  /**
   * Update job status
   * @param jobId The ID of the job to update
   * @param updates Object with fields to update
   */
  async updateJobStatus(jobId: string, updates: Record<string, any>): Promise<void> {
    const jobData = await this.redis.get(`job:${jobId}`);
    if (!jobData) throw new Error(`Job ${jobId} not found`);

    const job = JSON.parse(jobData);

    // Process special fields
    if (updates.progress !== undefined) {
      // Convert progress from string message to normalized percentage if needed
      if (typeof updates.progress === "string" && updates.progressPercentage === undefined) {
        // The progress percentage will be calculated by ProgressReportingService
        // and provided as progressPercentage field
        updates.progressMessage = updates.progress;
      }
      // If progress is a number between 0-1, convert to percentage (0-100)
      else if (
        typeof updates.progress === "number" &&
        updates.progress <= 1 &&
        updates.progressPercentage === undefined
      ) {
        updates.progressPercentage = Math.round(updates.progress * 100);
      }
    }

    // Ensure completed jobs have 100% progress
    if (updates.status === "completed" && updates.progressPercentage === undefined) {
      updates.progressPercentage = 100;
    }

    // Ensure failed jobs have 100% progress (process is complete)
    if (updates.status === "failed" && updates.progressPercentage === undefined) {
      updates.progressPercentage = 100;
    }

    const updatedJob = { ...job, ...updates, updated: new Date().toISOString() };

    await this.redis.set(`job:${jobId}`, JSON.stringify(updatedJob));
    await this.redis.publish(
      `job:${jobId}:updates`,
      JSON.stringify({
        id: jobId,
        ...updates,
        updated: updatedJob.updated,
      })
    );
  }
}
