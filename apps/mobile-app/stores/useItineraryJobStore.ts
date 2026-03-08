import { create } from "zustand";

interface ItineraryJobStore {
  /** Currently generating job ID, if any */
  activeJobId: string | null;
  /** Step label from SSE progress */
  stepLabel: string;
  /** True when generation completed and user hasn't viewed Plans yet */
  hasReady: boolean;

  startJob: (jobId: string) => void;
  updateStep: (label: string) => void;
  completeJob: () => void;
  failJob: () => void;
  clearReady: () => void;
}

export const useItineraryJobStore = create<ItineraryJobStore>((set) => ({
  activeJobId: null,
  stepLabel: "",
  hasReady: false,

  startJob: (jobId) =>
    set({ activeJobId: jobId, stepLabel: "Starting...", hasReady: false }),

  updateStep: (label) => set({ stepLabel: label }),

  completeJob: () => set({ activeJobId: null, stepLabel: "", hasReady: true }),

  failJob: () => set({ activeJobId: null, stepLabel: "" }),

  clearReady: () => set({ hasReady: false }),
}));
