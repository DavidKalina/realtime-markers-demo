// services/event-processing/interfaces/IProgressReportingService.ts

import type { JobStatusUpdate } from "../ProgressReportingService";
import type { RichUIMetadata, richUITemplates } from "../types/RichMetadata";

/**
 * Callback function for progress updates
 */
export type ProgressCallback = (message: string, metadata?: Record<string, any>) => Promise<void>;

/**
 * Interface for services that report progress during operations
 */
export interface IProgressReportingService {
  /**
   * Pre-defined rich UI templates
   */
  templates: typeof richUITemplates;

  /**
   * Configure throttling interval for progress updates
   */
  throttleUpdates(intervalMs: number): void;

  /**
   * Add or update entries in the progress step mapping
   */
  updateProgressMappings(mappings: Record<string, number>): void;

  /**
   * Calculate normalized progress percentage based on message
   */
  calculateProgressPercentage(message: string, step?: number, totalSteps?: number): number;

  /**
   * Connect to job queue for a specific job ID
   */
  connectToJobQueue(jobId: string): void;

  /**
   * Report progress with a message and optional metadata
   */
  reportProgress(
    message: string,
    metadata?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void>;

  /**
   * Start a progress session with steps
   */
  startSession(totalSteps: number, sessionName?: string, richUI?: RichUIMetadata): void;

  /**
   * Update progress to a specific step
   */
  updateProgress(
    step: number,
    message: string,
    metadata?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void>;

  /**
   * Complete the progress session
   */
  completeSession(
    message: string,
    metadata?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void>;

  /**
   * Update job status directly
   */
  updateJobStatus(update: JobStatusUpdate): Promise<void>;

  /**
   * Mark job as started
   */
  markJobStarted(
    message: string,
    metadata?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void>;

  /**
   * Mark job as completed with results
   */
  markJobCompleted(
    message: string,
    result?: Record<string, any>,
    eventId?: string,
    richUI?: RichUIMetadata
  ): Promise<void>;

  /**
   * Mark job as failed with error information
   */
  markJobFailed(
    errorMessage: string,
    details?: Record<string, any>,
    richUI?: RichUIMetadata
  ): Promise<void>;
}
