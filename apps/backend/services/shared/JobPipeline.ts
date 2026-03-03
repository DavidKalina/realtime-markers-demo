import type { JobQueue, JobData } from "../JobQueue";
import type { RedisService } from "./RedisService";
import type { JobNotificationService } from "../JobNotificationService";

// --- Types ---

export type JobType =
  | "process_flyer"
  | "cleanup_outdated_events"
  | "import_external_events";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface PipelineStep<TStepId extends string> {
  id: TStepId;
  label: string;
  weight: number;
}

export interface Pipeline<TStepId extends string> {
  jobType: JobType;
  steps: readonly PipelineStep<TStepId>[];
  totalWeight: number;
}

export interface JobExtractions {
  title?: string;
  emoji?: string;
  emojiDescription?: string;
  date?: string;
  address?: string;
  categories?: string[];
  confidence?: number;
}

export interface JobProgressMessage {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  stepId: string | null;
  stepLabel: string;
  stepIndex: number;
  totalSteps: number;
  stepProgress: number;
  extractions?: JobExtractions;
  error?: string;
  message?: string;
  result?: JobData["result"];
}

export interface JobTrackerDeps {
  jobQueue: JobQueue;
  redisService: RedisService;
  notificationService: JobNotificationService;
}

// --- Pipeline definition ---

export function definePipeline<TStepId extends string>(
  jobType: JobType,
  steps: readonly PipelineStep<TStepId>[],
): Pipeline<TStepId> {
  const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0);
  return { jobType, steps, totalWeight };
}

// --- Pipeline definitions ---

export type FlyerStepId =
  | "validate"
  | "fetch_image"
  | "upload"
  | "analyze"
  | "process"
  | "save";

export const FLYER_PIPELINE = definePipeline<FlyerStepId>("process_flyer", [
  { id: "validate", label: "Validating request", weight: 1 },
  { id: "fetch_image", label: "Retrieving image", weight: 1 },
  { id: "upload", label: "Uploading to storage", weight: 2 },
  { id: "analyze", label: "Analyzing image", weight: 4 },
  { id: "process", label: "Processing details", weight: 2 },
  { id: "save", label: "Creating event", weight: 1 },
]);

export type CleanupStepId = "query" | "delete" | "notify";

export const CLEANUP_PIPELINE = definePipeline<CleanupStepId>(
  "cleanup_outdated_events",
  [
    { id: "query", label: "Finding outdated events", weight: 1 },
    { id: "delete", label: "Removing events", weight: 1 },
    { id: "notify", label: "Sending notifications", weight: 1 },
  ],
);

export type ImportStepId = "fetch" | "deduplicate" | "create" | "notify";

export const IMPORT_PIPELINE = definePipeline<ImportStepId>(
  "import_external_events",
  [
    { id: "fetch", label: "Fetching external events", weight: 2 },
    { id: "deduplicate", label: "Checking for duplicates", weight: 1 },
    { id: "create", label: "Importing events", weight: 4 },
    { id: "notify", label: "Completing import", weight: 1 },
  ],
);

// --- JobTracker ---

export interface JobTracker<TStepId extends string> {
  step(stepId: TStepId): Promise<void>;
  stepProgress(
    progress: number,
    label?: string,
    extractions?: JobExtractions,
  ): Promise<void>;
  complete(result: JobData["result"], eventId?: string): Promise<void>;
  fail(error: string, message?: string): Promise<void>;
}

export function createJobTracker<TStepId extends string>(
  jobId: string,
  pipeline: Pipeline<TStepId>,
  deps: JobTrackerDeps,
): JobTracker<TStepId> {
  let currentStepIndex = -1;
  let currentStepProgress = 0;
  let completedWeight = 0;

  function calcOverallProgress(): number {
    if (currentStepIndex < 0) return 0;
    const currentStep = pipeline.steps[currentStepIndex];
    const progress =
      ((completedWeight + currentStep.weight * (currentStepProgress / 100)) /
        pipeline.totalWeight) *
      100;
    return Math.round(Math.min(progress, 99));
  }

  function buildMessage(
    overrides: Partial<JobProgressMessage>,
  ): JobProgressMessage {
    const currentStep =
      currentStepIndex >= 0 ? pipeline.steps[currentStepIndex] : null;
    return {
      jobId,
      jobType: pipeline.jobType,
      status: "processing",
      progress: calcOverallProgress(),
      stepId: currentStep?.id ?? null,
      stepLabel: currentStep?.label ?? "Starting",
      stepIndex: currentStepIndex,
      totalSteps: pipeline.steps.length,
      stepProgress: currentStepProgress,
      ...overrides,
    };
  }

  async function publish(msg: JobProgressMessage): Promise<void> {
    // Save job state to Redis
    await deps.jobQueue.updateJobStatus(jobId, {
      status: msg.status,
      progress: msg.progress,
      progressStep: msg.stepLabel,
      progressDetails: {
        currentStep: String(msg.stepIndex + 1),
        totalSteps: msg.totalSteps,
        stepProgress: msg.stepProgress,
        stepDescription: msg.stepLabel,
        ...(msg.extractions ? { extractions: msg.extractions } : {}),
      },
      ...(msg.result ? { result: msg.result } : {}),
      ...(msg.error ? { error: msg.error } : {}),
      ...(msg.message ? { message: msg.message } : {}),
      ...(msg.status === "completed" || msg.status === "failed"
        ? { completed: new Date().toISOString() }
        : {}),
    });
  }

  async function publishTerminal(msg: JobProgressMessage): Promise<void> {
    // For complete/fail, also publish to general job_updates channel
    // (updateJobStatus already publishes to job:{id}:updates)
    await publish(msg);
    await deps.redisService.publish("job_updates", {
      type: "JOB_UPDATE",
      data: {
        id: jobId,
        status: msg.status,
        progress: msg.progress,
        progressStep: msg.stepLabel,
        result: msg.result,
        error: msg.error,
        message: msg.message,
      },
    });
  }

  return {
    async step(stepId: TStepId): Promise<void> {
      const idx = pipeline.steps.findIndex((s) => s.id === stepId);
      if (idx === -1) {
        throw new Error(
          `Unknown step "${stepId}" in pipeline "${pipeline.jobType}"`,
        );
      }

      // Sum weights of all steps before this one
      completedWeight = 0;
      for (let i = 0; i < idx; i++) {
        completedWeight += pipeline.steps[i].weight;
      }
      currentStepIndex = idx;
      currentStepProgress = 0;

      await publish(buildMessage({}));
    },

    async stepProgress(
      progress: number,
      label?: string,
      extractions?: JobExtractions,
    ): Promise<void> {
      currentStepProgress = Math.min(100, Math.max(0, progress));
      const overrides: Partial<JobProgressMessage> = {};
      if (label) {
        overrides.stepLabel = label;
      }
      if (extractions) {
        overrides.extractions = extractions;
      }
      await publish(buildMessage(overrides));
    },

    async complete(result: JobData["result"], eventId?: string): Promise<void> {
      const msg = buildMessage({
        status: "completed",
        progress: 100,
        stepProgress: 100,
        result,
      });
      // Include eventId in the update
      await deps.jobQueue.updateJobStatus(jobId, {
        status: "completed",
        progress: 100,
        progressStep: msg.stepLabel,
        result,
        eventId,
        completed: new Date().toISOString(),
      });
      // Publish to general channel for filter-processor
      await deps.redisService.publish("job_updates", {
        type: "JOB_UPDATE",
        data: {
          id: jobId,
          status: "completed",
          progress: 100,
          result,
          eventId,
        },
      });
      // Send push notification
      try {
        const jobData = await deps.jobQueue.getJobStatus(jobId);
        if (jobData && result) {
          await deps.notificationService.notifyJobCompletion(jobData, result);
        }
      } catch (err) {
        console.error("Error sending job completion notification:", err);
      }
    },

    async fail(error: string, message?: string): Promise<void> {
      const msg = buildMessage({
        status: "failed",
        progress: 100,
        error,
        message,
      });
      await publishTerminal(msg);
      // Send push notification
      try {
        const jobData = await deps.jobQueue.getJobStatus(jobId);
        if (jobData) {
          await deps.notificationService.notifyJobFailure(
            jobData,
            error,
            message,
          );
        }
      } catch (err) {
        console.error("Error sending job failure notification:", err);
      }
    },
  };
}
