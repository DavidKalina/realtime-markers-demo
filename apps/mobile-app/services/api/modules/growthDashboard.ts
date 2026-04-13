import type { BaseApiClient } from "../base/ApiClient";

// ── Response types ─────────────────────────────────────────────

export interface GrowthHistoryPoint {
  score: number;
  date: string;
}

export interface GrowthScoreData {
  score: number;
  momentum: "rising" | "steady" | "cooling";
  delta7d: number;
  history: GrowthHistoryPoint[];
  subScores: {
    resonance: number;
    consistency: number;
    expansion: number;
    depth: number;
  };
}

export interface GrowthArcData {
  phase: number;
  phaseReason: string;
  completedQuests: number;
  avgRating: number;
  avgResonance: number;
  recentResonance: number;
  hasGrowthSignals: boolean;
}

export type CalibrationType =
  | "strong_overestimator"
  | "mild_overestimator"
  | "well_calibrated"
  | "underestimator";

export interface SelfInsightData {
  avgAnxietyDelta: number;
  avgDifficultyDelta: number;
  totalViolations: number;
  calibrationType: CalibrationType;
  questsWithPredictions: number;
}

export interface PathwayTrendPoint {
  resonance: number;
  difficulty: number;
}

export interface PathwayMomentumData {
  theme: string;
  themeLabel: string;
  phase: "bfs" | "dfs";
  avgResonance: number;
  questCount: number;
  currentDifficulty: number;
  difficultyTrend: number;
  trendHistory: PathwayTrendPoint[];
}

export interface BlindSpotData {
  pattern: string;
  occurrences: number;
  reframe: string;
  activelyManaged: boolean;
}

export interface DirectionalGap {
  direction: string;
  angleDeg: number;
  gapWidthDeg: number;
}

export type ExplorationProfile =
  | "early_explorer"
  | "depth_focused"
  | "breadth_focused"
  | "well_rounded";

export interface ExplorationCompassData {
  gaps: DirectionalGap[];
  explorationProfile: ExplorationProfile;
  coveragePct: number;
  territorySqMiles: number;
  clusterCount: number;
}

export interface GrowthDashboardResponse {
  growthScore: GrowthScoreData;
  growthArc: GrowthArcData;
  selfInsight: SelfInsightData | null;
  pathwayMomentum: PathwayMomentumData[];
  blindSpots: BlindSpotData[];
  explorationCompass: ExplorationCompassData | null;
}

// ── Module ─────────────────────────────────────────────────────

export class GrowthDashboardModule {
  constructor(protected readonly client: BaseApiClient) {}

  async getDashboard(): Promise<GrowthDashboardResponse> {
    const url = `${this.client.baseUrl}/api/users/me/growth-dashboard`;
    const response = await this.client.fetchWithAuth(url);
    return this.client.handleResponse<GrowthDashboardResponse>(response);
  }
}
