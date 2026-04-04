import { BaseApiModule } from "../base/BaseApiModule";
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

export class PathwaysModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getPathways(): Promise<PathwaysResponse> {
    const url = `${this.client.baseUrl}/api/users/me/pathways`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<PathwaysResponse>(response);
  }
}
