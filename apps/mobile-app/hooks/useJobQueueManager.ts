import { useEffect, useCallback } from "react";
import { useJobQueueStore } from "@/stores/useJobQueueStore";
import { useJobStreamEnhanced } from "@/hooks/useJobStream";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";

/**
 * A hook that manages the job queue and integrates with the job stream.
 * It handles job lifecycle, progress updates, and provides methods for
 * queue management.
 */
export const useJobQueueManager = () => {
  // Get store actions and state
  const {
    jobIds,
    activeJobId,
    completedJobIds,
    failedJobIds,
    addJob,
    removeJob,
    setActiveJob,
    markJobCompleted,
    markJobFailed,
    resetQueue,
  } = useJobQueueStore();

  // Use the job stream hook for the active job
  const { jobState, isComplete, error, result, resetStream } = useJobStreamEnhanced(activeJobId);

  // Get the event broker for publishing events
  const { publish } = useEventBroker();

  // Handle job completion or failure
  useEffect(() => {
    if (!activeJobId) return;

    if (isComplete) {
      // Publish job completed or failed event
      if (error) {
        publish(EventTypes.ERROR_OCCURRED, {
          timestamp: Date.now(),
          source: "JobQueueManager",
          error: `Job ${activeJobId} failed: ${error}`,
        });
        markJobFailed(activeJobId);
      } else {
        publish(EventTypes.JOB_COMPLETED, {
          timestamp: Date.now(),
          source: "JobQueueManager",
          jobId: activeJobId,
          result,
        });
        markJobCompleted(activeJobId);
      }

      // Select next job if available
      if (jobIds.length > 0) {
        const nextJobId = jobIds[0];
        if (nextJobId) {
          // Reset stream before changing jobs
          resetStream();
          setActiveJob(nextJobId);

          // Publish job started event
          publish(EventTypes.JOB_STARTED, {
            timestamp: Date.now(),
            source: "JobQueueManager",
            jobId: nextJobId,
          });
        }
      }
    }
  }, [
    activeJobId,
    isComplete,
    error,
    jobIds,
    markJobCompleted,
    markJobFailed,
    setActiveJob,
    publish,
    resetStream,
    result,
  ]);

  // Add a new job to the queue
  const queueJob = useCallback(
    (jobId: string) => {
      // If this is the first job, we'll need to publish a job started event
      const isFirstJob = jobIds.length === 0 && !activeJobId;

      addJob(jobId);

      if (isFirstJob) {
        setActiveJob(jobId);
        publish(EventTypes.JOB_STARTED, {
          timestamp: Date.now(),
          source: "JobQueueManager",
          jobId,
        });
      }

      // Publish job queued event
      publish(EventTypes.JOB_QUEUED, {
        timestamp: Date.now(),
        source: "JobQueueManager",
        jobId,
      });

      return jobId;
    },
    [jobIds, activeJobId, addJob, setActiveJob, publish]
  );

  // Cancel a job
  const cancelJob = useCallback(
    (jobId: string) => {
      // If canceling the active job, reset the stream
      if (jobId === activeJobId) {
        resetStream();
      }

      removeJob(jobId);

      // Publish job canceled event
      publish(EventTypes.JOB_CANCELED, {
        timestamp: Date.now(),
        source: "JobQueueManager",
        jobId,
      });
    },
    [activeJobId, removeJob, resetStream, publish]
  );

  // Clear all jobs
  const clearAllJobs = useCallback(() => {
    // Reset the stream if there's an active job
    if (activeJobId) {
      resetStream();
    }

    resetQueue();

    // Publish all jobs cleared event
    publish(EventTypes.JOB_QUEUE_CLEARED, {
      timestamp: Date.now(),
      source: "JobQueueManager",
    });
  }, [activeJobId, resetStream, resetQueue, publish]);

  return {
    // Queue management
    queueJob,
    cancelJob,
    clearAllJobs,

    // Current state
    activeJobId,
    jobIds,
    jobState,
    completedJobIds,
    failedJobIds,
    isComplete,
    error,
    result,

    // Derived state
    hasActiveJobs: jobIds.length > 0 || activeJobId !== null,
    totalJobs: jobIds.length + completedJobIds.length + failedJobIds.length,
    queueLength: jobIds.length,
  };
};
