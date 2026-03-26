export const BUDGET_TIERS = [
  { label: "$", value: 0 },
  { label: "$$", value: 30 },
  { label: "$$$", value: 75 },
] as const;

export type BudgetTier = (typeof BUDGET_TIERS)[number];

export const DEFAULT_RADIUS_MILES = 5;
export const MIN_RADIUS_MILES = 0.5;
export const MAX_RADIUS_MILES = 25;

export const QUEST_STATUS_MESSAGES = [
  "The quest master is forging your path...",
  "Consulting the ancient maps...",
  "Scouting waypoints in your realm...",
  "Rolling for initiative...",
  "Your quest is being inscribed...",
] as const;
