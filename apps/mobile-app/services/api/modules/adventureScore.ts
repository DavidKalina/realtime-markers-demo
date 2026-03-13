import { BaseApiModule } from "../base/BaseApiModule";
import type { BaseApiClient } from "../base/ApiClient";

export interface AdventureScoreResponse {
  score: number;
  activityScore: number;
  consistencyScore: number;
  diversityScore: number;
  completionScore: number;
  discoveryScore: number;
  computedAt: string;
}

export class AdventureScoreModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getMyScore(): Promise<AdventureScoreResponse> {
    const url = `${this.client.baseUrl}/api/users/me/adventure-score`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<AdventureScoreResponse>(response);
  }
}
