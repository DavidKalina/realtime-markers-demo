import { create } from "zustand";

interface PendingXPEvent {
  amount: number;
  action: string;
  timestamp: number;
}

interface LevelUpEvent {
  tierName: string;
  emoji: string;
  timestamp: number;
}

interface XPStore {
  pendingXP: PendingXPEvent[];
  pendingLevelUp: LevelUpEvent | null;
  totalPendingXP: number;
  hasPending: boolean;

  addXP: (amount: number, action: string) => void;
  setLevelUp: (tierName: string, emoji: string) => void;
  consume: () => {
    xpEvents: PendingXPEvent[];
    levelUp: LevelUpEvent | null;
    totalXP: number;
  };
}

export const useXPStore = create<XPStore>((set, get) => ({
  pendingXP: [],
  pendingLevelUp: null,
  totalPendingXP: 0,
  hasPending: false,

  addXP: (amount, action) =>
    set((state) => {
      state.pendingXP.push({ amount, action, timestamp: Date.now() });
      return {
        pendingXP: state.pendingXP,
        totalPendingXP: state.totalPendingXP + amount,
        hasPending: true,
      };
    }),

  setLevelUp: (tierName, emoji) =>
    set({
      pendingLevelUp: { tierName, emoji, timestamp: Date.now() },
      hasPending: true,
    }),

  consume: () => {
    const state = get();
    const result = {
      xpEvents: state.pendingXP,
      levelUp: state.pendingLevelUp,
      totalXP: state.totalPendingXP,
    };
    set({
      pendingXP: [],
      pendingLevelUp: null,
      totalPendingXP: 0,
      hasPending: false,
    });
    return result;
  },
}));
