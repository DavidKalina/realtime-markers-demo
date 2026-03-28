import { create } from "zustand";

interface ItineraryJobStore {
  /** Currently generating job ID, if any */
  activeJobId: string | null;
  /** The shell itinerary ID for the active job */
  activeItineraryId: string | null;
  /** Step label from SSE progress */
  stepLabel: string;
  /** True when generation completed and user hasn't viewed Plans yet */
  hasReady: boolean;
  /** Timestamp when the current job started (for stale detection) */
  jobStartedAt: number | null;

  startJob: (jobId: string, itineraryId?: string) => void;
  updateStep: (label: string) => void;
  completeJob: () => void;
  failJob: () => void;
  clearReady: () => void;
  /** Force-clear a stuck job (e.g. from a previous session) */
  clearStaleJob: () => void;
}

/** Jobs older than this are considered stale and auto-cleared */
const STALE_JOB_THRESHOLD = 6 * 60 * 1000; // 6 minutes (backend timeout is 5 min)

export const useItineraryJobStore = create<ItineraryJobStore>((set) => ({
  activeJobId: null,
  activeItineraryId: null,
  stepLabel: "",
  hasReady: false,
  jobStartedAt: null,

  startJob: (jobId, itineraryId) =>
    set({
      activeJobId: jobId,
      activeItineraryId: itineraryId ?? null,
      stepLabel: "Starting...",
      hasReady: false,
      jobStartedAt: Date.now(),
    }),

  updateStep: (label) => set({ stepLabel: label }),

  completeJob: () =>
    set({
      activeJobId: null,
      activeItineraryId: null,
      stepLabel: "",
      hasReady: true,
      jobStartedAt: null,
    }),

  failJob: () =>
    set({
      activeJobId: null,
      activeItineraryId: null,
      stepLabel: "",
      jobStartedAt: null,
    }),

  clearReady: () => set({ hasReady: false }),

  clearStaleJob: () =>
    set({
      activeJobId: null,
      activeItineraryId: null,
      stepLabel: "",
      jobStartedAt: null,
    }),
}));

/**
 * Check if the active job is stale and clear it if so.
 * Call this on app resume or before starting a new job.
 */
export function clearStaleJobIfNeeded(): boolean {
  const { activeJobId, jobStartedAt, clearStaleJob } =
    useItineraryJobStore.getState();
  if (activeJobId && jobStartedAt) {
    const elapsed = Date.now() - jobStartedAt;
    if (elapsed > STALE_JOB_THRESHOLD) {
      console.warn(
        `[ItineraryJobStore] Clearing stale job ${activeJobId} (elapsed ${Math.round(elapsed / 1000)}s)`,
      );
      clearStaleJob();
      return true;
    }
  }
  return false;
}
