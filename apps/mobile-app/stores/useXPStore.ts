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

export interface PendingBadge {
  badgeId: string;
  badgeName: string;
  badgeEmoji: string;
  timestamp: number;
}

interface XPStore {
  pendingXP: PendingXPEvent[];
  pendingLevelUp: LevelUpEvent | null;
  pendingBadges: PendingBadge[];
  totalPendingXP: number;
  hasPending: boolean;

  addXP: (amount: number, action: string) => void;
  setLevelUp: (tierName: string, emoji: string) => void;
  addBadge: (badgeId: string, badgeName: string, badgeEmoji: string) => void;
  consume: () => {
    xpEvents: PendingXPEvent[];
    levelUp: LevelUpEvent | null;
    badges: PendingBadge[];
    totalXP: number;
  };
}

export const useXPStore = create<XPStore>((set, get) => ({
  pendingXP: [],
  pendingLevelUp: null,
  pendingBadges: [],
  totalPendingXP: 0,
  hasPending: false,

  addXP: (amount, action) =>
    set((state) => ({
      pendingXP: [
        ...state.pendingXP,
        { amount, action, timestamp: Date.now() },
      ],
      totalPendingXP: state.totalPendingXP + amount,
      hasPending: true,
    })),

  setLevelUp: (tierName, emoji) =>
    set({
      pendingLevelUp: { tierName, emoji, timestamp: Date.now() },
      hasPending: true,
    }),

  addBadge: (badgeId, badgeName, badgeEmoji) =>
    set((state) => ({
      pendingBadges: [
        ...state.pendingBadges,
        { badgeId, badgeName, badgeEmoji, timestamp: Date.now() },
      ],
      hasPending: true,
    })),

  consume: () => {
    const state = get();
    const result = {
      xpEvents: state.pendingXP,
      levelUp: state.pendingLevelUp,
      badges: state.pendingBadges,
      totalXP: state.totalPendingXP,
    };
    set({
      pendingXP: [],
      pendingLevelUp: null,
      pendingBadges: [],
      totalPendingXP: 0,
      hasPending: false,
    });
    return result;
  },
}));
