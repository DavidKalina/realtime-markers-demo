import type { DataSource } from "typeorm";
import { Pathway } from "@realtime-markers/database";
import type { ResonanceResult } from "./ResonanceService";
import {
  type QuestConfig,
  type PhaseDetectionConfig,
  DEFAULT_QUEST_CONFIG,
} from "./shared/QuestConfig";

// ── Theme labels ─────────────────────────────────────────────

const THEME_LABELS: Record<string, string> = {
  cafe: "Coffee Culture",
  trail: "Trail Explorer",
  park: "Green Spaces",
  bar: "Nightlife",
  restaurant: "Food Adventures",
  museum: "Culture & History",
  gallery: "Art Scene",
  market: "Market Wanderer",
  venue: "Live Events",
  attraction: "Local Discovery",
  fitness: "Active Life",
  other: "Off the Beaten Path",
};

function themeLabel(category: string): string {
  return THEME_LABELS[category] ?? `${category.charAt(0).toUpperCase()}${category.slice(1)} Journey`;
}

// ── Types ────────────────────────────────────────────────────

export interface PathwayState {
  id: string;
  theme: string;
  themeLabel: string;
  venueCategories: string[];
  avgResonance: number;
  questCount: number;
  currentDifficulty: number;
  difficultyTrend: number;
  phase: string;
  sidequestIds: string[];
  resonanceScores: { sidequestId: string; score: number; reflectionTags?: string[] }[];
}

export interface PhaseContext {
  globalPhase: "bfs" | "mixed" | "dfs";
  pathways: {
    theme: string;
    themeLabel: string;
    phase: string;
    avgResonance: number;
    questCount: number;
    currentDifficulty: number;
  }[];
  recommendation: string;
}

export interface PathwayDetectionResult {
  pathway: PathwayState;
  phaseTransition: { from: string; to: string } | null;
  isNew: boolean;
}

// ── Pure functions (used by both DB service and simulation) ──

export function detectPathway(
  existingPathways: PathwayState[],
  sidequestId: string,
  venueCategory: string,
  difficulty: number,
  resonance: ResonanceResult,
  config: PhaseDetectionConfig,
): PathwayDetectionResult | null {
  // Try to match an existing pathway
  const matched = existingPathways.find(
    (p) => p.venueCategories.includes(venueCategory) || p.theme === venueCategory,
  );

  if (matched) {
    const existingDfsCount = existingPathways.filter((p) => p.phase === "dfs").length;
    return updatePathwayState(matched, sidequestId, venueCategory, difficulty, resonance, config, existingDfsCount);
  }

  // Create new pathway only if resonance is high enough
  if (resonance.score >= config.newPathwayMinResonance) {
    const newPathway: PathwayState = {
      id: crypto.randomUUID(),
      theme: venueCategory,
      themeLabel: themeLabel(venueCategory),
      venueCategories: [venueCategory],
      avgResonance: resonance.score,
      questCount: 1,
      currentDifficulty: difficulty,
      difficultyTrend: 0,
      phase: "bfs",
      sidequestIds: [sidequestId],
      resonanceScores: [{ sidequestId, score: resonance.score, reflectionTags: resonance.reflectionTags }],
    };
    return { pathway: newPathway, phaseTransition: null, isNew: true };
  }

  return null;
}

function updatePathwayState(
  pathway: PathwayState,
  sidequestId: string,
  venueCategory: string,
  difficulty: number,
  resonance: ResonanceResult,
  config: PhaseDetectionConfig,
  existingDfsCount: number,
): PathwayDetectionResult {
  const scores = [...(pathway.resonanceScores ?? []), { sidequestId, score: resonance.score, reflectionTags: resonance.reflectionTags }];
  const questCount = pathway.questCount + 1;
  const avgResonance = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  const prevDifficulty = pathway.currentDifficulty;
  const difficultyTrend = questCount > 1
    ? (difficulty - prevDifficulty) / (questCount - 1)
    : 0;

  const categories = pathway.venueCategories.includes(venueCategory)
    ? pathway.venueCategories
    : [...pathway.venueCategories, venueCategory];

  const prevPhase = pathway.phase;
  let phase = prevPhase;

  // Phase transition check — rising threshold for additional DFS pathways.
  // 1st DFS pathway needs base threshold (0.55). Each additional one needs +0.05 more
  // and +1 more quest in category. This prevents everything from going DFS at once.
  const adjustedThreshold = config.resonanceThresholdForDFS + existingDfsCount * 0.05;
  const adjustedMinQuests = config.minQuestsInCategoryForDFS + existingDfsCount;

  if (
    prevPhase === "bfs" &&
    avgResonance >= adjustedThreshold &&
    questCount >= adjustedMinQuests
  ) {
    phase = "dfs";
  }

  const updated: PathwayState = {
    ...pathway,
    venueCategories: categories,
    avgResonance,
    questCount,
    currentDifficulty: difficulty,
    difficultyTrend,
    phase,
    sidequestIds: [...pathway.sidequestIds, sidequestId],
    resonanceScores: scores,
  };

  const phaseTransition = phase !== prevPhase ? { from: prevPhase, to: phase } : null;

  return { pathway: updated, phaseTransition, isNew: false };
}

// ── Reflection tag analysis ─────────────────────────────────

type ReflectionSignal = "thriving" | "growing_through_discomfort" | "stalling" | "struggling" | "neutral";

function analyzePathwayReflection(pathway: PathwayState): ReflectionSignal {
  const allTags = (pathway.resonanceScores ?? [])
    .flatMap((s) => s.reflectionTags ?? []);

  if (allTags.length === 0) return "neutral";

  // Look at recent entries (last 3) for trend — don't let old data dominate
  const recentTags = (pathway.resonanceScores ?? [])
    .slice(-3)
    .flatMap((s) => s.reflectionTags ?? []);

  const recentScores = (pathway.resonanceScores ?? []).slice(-3);
  const recentAvgScore = recentScores.length > 0
    ? recentScores.reduce((s, r) => s + r.score, 0) / recentScores.length
    : pathway.avgResonance;

  const hasGrowth = recentTags.includes("growth_narrative");
  const hasSelfAwareness = recentTags.includes("self_awareness");
  const hasDiscomfortProcessed = recentTags.includes("discomfort_processed");
  const hasSocialConnection = recentTags.includes("social_connection");
  const surfaceCount = recentTags.filter((t) => t === "surface_level").length;

  // User is processing discomfort constructively — this IS the growth edge
  if (hasDiscomfortProcessed) return "growing_through_discomfort";

  // Strong positive signals
  if (hasGrowth || (hasSelfAwareness && recentAvgScore >= 0.5)) return "thriving";
  if (hasSocialConnection && recentAvgScore >= 0.5) return "thriving";

  // Low resonance + surface-level entries = not engaging
  if (surfaceCount >= 2 && recentAvgScore < 0.4) return "stalling";

  // Low resonance without any processing signals = struggling
  if (recentAvgScore < 0.35 && !hasDiscomfortProcessed && !hasGrowth) return "struggling";

  return "neutral";
}

function pathwayGuidance(p: PathwayState, signal: ReflectionSignal): string {
  const trend = p.difficultyTrend > 0 ? "escalating" : p.difficultyTrend < 0 ? "easing" : "steady";
  const base = `"${p.themeLabel}" (${p.questCount} quests, avg resonance ${p.avgResonance.toFixed(2)}, difficulty ${trend} at ${p.currentDifficulty})`;

  switch (signal) {
    case "thriving":
      return `  - ${base}. User is thriving here — lean in. Escalate: busier venue, add a social element, push slightly further. This is working.`;

    case "growing_through_discomfort":
      return `  - ${base}. User is processing discomfort constructively — this is real growth. ` +
        `Hold difficulty steady or nudge gently. Don't back off — they're building resilience. ` +
        `But don't pile on either. Same category, slight variation.`;

    case "stalling":
      return `  - ${base}. User seems disengaged — surface-level reflections, low resonance. ` +
        `Try a fresh angle within this category (different time of day, different neighborhood, add a social twist). ` +
        `If this doesn't improve, this pathway may not be their thing.`;

    case "struggling":
      return `  - ${base}. Recent entries show low resonance without signs of productive discomfort. ` +
        `Ease off — reduce difficulty, try a more approachable variant, or deprioritize this pathway. ` +
        `The user shouldn't have to white-knuckle through something that isn't serving them.`;

    case "neutral":
    default:
      return `  - ${base}. Prescribe the NEXT step in this thread — more social, busier, further in this category.`;
  }
}

export function buildPhaseContext(pathways: PathwayState[]): PhaseContext {
  if (pathways.length === 0) {
    return {
      globalPhase: "bfs",
      pathways: [],
      recommendation: "PHASE: Exploration mode. Breadth-first — cast a wide net across different categories and directions. The user hasn't found their thread yet.",
    };
  }

  const dfsPathways = pathways.filter((p) => p.phase === "dfs");
  const bfsPathways = pathways.filter((p) => p.phase === "bfs");

  let globalPhase: "bfs" | "mixed" | "dfs";
  if (dfsPathways.length === 0) globalPhase = "bfs";
  else if (bfsPathways.length === 0) globalPhase = "dfs";
  else globalPhase = "mixed";

  const lines: string[] = [];

  if (dfsPathways.length > 0) {
    lines.push("ACTIVE PATHWAYS (DEEPEN these — the user resonates strongly here):");
    for (const p of dfsPathways) {
      const signal = analyzePathwayReflection(p);
      lines.push(pathwayGuidance(p, signal));
    }
  }

  if (bfsPathways.length > 0) {
    lines.push("EXPLORING (continue breadth-first for these — not enough signal yet):");
    for (const p of bfsPathways) {
      const signal = analyzePathwayReflection(p);
      if (signal === "struggling") {
        lines.push(
          `  - "${p.themeLabel}" (${p.questCount} quests, resonance ${p.avgResonance.toFixed(2)}) — ` +
          `recent experiences aren't landing. Deprioritize this category and explore elsewhere.`,
        );
      } else {
        lines.push(
          `  - "${p.themeLabel}" (${p.questCount} quests, resonance ${p.avgResonance.toFixed(2)}) — keep probing, try variations.`,
        );
      }
    }
  }

  if (dfsPathways.length > 0 && bfsPathways.length > 0) {
    lines.push(
      "\nSTRATEGY: Alternate between deepening active pathways and exploring new territory. " +
      `Prioritize active pathways ~60% of the time, BFS exploration ~40%.`,
    );
  } else if (dfsPathways.length > 0) {
    lines.push(
      "\nSTRATEGY: User has found their groove. Focus on deepening — escalate difficulty, " +
      "introduce social elements, vary within the same category. Only explore new categories if the user explicitly asks.",
    );
  } else {
    lines.push(
      "\nSTRATEGY: Breadth-first. Cast a wide net across categories and directions. " +
      "Watch for resonance signals — high ratings, rich journals, social escalation.",
    );
  }

  return {
    globalPhase,
    pathways: pathways.map((p) => ({
      theme: p.theme,
      themeLabel: p.themeLabel,
      phase: p.phase,
      avgResonance: p.avgResonance,
      questCount: p.questCount,
      currentDifficulty: p.currentDifficulty,
    })),
    recommendation: lines.join("\n"),
  };
}

// ── DB-backed service ────────────────────────────────────────

export interface PathwayService {
  detectOrCreatePathway(
    userId: string,
    sidequestId: string,
    venueCategory: string,
    difficulty: number,
    resonance: ResonanceResult,
  ): Promise<PathwayDetectionResult | null>;
  getPathways(userId: string): Promise<Pathway[]>;
  getUserPhaseContext(userId: string): Promise<PhaseContext>;
}

interface PathwayServiceDeps {
  dataSource: DataSource;
  config?: QuestConfig;
}

class PathwayServiceImpl implements PathwayService {
  private dataSource: DataSource;
  private config: QuestConfig;

  constructor(deps: PathwayServiceDeps) {
    this.dataSource = deps.dataSource;
    this.config = deps.config ?? DEFAULT_QUEST_CONFIG;
  }

  async detectOrCreatePathway(
    userId: string,
    sidequestId: string,
    venueCategory: string,
    difficulty: number,
    resonance: ResonanceResult,
  ): Promise<PathwayDetectionResult | null> {
    const repo = this.dataSource.getRepository(Pathway);
    const existing = await repo.find({ where: { userId } });

    const existingStates: PathwayState[] = existing.map((p) => ({
      id: p.id,
      theme: p.theme,
      themeLabel: p.themeLabel ?? themeLabel(p.theme),
      venueCategories: p.venueCategories,
      avgResonance: Number(p.avgResonance),
      questCount: p.questCount,
      currentDifficulty: p.currentDifficulty,
      difficultyTrend: Number(p.difficultyTrend),
      phase: p.phase,
      sidequestIds: p.sidequestIds,
      resonanceScores: p.resonanceScores ?? [],
    }));

    const result = detectPathway(
      existingStates,
      sidequestId,
      venueCategory,
      difficulty,
      resonance,
      this.config.phaseDetection,
    );

    if (!result) return null;

    // Persist
    const pw = result.pathway;
    if (result.isNew) {
      const entity = repo.create({
        userId,
        theme: pw.theme,
        themeLabel: pw.themeLabel,
        venueCategories: pw.venueCategories,
        avgResonance: pw.avgResonance,
        questCount: pw.questCount,
        currentDifficulty: pw.currentDifficulty,
        difficultyTrend: pw.difficultyTrend,
        phase: pw.phase,
        sidequestIds: pw.sidequestIds,
        resonanceScores: pw.resonanceScores,
      });
      const saved = await repo.save(entity);
      result.pathway.id = saved.id;
    } else {
      await repo.update(pw.id, {
        venueCategories: pw.venueCategories,
        avgResonance: pw.avgResonance,
        questCount: pw.questCount,
        currentDifficulty: pw.currentDifficulty,
        difficultyTrend: pw.difficultyTrend,
        phase: pw.phase,
        sidequestIds: pw.sidequestIds,
        resonanceScores: pw.resonanceScores,
      });
    }

    if (result.phaseTransition) {
      console.log(
        `[PathwayService] Phase transition for user ${userId}: ` +
        `"${pw.themeLabel}" ${result.phaseTransition.from} -> ${result.phaseTransition.to} ` +
        `(avgResonance=${pw.avgResonance.toFixed(3)}, questCount=${pw.questCount})`,
      );
    }

    return result;
  }

  async getPathways(userId: string): Promise<Pathway[]> {
    return this.dataSource.getRepository(Pathway).find({
      where: { userId },
      order: { updatedAt: "DESC" },
    });
  }

  async getUserPhaseContext(userId: string): Promise<PhaseContext> {
    const pathways = await this.getPathways(userId);

    const states: PathwayState[] = pathways.map((p) => ({
      id: p.id,
      theme: p.theme,
      themeLabel: p.themeLabel ?? themeLabel(p.theme),
      venueCategories: p.venueCategories,
      avgResonance: Number(p.avgResonance),
      questCount: p.questCount,
      currentDifficulty: p.currentDifficulty,
      difficultyTrend: Number(p.difficultyTrend),
      phase: p.phase,
      sidequestIds: p.sidequestIds,
      resonanceScores: p.resonanceScores ?? [],
    }));

    return buildPhaseContext(states);
  }
}

export function createPathwayService(deps: PathwayServiceDeps): PathwayService {
  return new PathwayServiceImpl(deps);
}
