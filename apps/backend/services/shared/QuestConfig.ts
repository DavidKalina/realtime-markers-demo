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
      // Keys match onboarding GOAL_OPTIONS keys stored in comfortProfile.goalTags
      socialize: {
        rating: 0.30, journalDepth: 0.15, sentiment: 0.10,
        socialEscalation: 0.30, speedToCompletion: 0.05, difficultyAlignment: 0.10,
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
    idealDifficultyByPace: { gentle: 1.5, steady: 2.5, push_me: 4.0 },
  },

  phaseDetection: {
    resonanceThresholdForDFS: 0.55,
    minQuestsInCategoryForDFS: 3,
    bfsResonanceCeiling: 0.35,
    newPathwayMinResonance: 0.5,
  },
};
