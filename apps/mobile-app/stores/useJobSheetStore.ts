import { create } from "zustand";

interface JobSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useJobSheetStore = create<JobSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
