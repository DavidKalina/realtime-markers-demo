// services/event-processing/interfaces/IProgressReportingService.ts

/**
 * Standard progress reporting callback type
 * @param message Human-readable progress message
 * @param metadata Optional metadata about the progress
 */
export type ProgressCallback = (message: string, metadata?: Record<string, any>) => Promise<void>;

/**
 * Interface for progress reporting services
 * Provides a standardized way to report progress during long-running operations
 */
export interface IProgressReportingService {
  /**
   * Report progress with a message and optional metadata
   * @param message Human-readable progress message
   * @param metadata Optional metadata about the progress
   * @returns Promise that resolves when progress is reported
   */
  reportProgress(message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Configure progress throttling to avoid too frequent updates
   * @param intervalMs Minimum interval between progress updates in milliseconds
   */
  throttleUpdates(intervalMs: number): void;

  /**
   * Connect the progress reporter to a specific job for tracking
   * @param jobId ID of the job to associate progress with
   */
  connectToJobQueue(jobId: string): void;

  /**
   * Start a new progress reporting session with a total number of steps
   * @param totalSteps Total number of steps in the operation
   * @param sessionName Optional session name for reporting context
   */
  startSession(totalSteps: number, sessionName?: string): void;

  /**
   * Update progress to a specific step
   * @param step Current step number
   * @param message Human-readable progress message for this step
   * @param metadata Optional metadata about the progress
   */
  updateProgress(step: number, message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Complete the current progress reporting session
   * @param message Final message for the completed operation
   * @param metadata Optional metadata about the completed operation
   */
  completeSession(message: string, metadata?: Record<string, any>): Promise<void>;
}
