import { BaseApiModule } from "../base/BaseApiModule";
import type { JobStreamMessage } from "../base/types";

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
  result?: Record<string, unknown>;
}

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

/**
 * JobsModule provides comprehensive job management and real-time progress streaming
 *
 * Features:
 * - Get user jobs with detailed progress information (limited to 50 most recent jobs by default)
 * - Real-time progress streaming via Server-Sent Events (SSE)
 * - WebSocket integration for live job updates
 * - Job cancellation and retry functionality
 *
 * Usage Examples:
 *
 * // 1. Get all user jobs (limited to 50 most recent)
 * const { jobs } = await jobsModule.getUserJobs();
 *
 * // 1b. Get specific number of jobs
 * const { jobs } = await jobsModule.getUserJobs(100); // Get 100 most recent jobs
 *
 * // 2. Stream job progress with SSE
 * const eventSource = await jobsModule.createJobStream(jobId, {
 *   onMessage: (data) => {
 *     console.log(`Job ${data.id}: ${data.progress}% - ${data.progressStep}`);
 *     updateProgressBar(data.progress);
 *     updateStepDescription(data.progressDetails?.stepDescription);
 *   },
 *   onComplete: () => {
 *     console.log('Job completed!');
 *     showSuccessMessage();
 *   }
 * });
 *
 * // 3. WebSocket for multiple jobs
 * const ws = await jobsModule.createJobWebSocket({
 *   onJobUpdate: (jobId, data) => {
 *     console.log(`Job ${jobId} updated: ${data.progress}%`);
 *     updateJobInList(jobId, data);
 *   }
 * });
 *
 * // 4. Get detailed progress context
 * const progressContext = await jobsModule.getJobProgressContext(jobId);
 * console.log(`Step ${progressContext.currentStep} of ${progressContext.totalSteps}`);
 */
export class JobsModule extends BaseApiModule {
  /**
   * Get all jobs for the current user
   *
   * @param limit - Optional limit for the number of jobs to return (defaults to 50)
   * @returns Promise with jobs array (limited to most recent jobs)
   */
  async getUserJobs(limit?: number): Promise<{ jobs: JobData[] }> {
    let url = `${this.client.baseUrl}/api/jobs`;
    if (limit) {
      url += `?limit=${limit}`;
    }
    const response = await this.fetchWithAuth(url);
    return await this.handleResponse<{ jobs: JobData[] }>(response);
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(
    jobId: string,
  ): Promise<JobData & { event?: Record<string, unknown> }> {
    const url = `${this.client.baseUrl}/api/jobs/${jobId}/status`;
    const response = await this.fetchWithAuth(url);
    return await this.handleResponse<
      JobData & { event?: Record<string, unknown> }
    >(response);
  }

  /**
   * Get detailed job progress context
   */
  async getJobProgressContext(jobId: string): Promise<JobProgressContext> {
    const url = `${this.client.baseUrl}/api/jobs/${jobId}/progress`;
    const response = await this.fetchWithAuth(url);
    return await this.handleResponse<JobProgressContext>(response);
  }

  /**
   * Create a job stream for real-time progress updates using Server-Sent Events (SSE)
   *
   * This method establishes a persistent connection to receive real-time updates
   * about a specific job's progress. The connection automatically closes when
   * the job is completed or fails.
   *
   * @param jobId - The ID of the job to stream
   * @param callbacks - Object containing callback functions for different events
   * @returns Promise<EventSource> - The EventSource instance for the stream
   *
   * @example
   * ```typescript
   * const eventSource = await jobsModule.createJobStream(jobId, {
   *   onMessage: (data) => {
   *     // Update UI with progress information
   *     updateProgressBar(data.progress);
   *     updateStepDescription(data.progressStep);
   *
   *     // Handle detailed progress information
   *     if (data.progressDetails) {
   *       console.log(`Step ${data.progressDetails.currentStep} of ${data.progressDetails.totalSteps}`);
   *       console.log(`Current step: ${data.progressDetails.stepDescription}`);
   *     }
   *   },
   *   onError: (error) => {
   *     console.error('Stream error:', error);
   *     showErrorMessage('Connection lost. Please refresh.');
   *   },
   *   onComplete: () => {
   *     console.log('Job completed!');
   *     showSuccessMessage();
   *   }
   * });
   *
   * // Don't forget to close the stream when done
   * // eventSource.close();
   * ```
   */
  async createJobStream(
    jobId: string,
    callbacks: {
      onMessage: (data: JobStreamMessage) => void;
      onError?: (error: Event) => void;
      onComplete?: () => void;
    },
  ): Promise<EventSource> {
    let url = `${this.client.baseUrl}/api/jobs/${jobId}/stream`;
    const accessToken = await this.client.getAccessToken();
    if (accessToken) {
      url += `?token=${encodeURIComponent(accessToken)}`;
    }

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callbacks.onMessage(data);

        // Close connection if job is completed or failed
        if (data.status === "completed" || data.status === "failed") {
          eventSource.close();
          if (callbacks.onComplete) callbacks.onComplete();
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      if (callbacks.onError) callbacks.onError(error);
      eventSource.close();
    };

    return eventSource;
  }

  /**
   * Create a WebSocket connection for job updates
   *
   * This method establishes a WebSocket connection to receive real-time updates
   * for all jobs associated with the current user. This is useful for applications
   * that need to track multiple jobs simultaneously.
   *
   * @param callbacks - Object containing callback functions for different events
   * @returns Promise<WebSocket> - The WebSocket instance
   *
   * @example
   * ```typescript
   * const ws = await jobsModule.createJobWebSocket({
   *   onJobUpdate: (jobId, data) => {
   *     // Update job in a list or dashboard
   *     updateJobInList(jobId, {
   *       status: data.status,
   *       progress: data.progress,
   *       step: data.progressStep
   *     });
   *
   *     // Show notifications for important updates
   *     if (data.status === "completed") {
   *       showNotification(`Job ${jobId} completed successfully!`);
   *     } else if (data.status === "failed") {
   *       showNotification(`Job ${jobId} failed: ${data.error}`, "error");
   *     }
   *   },
   *   onOpen: () => {
   *     console.log('WebSocket connected for job updates');
   *   },
   *   onClose: () => {
   *     console.log('WebSocket disconnected');
   *     // Optionally attempt to reconnect
   *   },
   *   onError: (error) => {
   *     console.error('WebSocket error:', error);
   *   }
   * });
   *
   * // Don't forget to close the connection when done
   * // ws.close();
   * ```
   */
  async createJobWebSocket(callbacks: {
    onJobUpdate: (jobId: string, data: JobStreamMessage) => void;
    onError?: (error: Event) => void;
    onOpen?: () => void;
    onClose?: () => void;
  }): Promise<WebSocket> {
    const wsUrl = process.env.WEBSOCKET_URL || "ws://localhost:8081";
    const accessToken = await this.client.getAccessToken();

    const url = accessToken
      ? `${wsUrl}?token=${encodeURIComponent(accessToken)}`
      : wsUrl;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("Job WebSocket connected");
      if (callbacks.onOpen) callbacks.onOpen();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle job progress updates
        if (message.type === "JOB_PROGRESS_UPDATE" && message.data) {
          callbacks.onJobUpdate(message.data.jobId, message.data);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("Job WebSocket error:", error);
      if (callbacks.onError) callbacks.onError(error);
    };

    ws.onclose = () => {
      console.log("Job WebSocket disconnected");
      if (callbacks.onClose) callbacks.onClose();
    };

    return ws;
  }

  /**
   * Cancel a job (if supported)
   */
  async cancelJob(jobId: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/jobs/${jobId}`;
    const response = await this.fetchWithAuth(url, { method: "DELETE" });
    await this.handleResponse(response);
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<{ jobId: string }> {
    const url = `${this.client.baseUrl}/api/jobs/${jobId}/retry`;
    const response = await this.fetchWithAuth(url, { method: "POST" });
    return await this.handleResponse<{ jobId: string }>(response);
  }
}
