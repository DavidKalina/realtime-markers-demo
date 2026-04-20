/**
 * Centralized, parameterized configuration for the quest system.
 * Every tunable constant lives here so simulations can override defaults.
 */

// ── Comfort Zone ──────────────────────────────────────────────
export interface ComfortZoneConfig {
  defaultComfortRadiusMiles: number;
  minRadiusMiles: number;
  maxRadiusMiles: number;
  baseExpansionMiles: number;
  paceMultipliers: Record<string, number>;
}

// ── Coverage / Exploration ────────────────────────────────────
export interface CoverageConfig {
  shadeDecayRate: number;
  snapshotTtlMs: number;
  minClustersForVoronoi: number;
  gapThresholdDeg: number;
  bufferMeters: number;
  breadthWeights: { clusterBreadth: number; directionalCoverage: number };
  depthWeights: { avgDensity: number; multiVisitRatio: number };
  profileThresholds: {
    earlyExplorerCeiling: number;
    depthFocusedFloor: number;
    breadthFocusedFloor: number;
  };
}

// ── Rarity ────────────────────────────────────────────────────
export interface RarityConfig {
  legendary: { distanceRatio: number; requireNewCategory: boolean };
  epic: { distanceRatio: number; altDistanceRatio: number; altRequireNewCategory: boolean };
  rare: { distanceRatio: number; altNewCategory: boolean };
  uncommon: { distanceRatio: number };
}

// ── Resonance ─────────────────────────────────────────────────
export interface ResonanceWeights {
  rating: number;
  journalDepth: number;
  sentiment: number;
  socialEscalation: number;
  speedToCompletion: number;
  difficultyAlignment: number;
}

export interface ResonanceConfig {
  weights: ResonanceWeights;
  goalWeights: Record<string, ResonanceWeights>;
  journalMaxChars: number;
  speedMaxHours: number;
  idealDifficultyByPace: Record<string, number>;
}

// ── Phase Detection ───────────────────────────────────────────
export interface PhaseDetectionConfig {
  resonanceThresholdForDFS: number;
  minQuestsInCategoryForDFS: number;
  bfsResonanceCeiling: number;
  newPathwayMinResonance: number;
}

// ── Top-level ─────────────────────────────────────────────────
export interface QuestConfig {
  comfortZone: ComfortZoneConfig;
  coverage: CoverageConfig;
  rarity: RarityConfig;
  resonance: ResonanceConfig;
  phaseDetection: PhaseDetectionConfig;
}

// ── Product Doctrine ───────────────────────────────────────────────

/**
 * The app is intentionally NOT a generic goal-setting system.
 * Goals are interpreted through this product domain: real-world exposure,
 * social confidence, offline belonging, dating readiness, third places, and
 * anti-doomscroll identity expansion.
 */
export const OFFLINE_SOCIAL_DOMAIN_DOCTRINE = [
  "This app only promises offline social expansion: leaving home, building public comfort, meeting people, dating readiness, friendship, third places, hobbies/community, and anti-doomscroll real-world reps.",
  "Do not behave like a specialist fitness, finance, productivity, therapy, education, or habit-tracking app.",
  "When a user names a broad goal, translate only the part that belongs in this domain into a real-world exposure rep.",
  "Fitness, dance, art, learning, food, music, games, volunteering, and local events are activity containers, not standalone product verticals.",
  "A venue is just the stage. The prescription is the capacity rep the user practices there.",
] as const;

const CORE_DOMAIN_TAGS = new Set([
  "socialize",
  "dating",
  "explore",
  "routine",
  "unwind",
  "friendship",
  "homebody_recovery",
  "public_comfort",
  "third_place",
  "community",
]);

const ACTIVITY_CONTAINER_TAGS = new Set([
  "fitness",
  "dance",
  "new_skill",
  "discover_hobby",
  "art",
  "music",
  "food",
  "games",
  "volunteering",
  "independence",
]);

const OUT_OF_SCOPE_PATTERNS: [RegExp, string][] = [
  [/finance|budget|bank|invest|debt|money|retire/i, "finance or money management"],
  [/macro|nutrition|calorie|meal plan|protein|progressive overload|rep counter|workout plan/i, "fitness optimization"],
  [/career|job search|resume|promotion|productivity|deep work/i, "career or productivity optimization"],
  [/language learning|curriculum|coursework|study plan/i, "education curriculum"],
];

export interface OfflineSocialGoalFrame {
  coreTags: string[];
  containerTags: string[];
  outOfScopeSignals: string[];
}

export function classifyOfflineSocialGoal(goalTags: string[] = [], goalText = ""): OfflineSocialGoalFrame {
  const coreTags = goalTags.filter((tag) => CORE_DOMAIN_TAGS.has(tag));
  const containerTags = goalTags.filter((tag) => ACTIVITY_CONTAINER_TAGS.has(tag));
  const outOfScopeSignals = OUT_OF_SCOPE_PATTERNS
    .filter(([pattern]) => pattern.test(goalText))
    .map(([, label]) => label);

  return {
    coreTags: [...new Set(coreTags)],
    containerTags: [...new Set(containerTags)],
    outOfScopeSignals: [...new Set(outOfScopeSignals)],
  };
}

export function buildOfflineSocialDomainBlock(
  comfortProfile: { primaryGoal?: string; goals?: string; goalTags?: string[] } | null | undefined,
  goalTags: string[] = [],
): string {
  const goalText = [
    comfortProfile?.primaryGoal,
    comfortProfile?.goals,
    ...(comfortProfile?.goalTags ?? []),
    ...goalTags,
  ].filter(Boolean).join(" ");
  const frame = classifyOfflineSocialGoal(goalTags.length ? goalTags : comfortProfile?.goalTags ?? [], goalText);
  const core = frame.coreTags.length ? frame.coreTags.join(", ") : "offline social expansion";
  const containers = frame.containerTags.length ? frame.containerTags.join(", ") : "none explicit yet";
  const scopeWarning = frame.outOfScopeSignals.length
    ? `\n- Scope warning: goal text includes ${frame.outOfScopeSignals.join(", ")}. Do NOT solve that as a specialist product. Reinterpret only the offline/social/exposure part.`
    : "";

  return `\nPRODUCT DOCTRINE — OFFLINE SOCIAL EXPANSION:
${OFFLINE_SOCIAL_DOMAIN_DOCTRINE.map((line) => `- ${line}`).join("\n")}
- Current core domain tags: ${core}
- Activity containers/interests: ${containers}${scopeWarning}
`;
}

export const DEFAULT_QUEST_CONFIG: QuestConfig = {
  comfortZone: {
    defaultComfortRadiusMiles: 2.0,
    minRadiusMiles: 0.5,
    maxRadiusMiles: 100,
    baseExpansionMiles: 0.3,
    paceMultipliers: { gentle: 0.5, steady: 1.0, push_me: 1.8 },
  },

  coverage: {
    shadeDecayRate: 0.5,
    snapshotTtlMs: 5 * 60 * 1000,
    minClustersForVoronoi: 3,
    gapThresholdDeg: 45,
    bufferMeters: 500,
    breadthWeights: { clusterBreadth: 0.6, directionalCoverage: 0.4 },
    depthWeights: { avgDensity: 0.6, multiVisitRatio: 0.4 },
    profileThresholds: {
      earlyExplorerCeiling: 0.3,
      depthFocusedFloor: 0.4,
      breadthFocusedFloor: 0.4,
    },
  },

  rarity: {
    legendary: { distanceRatio: 1.5, requireNewCategory: true },
    epic: { distanceRatio: 1.3, altDistanceRatio: 1.0, altRequireNewCategory: true },
    rare: { distanceRatio: 1.0, altNewCategory: true },
    uncommon: { distanceRatio: 0.7 },
  },

  resonance: {
    weights: {
      rating: 0.30,
      journalDepth: 0.20,
      sentiment: 0.15,
      socialEscalation: 0.15,
      speedToCompletion: 0.10,
      difficultyAlignment: 0.10,
    },
    goalWeights: {
      // Keys are resonance weight tags (socialize, explore, etc.)
      // Onboarding goal keys (build_friends, start_dating, etc.) are mapped
      // to these tags via goalKeyToTags() in Onboarding/constants.ts
      socialize: {
        rating: 0.30, journalDepth: 0.15, sentiment: 0.10,
        socialEscalation: 0.30, speedToCompletion: 0.05, difficultyAlignment: 0.10,
      },
      dating: {
        rating: 0.25, journalDepth: 0.15, sentiment: 0.10,
        socialEscalation: 0.35, speedToCompletion: 0.05, difficultyAlignment: 0.10,
      },
      friendship: {
        rating: 0.25, journalDepth: 0.15, sentiment: 0.10,
        socialEscalation: 0.35, speedToCompletion: 0.05, difficultyAlignment: 0.10,
      },
      community: {
        rating: 0.25, journalDepth: 0.15, sentiment: 0.10,
        socialEscalation: 0.30, speedToCompletion: 0.10, difficultyAlignment: 0.10,
      },
      homebody_recovery: {
        rating: 0.30, journalDepth: 0.20, sentiment: 0.20,
        socialEscalation: 0.10, speedToCompletion: 0.10, difficultyAlignment: 0.10,
      },
      public_comfort: {
        rating: 0.30, journalDepth: 0.20, sentiment: 0.15,
        socialEscalation: 0.15, speedToCompletion: 0.10, difficultyAlignment: 0.10,
      },
      third_place: {
        rating: 0.30, journalDepth: 0.15, sentiment: 0.15,
        socialEscalation: 0.20, speedToCompletion: 0.10, difficultyAlignment: 0.10,
      },
      explore: {
        rating: 0.30, journalDepth: 0.10, sentiment: 0.15,
        socialEscalation: 0.10, speedToCompletion: 0.20, difficultyAlignment: 0.15,
      },
      fitness: {
        rating: 0.30, journalDepth: 0.10, sentiment: 0.15,
        socialEscalation: 0.15, speedToCompletion: 0.15, difficultyAlignment: 0.15,
      },
      routine: {
        rating: 0.30, journalDepth: 0.15, sentiment: 0.15,
        socialEscalation: 0.15, speedToCompletion: 0.15, difficultyAlignment: 0.10,
      },
      new_skill: {
        rating: 0.30, journalDepth: 0.20, sentiment: 0.15,
        socialEscalation: 0.15, speedToCompletion: 0.05, difficultyAlignment: 0.15,
      },
      discover_hobby: {
        rating: 0.25, journalDepth: 0.25, sentiment: 0.20,
        socialEscalation: 0.10, speedToCompletion: 0.05, difficultyAlignment: 0.15,
      },
      unwind: {
        rating: 0.30, journalDepth: 0.25, sentiment: 0.20,
        socialEscalation: 0.05, speedToCompletion: 0.05, difficultyAlignment: 0.15,
      },
    },
    journalMaxChars: 500,
    speedMaxHours: 168,
    idealDifficultyByPace: { gentle: 3, steady: 5, push_me: 7 },
  },

  phaseDetection: {
    resonanceThresholdForDFS: 0.45,
    minQuestsInCategoryForDFS: 3,
    bfsResonanceCeiling: 0.35,
    newPathwayMinResonance: 0.4,
  },
};

// ── Goal tag inference (backward compat for users without goalKey) ──

const GOAL_KEY_TO_TAGS: Record<string, string[]> = {
  build_friends: ["socialize", "friendship", "community"],
  start_dating: ["socialize", "dating"],
  stop_homebody: ["explore", "routine", "homebody_recovery", "public_comfort"],
  find_people: ["socialize", "community", "third_place", "explore"],
  from_scratch: ["socialize", "routine", "third_place"],
};

const PRIMARY_GOAL_TO_TAGS: [RegExp, string[]][] = [
  [/friend/i, ["socialize", "friendship", "community"]],
  [/dating|date/i, ["socialize", "dating"]],
  [/social anx|public|crowd|visible/i, ["socialize", "public_comfort"]],
  [/homebody|get out|leave the house|doomscroll|scrolling/i, ["explore", "routine", "homebody_recovery", "public_comfort"]],
  [/find.*people|my people|belong|community/i, ["socialize", "community", "third_place", "explore"]],
  [/hobby|class|workshop|club|skill/i, ["socialize", "discover_hobby", "community"]],
  [/fitness|run|gym|yoga|dance|active|exercise/i, ["socialize", "fitness", "public_comfort"]],
  [/social life|from scratch|lonely|isolated/i, ["socialize", "routine", "third_place"]],
];

/**
 * Resolve goalTags from comfortProfile, falling back to inference from
 * goalKey or primaryGoal text for users who onboarded before goalKey was saved.
 */
export function resolveGoalTags(
  comfortProfile: { goalKey?: string; goalTags?: string[]; primaryGoal?: string } | null | undefined,
): string[] {
  const inferred: string[] = [];
  if (comfortProfile?.goalKey && GOAL_KEY_TO_TAGS[comfortProfile.goalKey]) {
    inferred.push(...GOAL_KEY_TO_TAGS[comfortProfile.goalKey]);
  }
  if (comfortProfile?.primaryGoal) {
    for (const [pattern, tags] of PRIMARY_GOAL_TO_TAGS) {
      if (pattern.test(comfortProfile.primaryGoal)) inferred.push(...tags);
    }
  }
  if (comfortProfile?.goalTags && comfortProfile.goalTags.length > 0) {
    return [...new Set([...comfortProfile.goalTags, ...inferred])];
  }
  return [...new Set(inferred)];
}
