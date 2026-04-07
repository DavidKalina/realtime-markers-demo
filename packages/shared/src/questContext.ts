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
