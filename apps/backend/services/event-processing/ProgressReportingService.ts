// services/event-processing/ProgressReportingService.ts

/**
 * Interface for progress callback functions
 * Defines the shape of callbacks used to report progress
 */
export interface ProgressCallback {
  (message: string, metadata?: Record<string, any>): Promise<void>;
}

/**
 * Progress update with standard format and metadata
 */
export interface ProgressUpdate {
  /** Status message describing the current step */
  message: string;

  /** Optional metadata providing additional context */
  metadata?: Record<string, any>;

  /** Timestamp when the update was created */
  timestamp: string;

  /** Progress percentage (0-100) if applicable */
  percentage?: number;

  /** Step number in a multi-step process if applicable */
  step?: number;

  /** Total number of steps if applicable */
  totalSteps?: number;
}

/**
 * Service for centralized progress tracking and reporting
 * Provides standardized progress messaging and throttling
 */
export class ProgressReportingService {
  /** Minimum time between progress updates in milliseconds */
  private readonly throttleMs: number;

  /** Callback function to report progress */
  private callback: ProgressCallback | null;

  /** Timestamp of the last sent update */
  private lastUpdateTime: number = 0;

  /** Queue of pending updates during throttling */
  private pendingUpdate: ProgressUpdate | null = null;

  /** Whether an update is scheduled to be sent */
  private updateScheduled: boolean = false;

  /** Total number of steps in the current process */
  private totalSteps: number = 0;

  /** Current step in the process */
  private currentStep: number = 0;

  /**
   * Creates a new ProgressReportingService
   * @param callback Optional initial callback function
   * @param throttleMs Minimum time between updates in milliseconds
   */
  constructor(callback?: ProgressCallback, throttleMs: number = 300) {
    this.callback = callback || null;
    this.throttleMs = throttleMs;
  }

  /**
   * Set or update the callback function
   * @param callback New callback function
   */
  setCallback(callback: ProgressCallback): void {
    this.callback = callback;
  }

  /**
   * Clear the callback function
   */
  clearCallback(): void {
    this.callback = null;
  }

  /**
   * Initialize a multi-step process
   * @param totalSteps The total number of steps in the process
   */
  initializeSteps(totalSteps: number): void {
    this.totalSteps = totalSteps;
    this.currentStep = 0;
  }

  /**
   * Report progress for the current operation
   * Throttles updates to prevent overwhelming the UI
   *
   * @param message Progress message
   * @param metadata Optional metadata about the progress
   * @param forceUpdate Force immediate update even with throttling
   */
  async reportProgress(
    message: string,
    metadata?: Record<string, any>,
    forceUpdate: boolean = false
  ): Promise<void> {
    // If no callback is set, do nothing
    if (!this.callback) {
      return;
    }

    const now = Date.now();

    // Create standard progress update
    const update: ProgressUpdate = {
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Add step information if total steps is set
    if (this.totalSteps > 0) {
      update.step = this.currentStep;
      update.totalSteps = this.totalSteps;
      update.percentage = Math.round((this.currentStep / this.totalSteps) * 100);
    }

    // If throttling is active and not forcing an update
    if (!forceUpdate && now - this.lastUpdateTime < this.throttleMs) {
      // Store this update to send later
      this.pendingUpdate = update;

      // Schedule an update if not already scheduled
      if (!this.updateScheduled) {
        this.updateScheduled = true;

        // Calculate time until next update
        const timeToNextUpdate = this.throttleMs - (now - this.lastUpdateTime);

        setTimeout(() => this.sendPendingUpdate(), timeToNextUpdate);
      }

      return;
    }

    // Send the update immediately
    await this.sendUpdate(update);
  }

  /**
   * Report progress for a step in a multi-step process
   * Automatically increments the current step
   *
   * @param message Progress message
   * @param metadata Optional metadata about the progress
   * @param forceUpdate Force immediate update even with throttling
   */
  async reportStep(
    message: string,
    metadata?: Record<string, any>,
    forceUpdate: boolean = false
  ): Promise<void> {
    this.currentStep++;
    await this.reportProgress(message, metadata, forceUpdate);
  }

  /**
   * Report final completion of the process
   * Always forces an immediate update
   *
   * @param message Completion message
   * @param metadata Optional metadata about the completion
   */
  async reportCompletion(message: string, metadata?: Record<string, any>): Promise<void> {
    // Set current step to total steps if tracking steps
    if (this.totalSteps > 0) {
      this.currentStep = this.totalSteps;
    }

    // Force the update regardless of throttling
    await this.reportProgress(
      message,
      {
        ...metadata,
        completed: true,
      },
      true
    );

    // Reset the step tracking
    this.totalSteps = 0;
    this.currentStep = 0;
  }

  /**
   * Report an error in the process
   * Always forces an immediate update
   *
   * @param error Error message or object
   * @param metadata Optional metadata about the error
   */
  async reportError(error: string | Error, metadata?: Record<string, any>): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;

    await this.reportProgress(
      `Error: ${errorMessage}`,
      {
        ...metadata,
        error: true,
        errorDetails:
          error instanceof Error
            ? {
                name: error.name,
                stack: error.stack,
              }
            : undefined,
      },
      true
    );
  }

  /**
   * Send a progress update via the callback
   * @param update Progress update to send
   */
  private async sendUpdate(update: ProgressUpdate): Promise<void> {
    if (!this.callback) return;

    try {
      this.lastUpdateTime = Date.now();
      await this.callback(update.message, update.metadata);
    } catch (error) {
      console.error("Error in progress callback:", error);
    }
  }

  /**
   * Send any pending updates that were delayed due to throttling
   */
  private async sendPendingUpdate(): Promise<void> {
    this.updateScheduled = false;

    if (this.pendingUpdate) {
      const update = this.pendingUpdate;
      this.pendingUpdate = null;
      await this.sendUpdate(update);
    }
  }
}
