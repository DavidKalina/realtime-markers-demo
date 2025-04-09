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

  // Add to JobQueue.ts
  async enqueueCleanupJob(batchSize = 100): Promise<string> {
    return this.enqueue("cleanup_outdated_events", { batchSize });
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, updates: Record<string, any>): Promise<void> {
    const jobData = await this.redis.get(`job:${jobId}`);
    if (!jobData) throw new Error(`Job ${jobId} not found`);

    const job = JSON.parse(jobData);
    const updatedJob = { ...job, ...updates, updated: new Date().toISOString() };

    console.log(`[JobQueue] Updating job ${jobId} status:`, {
      previousStatus: job.status,
      newStatus: updates.status,
      progress: updates.progress,
      timestamp: updatedJob.updated
    });

    await this.redis.set(`job:${jobId}`, JSON.stringify(updatedJob));

    const updateMessage = JSON.stringify({
      id: jobId,
      ...updates,
      updated: updatedJob.updated,
    });

    console.log(`[JobQueue] Publishing job update to Redis channel job:${jobId}:updates:`, updateMessage);
    await this.redis.publish(`job:${jobId}:updates`, updateMessage);
  }
}
