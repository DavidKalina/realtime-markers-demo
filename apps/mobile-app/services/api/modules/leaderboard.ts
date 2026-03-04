import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  currentTier: string;
  scanCount: number;
}

export interface UserStats {
  categoryBreakdown: { name: string; icon: string | null; count: number }[];
  cityBreakdown: { city: string; count: number }[];
  globalRank: number;
  totalUsers: number;
}

export class LeaderboardModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getCityLeaderboard(city: string): Promise<LeaderboardEntry[]> {
    const url = `${this.client.baseUrl}/api/leaderboard?city=${encodeURIComponent(city)}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<LeaderboardEntry[]>(response);
  }

  async getMyRank(
    city: string,
  ): Promise<{ rank: number; scanCount: number } | null> {
    const url = `${this.client.baseUrl}/api/leaderboard/my-rank?city=${encodeURIComponent(city)}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ rank: number; scanCount: number } | null>(
      response,
    );
  }

  async getMyStats(): Promise<UserStats> {
    const url = `${this.client.baseUrl}/api/users/me/stats`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<UserStats>(response);
  }
}
