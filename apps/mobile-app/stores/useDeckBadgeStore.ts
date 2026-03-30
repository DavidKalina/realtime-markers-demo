import { create } from "zustand";

interface DeckBadgeStore {
  hasNewCards: boolean;
  markNewCard: () => void;
  clearBadge: () => void;
}

export const useDeckBadgeStore = create<DeckBadgeStore>((set) => ({
  hasNewCards: false,
  markNewCard: () => set({ hasNewCards: true }),
  clearBadge: () => set({ hasNewCards: false }),
}));
