import { Redis } from "ioredis";
import { JobQueue, type JobData } from "./JobQueue";
import { RedisService } from "./shared/RedisService";

export interface JobProgressStep {
  id: string;
  name: string;
  description: string;
  progress: number;
  estimatedDuration?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface JobProgressContext {
  jobId: string;
  jobType: string;
  totalSteps: number;
  currentStep: number;
  overallProgress: number;
  steps: JobProgressStep[];
  startedAt: string;
  estimatedCompletion?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  result?: JobData["result"];
}

export class JobProgressStreamingService {
  private static instance: JobProgressStreamingService;
  private redisService: RedisService;
  private jobQueue: JobQueue;
  private redisSubscriber: Redis;

  private constructor(redis: Redis, jobQueue: JobQueue) {
    this.redisService = RedisService.getInstance(redis);
    this.jobQueue = jobQueue;

    // Create a dedicated Redis subscriber for job updates
    this.redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || "redis",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    });

    this.setupSubscriptions();
  }

  public static getInstance(
    redis: Redis,
    jobQueue: JobQueue,
  ): JobProgressStreamingService {
    if (!JobProgressStreamingService.instance) {
      JobProgressStreamingService.instance = new JobProgressStreamingService(
        redis,
        jobQueue,
      );
    }
    return JobProgressStreamingService.instance;
  }

  private setupSubscriptions(): void {
    // Subscribe to all job update channels
    this.redisSubscriber.psubscribe("job:*:updates", (err) => {
      if (err) {
        console.error(
          "[JobProgressStreamingService] Error subscribing to job updates:",
          err,
        );
      } else {
        console.log(
          "[JobProgressStreamingService] Subscribed to job:*:updates",
        );
      }
    });

    // Subscribe to general job updates channel
    this.redisSubscriber.subscribe("job_updates", (err) => {
      if (err) {
        console.error(
          "[JobProgressStreamingService] Error subscribing to job_updates:",
          err,
        );
      } else {
        console.log("[JobProgressStreamingService] Subscribed to job_updates");
      }
    });

    // Handle incoming messages
    this.redisSubscriber.on("pmessage", (pattern, channel, message) => {
      this.handleJobUpdate(channel, message).catch((err) => {
        console.error(
          "[JobProgressStreamingService] Error handling job update:",
          err,
        );
      });
    });

    this.redisSubscriber.on("message", (channel, message) => {
      this.handleJobUpdate(channel, message).catch((err) => {
        console.error(
          "[JobProgressStreamingService] Error handling job update:",
          err,
        );
      });
    });
  }

  private async handleJobUpdate(
    channel: string,
    message: string,
  ): Promise<void> {
    try {
      const parsedMessage = JSON.parse(message);
      const jobUpdate =
        parsedMessage.type === "JOB_UPDATE"
          ? parsedMessage.data
          : parsedMessage;

      if (!jobUpdate.id) {
        console.warn(
          "[JobProgressStreamingService] Job update missing ID:",
          jobUpdate,
        );
        return;
      }

      // Update the job progress context
      await this.updateJobProgressContext(jobUpdate.id, jobUpdate);

      // Publish to WebSocket channels for real-time updates
      await this.publishToWebSocket(jobUpdate);
    } catch (error) {
      console.error(
        "[JobProgressStreamingService] Error parsing job update:",
        error,
      );
    }
  }

  private async updateJobProgressContext(
    jobId: string,
    update: Partial<JobData>,
  ): Promise<void> {
    const contextKey = `job:${jobId}:progress`;
    const existingContext =
      await this.redisService.get<JobProgressContext>(contextKey);

    if (!existingContext) {
      // Create new context if it doesn't exist
      const jobData = await this.jobQueue.getJobStatus(jobId);
      if (!jobData) return;

      const newContext: JobProgressContext = {
        jobId,
        jobType: jobData.type,
        totalSteps: this.getTotalStepsForJobType(jobData.type),
        currentStep: 1,
        overallProgress: update.progress || 0,
        steps: this.getDefaultStepsForJobType(jobData.type),
        startedAt: jobData.created,
        status: update.status || jobData.status,
        error: update.error,
        result: update.result,
      };

      await this.redisService.set(contextKey, newContext);
    } else {
      // Update existing context
      const updatedContext: JobProgressContext = {
        ...existingContext,
        overallProgress: update.progress ?? existingContext.overallProgress,
        status: update.status ?? existingContext.status,
        error: update.error ?? existingContext.error,
        result: update.result ?? existingContext.result,
      };

      // Update current step based on progress
      if (update.progress !== undefined) {
        updatedContext.currentStep = Math.ceil(
          (update.progress / 100) * updatedContext.totalSteps,
        );
      }

      // Update step details if provided
      if (update.progressDetails) {
        const currentStepIndex = updatedContext.currentStep - 1;
        if (updatedContext.steps[currentStepIndex]) {
          updatedContext.steps[currentStepIndex] = {
            ...updatedContext.steps[currentStepIndex],
            progress: update.progressDetails.stepProgress,
            description: update.progressDetails.stepDescription,
          };
        }
      }

      await this.redisService.set(contextKey, updatedContext);
    }
  }

  private async publishToWebSocket(jobUpdate: Partial<JobData>): Promise<void> {
    // Ensure we have a job ID
    if (!jobUpdate.id) {
      console.warn(
        "[JobProgressStreamingService] Cannot publish to WebSocket without job ID:",
        jobUpdate,
      );
      return;
    }

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

  private getTotalStepsForJobType(jobType: string): number {
    const stepCounts: Record<string, number> = {
      process_flyer: 6,
      process_private_event: 4,
      process_multi_event_flyer: 8,
      cleanup_outdated_events: 3,
    };

    return stepCounts[jobType] || 5;
  }

  private getDefaultStepsForJobType(jobType: string): JobProgressStep[] {
    const defaultSteps: Record<string, JobProgressStep[]> = {
      process_flyer: [
        {
          id: "1",
          name: "Image Processing",
          description: "Analyzing image content",
          progress: 0,
        },
        {
          id: "2",
          name: "Text Extraction",
          description: "Extracting text from image",
          progress: 0,
        },
        {
          id: "3",
          name: "Event Extraction",
          description: "Extracting event details",
          progress: 0,
        },
        {
          id: "4",
          name: "Location Resolution",
          description: "Resolving event location",
          progress: 0,
        },
        {
          id: "5",
          name: "Duplicate Check",
          description: "Checking for duplicate events",
          progress: 0,
        },
        {
          id: "6",
          name: "Event Creation",
          description: "Creating event in database",
          progress: 0,
        },
      ],
      process_private_event: [
        {
          id: "1",
          name: "Validation",
          description: "Validating event details",
          progress: 0,
        },
        {
          id: "2",
          name: "Category Processing",
          description: "Processing event categories",
          progress: 0,
        },
        {
          id: "3",
          name: "Duplicate Check",
          description: "Checking for duplicate events",
          progress: 0,
        },
        {
          id: "4",
          name: "Event Creation",
          description: "Creating private event",
          progress: 0,
        },
      ],
      process_multi_event_flyer: [
        {
          id: "1",
          name: "Image Processing",
          description: "Analyzing multi-event image",
          progress: 0,
        },
        {
          id: "2",
          name: "Event Detection",
          description: "Detecting multiple events",
          progress: 0,
        },
        {
          id: "3",
          name: "Text Extraction",
          description: "Extracting text for each event",
          progress: 0,
        },
        {
          id: "4",
          name: "Event Extraction",
          description: "Extracting details for each event",
          progress: 0,
        },
        {
          id: "5",
          name: "Location Resolution",
          description: "Resolving locations",
          progress: 0,
        },
        {
          id: "6",
          name: "Duplicate Check",
          description: "Checking for duplicates",
          progress: 0,
        },
        {
          id: "7",
          name: "Event Creation",
          description: "Creating events in database",
          progress: 0,
        },
        {
          id: "8",
          name: "Finalization",
          description: "Finalizing multi-event processing",
          progress: 0,
        },
      ],
    };

    return (
      defaultSteps[jobType] || [
        {
          id: "1",
          name: "Processing",
          description: "Processing job",
          progress: 0,
        },
        {
          id: "2",
          name: "Validation",
          description: "Validating results",
          progress: 0,
        },
        {
          id: "3",
          name: "Completion",
          description: "Completing job",
          progress: 0,
        },
      ]
    );
  }

  /**
   * Get detailed progress context for a job
   */
  async getJobProgressContext(
    jobId: string,
  ): Promise<JobProgressContext | null> {
    const contextKey = `job:${jobId}:progress`;
    return await this.redisService.get<JobProgressContext>(contextKey);
  }

  /**
   * Get all active jobs for a user with progress context
   */
  async getUserJobsWithProgress(
    userId: string,
    limit?: number,
  ): Promise<(JobData & { progressContext?: JobProgressContext })[]> {
    const jobs = await this.jobQueue.getUserJobs(userId, limit);
    const jobsWithProgress = await Promise.all(
      jobs.map(async (job) => {
        const progressContext = await this.getJobProgressContext(job.id);
        return {
          ...job,
          progressContext: progressContext || undefined,
        };
      }),
    );

    // The jobs are already sorted by the JobQueue service, but we ensure consistency
    // by applying the same sorting logic here as well
    return JobQueue.sortJobsChronologically(jobsWithProgress);
  }

  /**
   * Clean up progress contexts for completed jobs
   */
  async cleanupProgressContexts(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const pattern = "job:*:progress";
    const keys = await this.redisService.getClient().keys(pattern);
    let deletedCount = 0;

    for (const key of keys) {
      const context = await this.redisService.get<JobProgressContext>(key);
      if (context && new Date(context.startedAt) < cutoffDate) {
        await this.redisService.getClient().del(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Close the service and clean up resources
   */
  async close(): Promise<void> {
    await this.redisSubscriber.quit();
  }
}
