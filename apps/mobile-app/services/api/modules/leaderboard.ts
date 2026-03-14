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

export interface ContributorEntry {
  rank: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  currentTier: string;
  contribution: number;
  completionCount: number;
  label: string;
}

export interface ThirdSpaceScoreResponse {
  current: {
    city: string;
    score: number;
    activityScore: number;
    followThroughScore: number;
    varietyScore: number;
    satisfactionScore: number;
    communityScore: number;
    computedAt: string;
  };
  previous: { score: number; computedAt: string } | null;
  history: { score: number; computedAt: string }[];
  delta24h: number;
  momentum: "rising" | "steady" | "cooling";
  contributors: ContributorEntry[];
  centroid: { lat: number; lng: number } | null;
}

export interface ThirdSpaceSummary {
  city: string;
  score: number;
  momentum: "rising" | "steady" | "cooling";
  delta24h: number;
  adventureCount: number;
  centroid: { lat: number; lng: number };
  distanceMiles?: number;
  computedAt: string;
}

export interface ThirdSpacesResponse {
  topCities: ThirdSpaceSummary[];
  closestCities?: ThirdSpaceSummary[];
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

  async getThirdSpaceScore(city: string): Promise<ThirdSpaceScoreResponse> {
    const url = `${this.client.baseUrl}/api/leaderboard/third-space-score?city=${encodeURIComponent(city)}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<ThirdSpaceScoreResponse>(response);
  }

  async getThirdSpaces(
    lat?: number,
    lng?: number,
  ): Promise<ThirdSpacesResponse> {
    const params = new URLSearchParams();
    if (lat !== undefined) params.append("lat", lat.toString());
    if (lng !== undefined) params.append("lng", lng.toString());
    const qs = params.toString();
    const url = `${this.client.baseUrl}/api/leaderboard/third-spaces${qs ? `?${qs}` : ""}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<ThirdSpacesResponse>(response);
  }

  async getMyStats(): Promise<UserStats> {
    const url = `${this.client.baseUrl}/api/users/me/stats`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<UserStats>(response);
  }
}
