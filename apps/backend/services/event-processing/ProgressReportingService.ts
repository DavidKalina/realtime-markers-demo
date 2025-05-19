// services/event-processing/ProgressReportingService.ts

import type {
  IProgressReportingService,
  ProgressCallback,
} from "./interfaces/IProgressReportingService";
import type { JobQueue } from "../JobQueue";
import type { ConfigService } from "../shared/ConfigService";

/**
 * Progress update with metadata
 */
interface ProgressUpdate {
  message: string;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  step?: number;
  totalSteps?: number;
  sessionName?: string;
  percentComplete?: number;
}

/**
 * Service for standardized progress reporting across the application
 * Provides throttling, job queue integration, and progress tracking
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

  /**
   * Create a new ProgressReportingService
   * @param callback Optional callback for progress updates
   * @param jobQueue Optional JobQueue for job status updates
   * @param configService Optional ConfigService for configuration
   */
  constructor(
    private callback?: ProgressCallback,
    private jobQueue?: JobQueue,
    private configService?: ConfigService,
  ) {
    // Get throttle time from config or use default (300ms)
    this.throttleTime =
      configService?.get("progressReporting.throttleTime") || 300;
  }

  /**
   * Configure progress throttling to avoid too frequent updates
   * @param intervalMs Minimum interval between progress updates in milliseconds
   */
  public throttleUpdates(intervalMs: number): void {
    this.throttleTime = intervalMs;
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
   * Report progress with a message and optional metadata
   * @param message Human-readable progress message
   * @param metadata Optional metadata about the progress
   * @returns Promise that resolves when progress is reported
   */
  public async reportProgress(
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>,
  ): Promise<void> {
    const update: ProgressUpdate = {
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };

    return this.sendProgressUpdate(update);
  }

  /**
   * Start a new progress reporting session with a total number of steps
   * @param totalSteps Total number of steps in the operation
   * @param sessionName Optional session name for reporting context
   */
  public startSession(totalSteps: number, sessionName?: string): void {
    this.sessionActive = true;
    this.currentStep = 0;
    this.totalSteps = totalSteps;
    this.currentSessionName = sessionName;

    // Report session started
    this.sendProgressUpdate({
      message: sessionName
        ? `Starting ${sessionName}...`
        : "Starting operation...",
      timestamp: new Date().toISOString(),
      step: 0,
      totalSteps,
      sessionName,
      percentComplete: 0,
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
   */
  public async updateProgress(
    step: number,
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>,
  ): Promise<void> {
    if (!this.sessionActive) {
      console.warn(
        "Trying to update progress but no session is active. Call startSession first.",
      );
      return this.reportProgress(message, metadata);
    }

    this.currentStep = Math.min(step, this.totalSteps);
    const percentComplete =
      this.totalSteps > 0 ? (this.currentStep / this.totalSteps) * 100 : 0;

    const update: ProgressUpdate = {
      message,
      timestamp: new Date().toISOString(),
      metadata,
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
   */
  public async completeSession(
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>,
  ): Promise<void> {
    if (!this.sessionActive) {
      console.warn(
        "No active session to complete. Reporting final progress anyway.",
      );
      return this.reportProgress(message, metadata);
    }

    this.currentStep = this.totalSteps;
    const update: ProgressUpdate = {
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        sessionCompleted: true,
      },
      step: this.totalSteps,
      totalSteps: this.totalSteps,
      sessionName: this.currentSessionName,
      percentComplete: 100,
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
    if (
      this.throttleTime > 0 &&
      now - this.lastUpdateTime < this.throttleTime
    ) {
      if (this.updateTimer === null) {
        // Schedule an update for later
        this.updateTimer = setTimeout(
          () => {
            this.processPendingUpdate();
          },
          this.throttleTime - (now - this.lastUpdateTime),
        );
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
        });
      }

      // Update job queue if connected
      if (this.jobQueue && this.jobId) {
        await this.jobQueue.updateJobStatus(this.jobId, {
          status: update.metadata?.sessionCompleted
            ? "completed"
            : "processing",
          progress:
            update.percentComplete !== undefined
              ? update.percentComplete / 100
              : undefined,
          progressMessage: update.message,
          updated: update.timestamp,
        });
      }

      // Log the update
      const logPrefix = update.sessionName ? `[${update.sessionName}]` : "";
      const progressIndicator =
        update.percentComplete !== undefined
          ? `(${Math.round(update.percentComplete)}%)`
          : "";
      console.log(
        `${logPrefix} Progress ${progressIndicator}: ${update.message}`,
      );
    } catch (error) {
      console.error("Error reporting progress:", error);
    }
  }
}
