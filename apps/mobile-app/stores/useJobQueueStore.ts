import { create } from "zustand";

// Define the state interface for our job queue
interface JobQueueState {
  jobIds: string[]; // List of job IDs in the queue
  activeJobId: string | null; // Currently active job
  completedJobIds: string[]; // Completed jobs
  failedJobIds: string[]; // Failed jobs

  // Actions
  addJob: (jobId: string) => void;
  removeJob: (jobId: string) => void;
  setActiveJob: (jobId: string | null) => void;
  markJobCompleted: (jobId: string) => void;
  markJobFailed: (jobId: string) => void;
  resetQueue: () => void;
}

export const useJobQueueStore = create<JobQueueState>((set) => ({
  jobIds: [],
  activeJobId: null,
  completedJobIds: [],
  failedJobIds: [],

  // Add a new job to the queue
  addJob: (jobId: string) =>
    set((state) => {
      // If job is already in queue, don't add it again
      if (state.jobIds.includes(jobId)) return state;

      return {
        jobIds: [...state.jobIds, jobId],
        // If no active job, make this the active one
        activeJobId: state.activeJobId === null ? jobId : state.activeJobId,
      };
    }),

  // Remove a job from the queue
  removeJob: (jobId: string) =>
    set((state) => {
      const filteredJobIds = state.jobIds.filter((id) => id !== jobId);

      return {
        jobIds: filteredJobIds,
        // If active job was removed, select the next one
        activeJobId: state.activeJobId === jobId ? filteredJobIds[0] || null : state.activeJobId,
      };
    }),

  // Set the active job
  setActiveJob: (jobId: string | null) =>
    set({
      activeJobId: jobId,
    }),

  // Mark a job as completed and remove from queue
  markJobCompleted: (jobId: string) =>
    set((state) => {
      const filteredJobIds = state.jobIds.filter((id) => id !== jobId);

      return {
        completedJobIds: [...state.completedJobIds, jobId],
        jobIds: filteredJobIds,
        activeJobId: state.activeJobId === jobId ? filteredJobIds[0] || null : state.activeJobId,
      };
    }),

  // Mark a job as failed and remove from queue
  markJobFailed: (jobId: string) =>
    set((state) => {
      const filteredJobIds = state.jobIds.filter((id) => id !== jobId);

      return {
        failedJobIds: [...state.failedJobIds, jobId],
        jobIds: filteredJobIds,
        activeJobId: state.activeJobId === jobId ? filteredJobIds[0] || null : state.activeJobId,
      };
    }),

  // Reset the entire queue
  resetQueue: () =>
    set({
      jobIds: [],
      activeJobId: null,
      completedJobIds: [],
      failedJobIds: [],
    }),
}));
