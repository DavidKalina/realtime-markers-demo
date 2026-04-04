/** Completion count thresholds that trigger milestone rewards */
export const COMPLETION_MILESTONES = [5, 10, 25, 50, 100] as const;

/** Streak week count → XP reward */
export const STREAK_MILESTONES: Record<number, number> = {
  3: 100,
  7: 250,
  12: 500,
  26: 1000,
  52: 2500,
};
