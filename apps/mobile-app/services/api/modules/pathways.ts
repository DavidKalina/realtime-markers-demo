// Types-only module — methods moved to ApiClient

export interface PathwayData {
  id?: string;
  theme: string;
  themeLabel: string;
  phase: "bfs" | "dfs";
  avgResonance: number;
  questCount: number;
  currentDifficulty: number;
  difficultyTrend: number;
}

export interface PathwaysResponse {
  globalPhase: "bfs" | "mixed" | "dfs";
  pathways: PathwayData[];
  recommendation: string;
}
