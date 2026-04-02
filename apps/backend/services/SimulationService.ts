/**
 * In-memory simulation engine for testing BFS→DFS journey formation.
 * No database, no LLM, no network — pure computation with seeded PRNG.
 */

import { computeResonance, type ResonanceInput, type ResonanceResult } from "./ResonanceService";
import {
  detectPathway,
  buildPhaseContext,
  type PathwayState,
  type PhaseContext,
  type PathwayDetectionResult,
} from "./PathwayService";
import { type QuestConfig, DEFAULT_QUEST_CONFIG } from "./shared/QuestConfig";

// ── Types ────────────────────────────────────────────────────

export interface SimulationPersona {
  name: string;
  pace: "gentle" | "steady" | "push_me";
  goals: string[];
  barriers: string;
  categoryWeights: Record<string, number>;
  ratingBias: number;
  journalProbability: number;
  journalEmotionProbability: number;
  socialEscalationRate: number;
  difficultyTolerance: number;
  completionSpeedHours: number;
  homeLatitude: number;
  homeLongitude: number;
}

export interface SimulatedQuest {
  index: number;
  venueCategory: string;
  difficulty: number;
  rating: number;
  journalLength: number;
  socialContext: string;
  resonance: ResonanceResult;
  distanceFromHome: number;
  phase: string;
  pathwayTheme: string | null;
}

export interface SimulatedPathway {
  theme: string;
  themeLabel: string;
  phase: string;
  questCount: number;
  avgResonance: number;
  currentDifficulty: number;
  sidequestIds: string[];
}

export interface PhaseTransition {
  questIndex: number;
  theme: string;
  themeLabel: string;
  from: string;
  to: string;
}

export interface SimulationResult {
  persona: string;
  config: QuestConfig;
  quests: SimulatedQuest[];
  pathways: SimulatedPathway[];
  phaseTransitions: PhaseTransition[];
  finalPhaseContext: PhaseContext;
  stats: {
    avgResonance: number;
    peakResonance: number;
    totalPathways: number;
    dfsPathways: number;
    questsBeforeFirstDFS: number | null;
    difficultyProgression: number[];
    categoryDistribution: Record<string, number>;
  };
}

export interface SimulationParams {
  config?: Partial<QuestConfig>;
  persona: SimulationPersona;
  questCount: number;
  seed?: number;
  /** Simulate LLM reflection analysis (depth, sentiment, tags) */
  simulateReflection?: boolean;
}

// ── Seeded PRNG (mulberry32) ─────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Social context ladder ────────────────────────────────────

const SOCIAL_LADDER = ["solo", "with_someone", "met_someone_new", "group_activity"];

// ── Emotion journal templates ────────────────────────────────

const EMOTION_JOURNALS = [
  "I felt really comfortable here. The vibe was exactly what I needed today.",
  "I was nervous at first but I ended up having a great time. I talked to someone at the counter.",
  "I loved this place. I noticed how calm I felt just being there.",
  "I tried something new and I was surprised by how much I enjoyed it.",
  "I met someone who recommended another spot nearby. I felt energized after.",
  "I realized I've been avoiding places like this. It was easier than I expected.",
  "I went with a friend and we had a blast. I felt connected.",
  "I was anxious walking in but I pushed through. I'm proud of myself.",
];

const NEUTRAL_JOURNALS = [
  "Nice spot. Decent coffee.",
  "It was fine.",
  "Pretty standard experience.",
  "Went and came back.",
];

// ── Simulation engine ────────────────────────────────────────

export interface SimulationService {
  runSimulation(params: SimulationParams): SimulationResult;
}

interface SimulationServiceDeps {
  config?: QuestConfig;
}

class SimulationServiceImpl implements SimulationService {
  private defaultConfig: QuestConfig;

  constructor(deps: SimulationServiceDeps) {
    this.defaultConfig = deps.config ?? DEFAULT_QUEST_CONFIG;
  }

  runSimulation(params: SimulationParams): SimulationResult {
    const config = mergeConfig(this.defaultConfig, params.config);
    const persona = params.persona;
    const rand = mulberry32(params.seed ?? 42);

    // State
    let comfortRadius = config.comfortZone.defaultComfortRadiusMiles;
    const pathways: PathwayState[] = [];
    const quests: SimulatedQuest[] = [];
    const phaseTransitions: PhaseTransition[] = [];
    const previousSocialContexts: string[] = [];
    let currentSocialLevel = 0;

    for (let i = 0; i < params.questCount; i++) {
      // 1. Determine category based on phase
      const phaseCtx = buildPhaseContext(pathways);
      const dfsPathways = pathways.filter((p) => p.phase === "dfs");

      let venueCategory: string;
      if (dfsPathways.length > 0 && rand() < 0.6) {
        // 60% chance to deepen an active DFS pathway
        const chosen = dfsPathways[Math.floor(rand() * dfsPathways.length)];
        venueCategory = chosen.theme;
      } else {
        venueCategory = weightedPick(persona.categoryWeights, rand);
      }

      // 2. Determine difficulty
      const existingPathway = pathways.find(
        (p) => p.venueCategories.includes(venueCategory) || p.theme === venueCategory,
      );
      let difficulty: number;
      if (existingPathway && existingPathway.phase === "dfs") {
        // DFS: escalate gradually — 30% chance to step up, 10% to step down, else hold
        const r = rand();
        const step = r < 0.3 ? 1 : r < 0.4 ? -1 : 0;
        // Cap at tolerance + 1 (DFS can push slightly past comfort, but not to the moon)
        const dfsCeiling = Math.min(5, persona.difficultyTolerance + 1);
        difficulty = Math.max(1, Math.min(dfsCeiling, existingPathway.currentDifficulty + step));
      } else {
        // BFS: random low difficulty
        difficulty = Math.min(persona.difficultyTolerance, Math.ceil(rand() * 3));
      }

      // 3. Distance from home
      const distanceFromHome = comfortRadius * (0.3 + rand() * 0.9);

      // 4. Synthetic completion data
      const rating = generateRating(persona.ratingBias, rand, existingPathway?.phase === "dfs");
      const socialContext = generateSocialContext(
        currentSocialLevel,
        persona.socialEscalationRate,
        rand,
      );
      const journalEntry = generateJournal(
        persona.journalProbability,
        persona.journalEmotionProbability,
        rand,
      );
      const hoursToComplete = persona.completionSpeedHours * (0.5 + rand());

      const questCreatedAt = new Date(2025, 0, 1 + i * 3); // space quests 3 days apart
      const checkedInAt = new Date(questCreatedAt.getTime() + hoursToComplete * 3600 * 1000);

      // 5. Synthetic reflection analysis (if enabled)
      const isDFS = existingPathway?.phase === "dfs";
      const reflection = params.simulateReflection
        ? generateReflection(journalEntry, rating, socialContext, difficulty, persona.difficultyTolerance, isDFS ?? false, rand)
        : null;

      // 6. Compute resonance
      const resonanceInput: ResonanceInput = {
        rating,
        journalEntry,
        socialContext,
        completedActivity: `Did something at the ${venueCategory}`,
        difficulty,
        checkedInAt,
        questCreatedAt,
        venueCategory,
        distanceFromHome,
        userPace: persona.pace,
        previousSocialContexts: [...previousSocialContexts],
        goalTags: persona.goals,
        reflectionDepth: reflection?.depth ?? null,
        reflectionSentiment: reflection?.sentiment ?? null,
        reflectionTags: reflection?.tags ?? null,
      };

      const resonance = computeResonance(resonanceInput, config);

      // 7. Pathway detection
      const sidequestId = `sim-${i}`;
      const pathwayResult = detectPathway(
        pathways,
        sidequestId,
        venueCategory,
        difficulty,
        resonance,
        config.phaseDetection,
      );

      if (pathwayResult) {
        if (pathwayResult.isNew) {
          pathways.push(pathwayResult.pathway);
        } else {
          const idx = pathways.findIndex((p) => p.id === pathwayResult.pathway.id);
          if (idx >= 0) pathways[idx] = pathwayResult.pathway;
        }

        if (pathwayResult.phaseTransition) {
          phaseTransitions.push({
            questIndex: i,
            theme: pathwayResult.pathway.theme,
            themeLabel: pathwayResult.pathway.themeLabel,
            from: pathwayResult.phaseTransition.from,
            to: pathwayResult.phaseTransition.to,
          });
        }
      }

      // 8. Update state
      if (socialContext) {
        previousSocialContexts.push(socialContext);
        const idx = SOCIAL_LADDER.indexOf(socialContext);
        if (idx > currentSocialLevel) currentSocialLevel = idx;
      }

      const paceMultiplier = config.comfortZone.paceMultipliers[persona.pace] ?? 1.0;
      comfortRadius = Math.min(
        config.comfortZone.maxRadiusMiles,
        comfortRadius + config.comfortZone.baseExpansionMiles * paceMultiplier,
      );

      quests.push({
        index: i,
        venueCategory,
        difficulty,
        rating,
        journalLength: journalEntry?.length ?? 0,
        socialContext,
        resonance,
        distanceFromHome,
        phase: pathwayResult?.pathway.phase ?? "bfs",
        pathwayTheme: pathwayResult?.pathway.theme ?? null,
      });
    }

    // Compute stats
    const allScores = quests.map((q) => q.resonance.score);
    const categoryDist: Record<string, number> = {};
    for (const q of quests) {
      categoryDist[q.venueCategory] = (categoryDist[q.venueCategory] ?? 0) + 1;
    }

    const firstDFS = phaseTransitions.find((t) => t.to === "dfs");

    return {
      persona: persona.name,
      config,
      quests,
      pathways: pathways.map((p) => ({
        theme: p.theme,
        themeLabel: p.themeLabel,
        phase: p.phase,
        questCount: p.questCount,
        avgResonance: p.avgResonance,
        currentDifficulty: p.currentDifficulty,
        sidequestIds: p.sidequestIds,
      })),
      phaseTransitions,
      finalPhaseContext: buildPhaseContext(pathways),
      stats: {
        avgResonance: allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0,
        peakResonance: allScores.length > 0 ? Math.max(...allScores) : 0,
        totalPathways: pathways.length,
        dfsPathways: pathways.filter((p) => p.phase === "dfs").length,
        questsBeforeFirstDFS: firstDFS?.questIndex ?? null,
        difficultyProgression: quests.map((q) => q.difficulty),
        categoryDistribution: categoryDist,
      },
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────

function weightedPick(weights: Record<string, number>, rand: () => number): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function generateRating(bias: number, rand: () => number, isDFS: boolean): number {
  // DFS quests tend to get higher ratings (they're in the user's groove)
  const boost = isDFS ? 0.15 : 0;
  const base = bias + boost + (rand() - 0.5) * 0.4;
  const normalized = Math.max(0, Math.min(1, base));
  return Math.max(1, Math.min(5, Math.round(normalized * 4 + 1)));
}

function generateSocialContext(
  currentLevel: number,
  escalationRate: number,
  rand: () => number,
): string {
  if (rand() < escalationRate && currentLevel < SOCIAL_LADDER.length - 1) {
    return SOCIAL_LADDER[currentLevel + 1];
  }
  // Sometimes regress, mostly stay same
  if (rand() < 0.2 && currentLevel > 0) {
    return SOCIAL_LADDER[currentLevel - 1];
  }
  return SOCIAL_LADDER[currentLevel];
}

function generateJournal(
  journalProbability: number,
  emotionProbability: number,
  rand: () => number,
): string | null {
  if (rand() > journalProbability) return null;

  if (rand() < emotionProbability) {
    return EMOTION_JOURNALS[Math.floor(rand() * EMOTION_JOURNALS.length)];
  }
  return NEUTRAL_JOURNALS[Math.floor(rand() * NEUTRAL_JOURNALS.length)];
}

// ── Synthetic reflection analysis ────────────────────────────

interface SyntheticReflection {
  depth: number;
  sentiment: number;
  tags: string[];
}

const REFLECTION_TAGS = [
  "growth_narrative",
  "self_awareness",
  "social_connection",
  "discomfort_processed",
  "surface_level",
] as const;

function generateReflection(
  journal: string | null,
  rating: number,
  socialContext: string,
  difficulty: number,
  difficultyTolerance: number,
  isDFS: boolean,
  rand: () => number,
): SyntheticReflection | null {
  // No journal = no reflection analysis
  if (!journal) return null;

  const isEmotionalJournal = journal.length > 30; // emotion journals are longer

  // Depth: emotional journals get higher depth, surface ones stay low
  let depth: number;
  if (isEmotionalJournal) {
    depth = 0.5 + rand() * 0.45; // 0.5–0.95
  } else {
    depth = 0.05 + rand() * 0.25; // 0.05–0.30
  }

  // Sentiment: correlates with rating but adds noise
  // High rating + DFS = likely positive (they're in their groove)
  // Low rating + high difficulty = likely negative
  const ratingNorm = (rating - 1) / 4; // 0–1
  const difficultyStress = Math.max(0, (difficulty - difficultyTolerance) / 3);
  let sentiment = (ratingNorm - 0.5) * 1.6 - difficultyStress * 0.4 + (rand() - 0.5) * 0.3;
  if (isDFS) sentiment += 0.15; // DFS boost — they chose to be here
  sentiment = Math.max(-1, Math.min(1, sentiment));

  // Tags: derived from the combination of signals
  const tags: string[] = [];

  if (!isEmotionalJournal) {
    tags.push("surface_level");
    return { depth, sentiment, tags };
  }

  // Growth narrative: high depth + positive-ish sentiment + DFS or social escalation
  if (depth >= 0.6 && sentiment > 0 && (isDFS || socialContext === "met_someone_new") && rand() < 0.5) {
    tags.push("growth_narrative");
  }

  // Self-awareness: high depth, any sentiment
  if (depth >= 0.55 && rand() < 0.4) {
    tags.push("self_awareness");
  }

  // Social connection: social context beyond solo + emotional journal
  if (socialContext !== "solo" && rand() < 0.45) {
    tags.push("social_connection");
  }

  // Discomfort processed: difficulty exceeds tolerance but sentiment isn't tanked
  // "I was nervous but I pushed through" — the golden signal
  if (difficulty >= difficultyTolerance && sentiment > -0.3 && rand() < 0.35) {
    tags.push("discomfort_processed");
  }

  // If nothing tagged and depth is moderate, might still be surface-level
  if (tags.length === 0 && depth < 0.5) {
    tags.push("surface_level");
  }

  return { depth, sentiment, tags };
}

function mergeConfig(base: QuestConfig, overrides?: Partial<QuestConfig>): QuestConfig {
  if (!overrides) return base;
  return {
    comfortZone: { ...base.comfortZone, ...overrides.comfortZone },
    coverage: { ...base.coverage, ...overrides.coverage },
    rarity: { ...base.rarity, ...overrides.rarity },
    resonance: {
      ...base.resonance,
      ...overrides.resonance,
      weights: { ...base.resonance.weights, ...overrides.resonance?.weights },
      idealDifficultyByPace: { ...base.resonance.idealDifficultyByPace, ...overrides.resonance?.idealDifficultyByPace },
    },
    phaseDetection: { ...base.phaseDetection, ...overrides.phaseDetection },
  };
}

// ── Factory ──────────────────────────────────────────────────

export function createSimulationService(deps: SimulationServiceDeps = {}): SimulationService {
  return new SimulationServiceImpl(deps);
}
