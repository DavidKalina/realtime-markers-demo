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
  message?: string;
  completed?: string;
  eventId?: string;
  progressStep?: string;
  progressDetails?: {
    currentStep: string;
    totalSteps: number;
    stepProgress: number;
    stepDescription: string;
    estimatedTimeRemaining?: number;
  };
  result?: {
    message?: string;
    confidence?: number;
    threshold?: number;
    daysFromNow?: number;
    date?: string;
    deletedCount?: number;
    hasMore?: boolean;
    eventId?: string;
    title?: string;
    emoji?: string;
    coordinates?: [number, number];
    [key: string]: unknown;
  };
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
   * Static utility method to sort jobs chronologically (newest first)
   *
   * Sorting priority:
   * 1. Most recent activity (updated timestamp, fallback to created)
   * 2. Creation date (newest first)
   * 3. Job ID (for consistency when timestamps are identical)
   */
  static sortJobsChronologically(jobs: JobData[]): JobData[] {
    // Remove duplicates first
    const uniqueJobs = jobs.filter(
      (job, index, self) => index === self.findIndex((j) => j.id === job.id),
    );

    // Log if duplicates were found
    if (uniqueJobs.length !== jobs.length) {
      console.warn(
        `[JobQueue] Found ${jobs.length - uniqueJobs.length} duplicate jobs in sortJobsChronologically, removing them`,
      );
    }

    const sortedJobs = uniqueJobs.sort((a, b) => {
      // Get the most recent timestamp for each job
      const aTimestamp = a.updated || a.created;
      const bTimestamp = b.updated || b.created;

      // Compare timestamps (newest first)
      const timeComparison =
        new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime();

      if (timeComparison !== 0) {
        return timeComparison;
      }

      // If timestamps are equal, sort by created date
      const createdComparison =
        new Date(b.created).getTime() - new Date(a.created).getTime();

      if (createdComparison !== 0) {
        return createdComparison;
      }

      // If created dates are equal, sort by job ID for consistency
      return b.id.localeCompare(a.id);
    });

    console.log(`[JobQueue] Sorted ${uniqueJobs.length} jobs chronologically`);
    return sortedJobs;
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
      progress: 0,
      progressStep: "Job queued",
      data: { ...data, hasBuffer: !!options.bufferData },
    };

    // Store job metadata in Redis
    await this.redisService.set(`job:${jobId}`, jobData);

    // If buffer data is provided, store separately
    if (options.bufferData) {
      // Convert Buffer to array of numbers for storage
      const bufferArray = Array.from(options.bufferData);
      await this.redisService.set(`job:${jobId}:buffer`, { data: bufferArray });
    }

    // Add to processing queue
    await this.redisService.getClient().rpush("jobs:pending", jobId);

    // Publish notification
    await this.redisService.publish("job_created", {
      type: "JOB_CREATED",
      data: { jobId, jobType, timestamp: new Date().toISOString() },
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
   * Update job status with detailed progress information
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
      progressStep: updates.progressStep,
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

    // Publish to job-specific channel
    await this.redisService.publish(`job:${jobId}:updates`, {
      type: "JOB_UPDATE",
      data: updateMessage,
    });

    // Also publish to general job updates channel for WebSocket
    await this.redisService.publish("job_updates", {
      type: "JOB_UPDATE",
      data: updateMessage,
    });

    await this.publishToWebSocket(updates);
  }

  /**
   * Update job progress with step-by-step details
   */
  async updateJobProgress(
    jobId: string,
    progress: number,
    step: string,
    details?: {
      currentStep: string;
      totalSteps: number;
      stepProgress: number;
      stepDescription: string;
      estimatedTimeRemaining?: number;
    },
  ): Promise<void> {
    await this.updateJobStatus(jobId, {
      progress,
      progressStep: step,
      progressDetails: details,
    });
  }

  /**
   * Mark job as completed with result
   */
  async completeJob(jobId: string, result: JobData["result"]): Promise<void> {
    await this.updateJobStatus(jobId, {
      status: "completed",
      progress: 100,
      progressStep: "Job completed",
      completed: new Date().toISOString(),
      result,
    });
  }

  /**
   * Mark job as failed with error
   */
  async failJob(jobId: string, error: string, message?: string): Promise<void> {
    await this.updateJobStatus(jobId, {
      status: "failed",
      progress: 100,
      progressStep: "Job failed",
      completed: new Date().toISOString(),
      error,
      message: message || "An error occurred while processing the job",
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

    // Create the job data in the correct JobData format
    const jobData: JobData = {
      id: jobId,
      type: "process_private_event",
      status: "pending",
      created: new Date().toISOString(),
      progress: 0,
      progressStep: "Private event job queued",
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

    // Publish notification
    await this.redisService.publish("job_created", {
      type: "JOB_CREATED",
      data: {
        jobId,
        jobType: "process_private_event",
        timestamp: new Date().toISOString(),
      },
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

  /**
   * Get all active jobs for a user
   */
  async getUserJobs(userId: string, limit?: number): Promise<JobData[]> {
    const pattern = "job:*";
    const keys = await this.redisService.getClient().keys(pattern);
    const jobs: JobData[] = [];

    console.log(
      `[JobQueue] Found ${keys.length} total job keys for pattern ${pattern}`,
    );

    for (const key of keys) {
      const jobData = await this.redisService.get<JobData>(key);
      if (jobData && jobData.data.creatorId === userId) {
        // Extract job ID from Redis key (format: "job:jobId")
        const jobId = key.replace("job:", "");
        jobs.push({
          ...jobData,
          id: jobId,
        });
      }
    }

    console.log(`[JobQueue] Found ${jobs.length} jobs for user ${userId}`);

    // Check for duplicates before sorting
    const jobIds = jobs.map((job) => job.id);
    const uniqueJobIds = [...new Set(jobIds)];
    if (jobIds.length !== uniqueJobIds.length) {
      console.warn(
        `[JobQueue] Found ${jobIds.length - uniqueJobIds.length} duplicate job IDs for user ${userId}`,
      );
    }

    // Sort jobs in chronological order (newest first)
    const sortedJobs = JobQueue.sortJobsChronologically(jobs);

    // Apply limit if specified
    const limitedJobs = limit ? sortedJobs.slice(0, limit) : sortedJobs;

    console.log(
      `[JobQueue] Returning ${limitedJobs.length} sorted jobs for user ${userId}${limit ? ` (limited to ${limit})` : ""}`,
    );

    return limitedJobs;
  }

  /**
   * Clean up completed/failed jobs older than specified days
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const pattern = "job:*";
    const keys = await this.redisService.getClient().keys(pattern);
    let deletedCount = 0;

    for (const key of keys) {
      const jobData = await this.redisService.get<JobData>(key);
      if (
        jobData &&
        (jobData.status === "completed" || jobData.status === "failed") &&
        new Date(jobData.created) < cutoffDate
      ) {
        // Delete job data and buffer
        await Promise.all([
          this.redisService.getClient().del(key),
          this.redisService.getClient().del(`${key}:buffer`),
        ]);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  private async publishToWebSocket(jobUpdate: Partial<JobData>): Promise<void> {
    // Publish to job-specific WebSocket channel
    await this.redisService.publish("websocket:job_updates", {
      type: "JOB_PROGRESS_UPDATE",
      data: {
        jobId: jobUpdate.id,
        status: jobUpdate.status,
        progress: jobUpdate.progress,
        progressStep: jobUpdate.progressStep,
        progressDetails: jobUpdate.progressDetails,
        error: jobUpdate.error,
        result: jobUpdate.result,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
