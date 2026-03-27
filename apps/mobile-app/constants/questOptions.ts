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

export const GEN_EMOJIS = [
  "\u{1F5FA}\uFE0F", "\u{1F3AF}", "\u{1F3AA}", "\u{1F3AD}",
  "\u{1F3A8}", "\u{1F3B5}", "\u{1F37D}\uFE0F", "\u2615",
  "\u{1F3DE}\uFE0F", "\u{1F6B6}", "\u{1F3D5}\uFE0F", "\u{1F30A}",
  "\u{1F3DB}\uFE0F", "\u{1F3A4}", "\u{1F9D7}", "\u{1F6B2}",
] as const;

export const STOP_TITLES = [
  "Finding a caf\u{E9}\u2026",
  "Scouting a park\u2026",
  "Checking galleries\u2026",
  "Mapping restaurants\u2026",
  "Locating a bar\u2026",
  "Searching trails\u2026",
  "Browsing markets\u2026",
  "Pinning a museum\u2026",
] as const;
