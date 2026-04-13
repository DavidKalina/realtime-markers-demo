import type { BaseApiClient } from "../base/ApiClient";

export interface PathwayData {
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

export class PathwaysModule {
  constructor(protected readonly client: BaseApiClient) {}

  async getPathways(): Promise<PathwaysResponse> {
    const url = `${this.client.baseUrl}/api/users/me/pathways`;
    const response = await this.client.fetchWithAuth(url);
    return this.client.handleResponse<PathwaysResponse>(response);
  }
}
