import { create } from "zustand";

interface UIStore {
  hasNewDeckCards: boolean;
  markNewDeckCard: () => void;
  clearDeckBadge: () => void;
  isJobSheetOpen: boolean;
  openJobSheet: () => void;
  closeJobSheet: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  hasNewDeckCards: false,
  markNewDeckCard: () => set({ hasNewDeckCards: true }),
  clearDeckBadge: () => set({ hasNewDeckCards: false }),
  isJobSheetOpen: false,
  openJobSheet: () => set({ isJobSheetOpen: true }),
  closeJobSheet: () => set({ isJobSheetOpen: false }),
}));
