import type { Rarity } from "./rarity.js";

// ── Quest roles within a weekly pack ────────────────────────

export const QUEST_ROLES = ["deepen", "explore", "discover", "stretch", "enjoy"] as const;
export type QuestRole = (typeof QUEST_ROLES)[number];

// ── Pathway phases ──────────────────────────────────────────

export const PATHWAY_PHASES = ["bfs", "dfs"] as const;
export type PathwayPhase = (typeof PATHWAY_PHASES)[number];

// ── Display labels ──────────────────────────────────────────

export const QUEST_ROLE_LABELS: Record<QuestRole, string> = {
  deepen: "YOUR GROOVE",
  explore: "EXPLORING",
  discover: "FIRST LOOK",
  stretch: "STRETCH GOAL",
  enjoy: "JUST FOR FUN",
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "FIRST STEP",
  uncommon: "OPENING UP",
  rare: "BREAKTHROUGH",
  epic: "DEEP GROWTH",
  legendary: "TRANSFORMATION",
};

// ── Quest purposes (social life builder) ──────────────────

export const QUEST_PURPOSES = ["get-out", "explore", "return", "social-stretch", "challenge", "enjoy"] as const;
export type QuestPurpose = (typeof QUEST_PURPOSES)[number];

export const PURPOSE_LABELS: Record<QuestPurpose, string> = {
  "get-out": "JUST SHOW UP",
  "explore": "NEW TERRITORY",
  "return": "BECOMING A REGULAR",
  "social-stretch": "SOCIAL STRETCH",
  "challenge": "CHALLENGE",
  "enjoy": "TREAT YOURSELF",
};

export const PURPOSE_DESCRIPTIONS: Record<QuestPurpose, string> = {
  "get-out": "The win is leaving the house",
  "explore": "Somewhere you haven't been",
  "return": "Building familiarity here",
  "social-stretch": "This one asks something of you",
  "challenge": "No venue — just courage",
  "enjoy": "You earned this one",
};
