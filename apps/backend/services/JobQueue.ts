// src/services/JobQueue.ts
import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { RedisService } from "./shared/RedisService";

export interface JobData {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  created: string;
  updated?: string;
  progress?: number;
  error?: string;
  data: Record<string, unknown>;
}

export interface PrivateEventJobData {
  type: "process_private_event";
  data: {
    eventDetails: {
      emoji: string;
      emojiDescription?: string;
      title: string;
      date: string;
      endDate?: string;
      address: string;
      location: { type: "Point"; coordinates: [number, number] };
      description: string;
      categories?: { id: string }[];
      timezone?: string;
      locationNotes?: string;
      groupId?: string;
    };
    creatorId: string;
    sharedWithIds: string[];
    userCoordinates?: { lat: number; lng: number };
  };
}

export class JobQueue {
  private redisService: RedisService;

  constructor(redis: Redis) {
    this.redisService = RedisService.getInstance(redis);
  }

  /**
   * Enqueue a new job
   */
  async enqueue(
    jobType: string,
    data: Record<string, unknown>,
    options: { bufferData?: Buffer } = {},
  ): Promise<string> {
    const jobId = uuidv4();

    // Create job metadata (excluding large buffer data)
    const jobData: JobData = {
      id: jobId,
      type: jobType,
      status: "pending",
      created: new Date().toISOString(),
      data: { ...data, hasBuffer: !!options.bufferData },
    };

    // Store job metadata in Redis
    await this.redisService.set(`job:${jobId}`, jobData);

    // If buffer data is provided, store separately
    if (options.bufferData) {
      await this.redisService.set(`job:${jobId}:buffer`, options.bufferData);
    }

    // Add to processing queue
    await this.redisService.getClient().rpush("jobs:pending", jobId);

    // Publish notification
    await this.redisService.publish("job_created", {
      type: "JOB_CREATED",
      data: { jobId },
    });

    return jobId;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobData | null> {
    return this.redisService.get<JobData>(`job:${jobId}`);
  }

  // Add to JobQueue.ts
  async enqueueCleanupJob(batchSize = 100): Promise<string> {
    return this.enqueue("cleanup_outdated_events", { batchSize });
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    updates: Partial<JobData>,
  ): Promise<void> {
    const jobData = await this.getJobStatus(jobId);
    if (!jobData) throw new Error(`Job ${jobId} not found`);

    const updatedJob: JobData = {
      ...jobData,
      ...updates,
      updated: new Date().toISOString(),
    };

    console.log(`[JobQueue] Updating job ${jobId} status:`, {
      previousStatus: jobData.status,
      newStatus: updates.status,
      progress: updates.progress,
      timestamp: updatedJob.updated,
    });

    await this.redisService.set(`job:${jobId}`, updatedJob);

    const updateMessage = {
      id: jobId,
      ...updates,
      updated: updatedJob.updated,
    };

    console.log(
      `[JobQueue] Publishing job update to Redis channel job:${jobId}:updates:`,
      updateMessage,
    );
    await this.redisService.publish(`job:${jobId}:updates`, {
      type: "JOB_UPDATE",
      data: updateMessage,
    });
  }

  /**
   * Enqueue a private event processing job
   */
  async enqueuePrivateEventJob(
    eventDetails: PrivateEventJobData["data"]["eventDetails"],
    creatorId: string,
    sharedWithIds: string[],
    userCoordinates?: { lat: number; lng: number },
  ): Promise<string> {
    const jobId = crypto.randomUUID();

    // Create the job data
    const jobData: PrivateEventJobData = {
      type: "process_private_event",
      data: {
        eventDetails,
        creatorId,
        sharedWithIds,
        userCoordinates,
      },
    };

    // Store the job data
    await this.redisService.set(`job:${jobId}`, jobData);

    // Add to pending jobs queue
    await this.redisService.getClient().lpush("jobs:pending", jobId);

    // Initialize job status
    await this.updateJobStatus(jobId, {
      status: "pending",
      progress: 0,
    });

    return jobId;
  }

  /**
   * Get the Redis client instance
   * Note: This should be used sparingly and only when absolutely necessary
   */
  getRedisClient(): Redis {
    return this.redisService.getClient();
  }
}
