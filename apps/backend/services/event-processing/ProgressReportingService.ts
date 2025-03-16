// services/event-processing/ProgressReportingService.ts

import type {
  IProgressReportingService,
  ProgressCallback,
} from "./interfaces/IProgressReportingService";
import type { JobQueue } from "../JobQueue";
import type { ConfigService } from "../shared/ConfigService";
import { type RichUIMetadata, richUITemplates } from "./types/RichMetadata";

/**
 * Progress update with metadata
 */
interface ProgressUpdate {
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
  richUI?: RichUIMetadata;
  step?: number;
  totalSteps?: number;
  sessionName?: string;
  percentComplete?: number;
}

/**
 * Job status update options with typed status
 */
export interface JobStatusUpdate {
  status?: "pending" | "processing" | "completed" | "failed";
  progress?: number | string; // Can be a number (0-1) or a message
  progressMessage?: string;
  progressPercentage?: number; // Normalized 0-100 percentage
  richUI?: RichUIMetadata; // Rich UI metadata
  result?: Record<string, any>;
  eventId?: string;
  error?: string;
  started?: string;
  completed?: string;
  [key: string]: any; // Allow additional custom fields
}

/**
 * Service for standardized progress reporting across the application
 * Provides throttling, job queue integration, progress tracking, and rich UI metadata
 */
export class ProgressReportingService implements IProgressReportingService {
  private jobId?: string;
  private throttleTime: number;
  private lastUpdateTime: number = 0;
  private pendingUpdate: ProgressUpdate | null = null;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionActive: boolean = false;
  private currentStep: number = 0;
  private totalSteps: number = 0;
  private currentSessionName?: string;

  // Access to rich UI templates
  public templates = richUITemplates;

  // Progress mapping for common steps to percentages (0-100)
  private progressStepMap: Record<string, number> = {
    "Initializing job...": 0,
    "Analyzing image...": 15,
    "Analyzing image with Vision API...": 30,
    "QR code detected in image": 40,
    "Image analyzed successfully": 45,
    "Event details extracted": 60,
    "Generating text embeddings...": 70,
    "Duplicate event detected!": 85,
    "Processing complete!": 90,
    "Creating event...": 95,
    "Event created successfully": 100,
    "Storing detected QR code...": 98,
    "Generating QR code...": 98,
    "Confidence too low to create event": 100,
    "Invalid event date": 100,
    "Duplicate event detected": 100,
    "Cleanup completed": 100,
  };

  /**
   * Create a new ProgressReportingService
   * @param callback Optional callback for progress updates
   * @param jobQueue Optional JobQueue for job status updates
   * @param configService Optional ConfigService for configuration
   */
  constructor(
    private callback?: ProgressCallback,
    private jobQueue?: JobQueue,
    private configService?: ConfigService
  ) {
    // Get throttle time from config or use default (300ms)
    this.throttleTime = configService?.get("progressReporting.throttleTime") || 300;
  }

  /**
   * Configure progress throttling to avoid too frequent updates
   * @param intervalMs Minimum interval between progress updates in milliseconds
   */
  public throttleUpdates(intervalMs: number): void {
    this.throttleTime = intervalMs;
  }

  /**
   * Add or update entries in the progress step mapping
   * @param mappings Object with message to percentage mappings
   */
  public updateProgressMappings(mappings: Record<string, number>): void {
    this.progressStepMap = {
      ...this.progressStepMap,
      ...mappings,
    };
  }

  /**
   * Calculate normalized progress percentage (0-100) based on progress message or step
   * @param message Progress message
   * @param step Current step (optional)
   * @param totalSteps Total steps (optional)
   * @returns Normalized progress percentage (0-100)
   */
  public calculateProgressPercentage(message: string, step?: number, totalSteps?: number): number {
    // If we have a direct mapping for this message, use it
    if (this.progressStepMap[message] !== undefined) {
      return this.progressStepMap[message];
    }

    // If we have step/totalSteps, use that to calculate percentage
    if (step !== undefined && totalSteps && totalSteps > 0) {
      return Math.min(99, Math.round((step / totalSteps) * 100));
    }

    // Default fallback - estimate based on message keywords
    if (message.includes("initializing") || message.includes("starting")) {
      return 5;
    } else if (
      message.includes("complete") ||
      message.includes("finished") ||
      message.includes("done")
    ) {
      return 100;
    } else if (message.includes("error") || message.includes("failed")) {
      return 100;
    }

    // When we can't determine progress, use a middle value
    return 50;
  }

  /**
   * Connect the progress reporter to a specific job for tracking
   * @param jobId ID of the job to associate progress with
   */
  public connectToJobQueue(jobId: string): void {
    this.jobId = jobId;
    console.log(`Progress reporting connected to job ${jobId}`);
  }

  /**
   * Update job status directly with custom fields
   * Single entry point for all job status updates
   * @param update Status update with fields to update
   */
  public async updateJobStatus(update: JobStatusUpdate): Promise<void> {
    if (!this.jobQueue || !this.jobId) {
      console.warn("Cannot update job status: no job queue or job ID configured");
      return;
    }

    // Calculate progress percentage if not provided but we have a progress message
    if (update.progressMessage && update.progressPercentage === undefined) {
      update.progressPercentage = this.calculateProgressPercentage(
        update.progressMessage,
        update.step as number,
        update.totalSteps as number
      );
    } else if (
      update.progress &&
      typeof update.progress === "string" &&
      update.progressPercentage === undefined
    ) {
      update.progressPercentage = this.calculateProgressPercentage(
        update.progress,
        update.step as number,
        update.totalSteps as number
      );
    }

    // Special status-based overrides
    if (update.status === "completed") {
      update.progressPercentage = 100;
    } else if (update.status === "failed") {
      update.progressPercentage = 100;
    }

    // Update the job status through the job queue
    await this.jobQueue.updateJobStatus(this.jobId, {
      ...update,
      updated: update.updated || new Date().toISOString(),
    });

    // Log the job status update for debugging
    console.log(
      `[Job ${this.jobId}] Status update: ${update.status || "progress update"} - ${
        update.progressPercentage || 0
      }%`
    );
  }

  /**
   * Report progress with a message and optional metadata
   * @param message Human-readable progress message
   * @param metadata Optional metadata about the progress
   * @param richUI Optional rich UI metadata
   * @returns Promise that resolves when progress is reported
   */
  public async reportProgress(
    message: string,
    metadata?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void> {
    const update: ProgressUpdate = {
      message,
      timestamp: new Date().toISOString(),
      metadata,
      richUI,
    };

    return this.sendProgressUpdate(update);
  }

  /**
   * Mark job as started with initial progress
   * @param message Initial progress message
   * @param metadata Optional metadata
   * @param richUI Optional rich UI metadata
   */
  public async markJobStarted(
    message: string,
    metadata?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void> {
    const progressPercentage = this.calculateProgressPercentage(message);

    return this.updateJobStatus({
      status: "processing",
      started: new Date().toISOString(),
      progress: message,
      progressPercentage,
      richUI,
      ...metadata,
    });
  }

  /**
   * Mark job as completed with results
   * @param message Completion message
   * @param result Result data
   * @param eventId Optional event ID if created
   * @param richUI Optional rich UI metadata
   */
  public async markJobCompleted(
    message: string,
    result?: Record<string, any>,
    eventId?: string,
    richUI?: RichUIMetadata
  ): Promise<void> {
    return this.updateJobStatus({
      status: "completed",
      progress: message,
      progressPercentage: 100, // Completed jobs are always at 100%
      result,
      eventId,
      richUI,
      completed: new Date().toISOString(),
    });
  }

  /**
   * Mark job as failed with error information
   * @param errorMessage Error message
   * @param details Additional error details
   * @param richUI Optional rich UI metadata
   */
  public async markJobFailed(
    errorMessage: string,
    details?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void> {
    // Default to error template if not provided
    const uiMetadata = richUI || this.templates.errorOccurred(errorMessage);

    return this.updateJobStatus({
      status: "failed",
      error: errorMessage,
      progressPercentage: 100, // Failed jobs are also at 100% (process is complete)
      richUI: uiMetadata,
      ...details,
      completed: new Date().toISOString(),
    });
  }

  /**
   * Start a new progress reporting session with a total number of steps
   * @param totalSteps Total number of steps in the operation
   * @param sessionName Optional session name for reporting context
   * @param richUI Optional rich UI metadata
   */
  public startSession(totalSteps: number, sessionName?: string, richUI?: RichUIMetadata): void {
    this.sessionActive = true;
    this.currentStep = 0;
    this.totalSteps = totalSteps;
    this.currentSessionName = sessionName;

    const message = sessionName ? `Starting ${sessionName}...` : "Starting operation...";

    // Report session started
    this.sendProgressUpdate({
      message,
      timestamp: new Date().toISOString(),
      step: 0,
      totalSteps,
      sessionName,
      percentComplete: 0,
      richUI,
      metadata: {
        sessionStarted: true,
        totalSteps,
        sessionName,
      },
    });
  }

  /**
   * Update progress to a specific step
   * @param step Current step number
   * @param message Human-readable progress message for this step
   * @param metadata Optional metadata about the progress
   * @param richUI Optional rich UI metadata
   */
  public async updateProgress(
    step: number,
    message: string,
    metadata?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void> {
    if (!this.sessionActive) {
      console.warn("Trying to update progress but no session is active. Call startSession first.");
      return this.reportProgress(message, metadata, richUI);
    }

    this.currentStep = Math.min(step, this.totalSteps);
    const percentComplete =
      this.totalSteps > 0
        ? (this.currentStep / this.totalSteps) * 100
        : this.calculateProgressPercentage(message);

    const update: ProgressUpdate = {
      message,
      timestamp: new Date().toISOString(),
      metadata,
      richUI,
      step: this.currentStep,
      totalSteps: this.totalSteps,
      sessionName: this.currentSessionName,
      percentComplete: Math.min(99, Math.round(percentComplete)), // Cap at 99% until complete
    };

    return this.sendProgressUpdate(update);
  }

  /**
   * Complete the current progress reporting session
   * @param message Final message for the completed operation
   * @param metadata Optional metadata about the completed operation
   * @param richUI Optional rich UI metadata
   */
  public async completeSession(
    message: string,
    metadata?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void> {
    if (!this.sessionActive) {
      console.warn("No active session to complete. Reporting final progress anyway.");
      return this.reportProgress(message, metadata, richUI);
    }

    this.currentStep = this.totalSteps;
    const update: ProgressUpdate = {
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        sessionCompleted: true,
      },
      richUI,
      step: this.totalSteps,
      totalSteps: this.totalSteps,
      sessionName: this.currentSessionName,
      percentComplete: 100, // Session complete means 100%
    };

    // Clear any session data
    this.sessionActive = false;
    this.currentSessionName = undefined;

    return this.sendProgressUpdate(update);
  }

  /**
   * Send a progress update, respecting throttling settings
   * @param update Progress update to send
   * @returns Promise that resolves when update is processed
   */
  private async sendProgressUpdate(update: ProgressUpdate): Promise<void> {
    const now = Date.now();
    this.pendingUpdate = update;

    // If throttling is active and an update was sent recently, schedule update
    if (this.throttleTime > 0 && now - this.lastUpdateTime < this.throttleTime) {
      if (this.updateTimer === null) {
        // Schedule an update for later
        this.updateTimer = setTimeout(() => {
          this.processPendingUpdate();
        }, this.throttleTime - (now - this.lastUpdateTime));
      }
      return;
    }

    // Otherwise process immediately
    return this.processPendingUpdate();
  }

  /**
   * Process the pending update
   */
  private async processPendingUpdate(): Promise<void> {
    if (!this.pendingUpdate) return;

    const update = this.pendingUpdate;
    this.pendingUpdate = null;
    this.updateTimer = null;
    this.lastUpdateTime = Date.now();

    try {
      // Send to callback if provided
      if (this.callback) {
        await this.callback(update.message, {
          ...update.metadata,
          timestamp: update.timestamp,
          step: update.step,
          totalSteps: update.totalSteps,
          percentComplete: update.percentComplete,
          sessionName: update.sessionName,
          richUI: update.richUI,
        });
      }

      // Update job queue if connected
      if (this.jobQueue && this.jobId) {
        await this.updateJobStatus({
          status: update.metadata?.sessionCompleted ? "completed" : "processing",
          progress: update.message,
          progressPercentage: update.percentComplete,
          progressMessage: update.message,
          richUI: update.richUI,
          step: update.step,
          totalSteps: update.totalSteps,
          updated: update.timestamp,
          ...update.metadata,
        });
      }

      // Log the update
      const logPrefix = update.sessionName ? `[${update.sessionName}]` : "";
      const progressIndicator =
        update.percentComplete !== undefined ? `(${Math.round(update.percentComplete)}%)` : "";
      console.log(`${logPrefix} Progress ${progressIndicator}: ${update.message}`);
    } catch (error) {
      console.error("Error reporting progress:", error);
    }
  }
}
