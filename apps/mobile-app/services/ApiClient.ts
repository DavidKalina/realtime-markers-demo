// src/services/ApiClient.ts

import { BaseApiClient } from "./api/base/ApiClient";
import { AuthModule } from "./api/modules/auth";
import { SidequestsModule } from "./api/modules/sidequests";
import type { DeckStatsResponse } from "./api/modules/deckStats";
import type { ProfileInsightsResponse } from "./api/modules/profileInsights";
import type { CoverageSummaryResponse } from "./api/modules/coverage";
import type { PathwaysResponse } from "./api/modules/pathways";
import type { GrowthDashboardResponse } from "./api/modules/growthDashboard";
import type { DeviceInfo, PushToken } from "./api/modules/pushNotifications";

// Re-export types
export * from "./api/base/types";
export * from "./api/modules/auth";
export * from "./api/modules/pushNotifications";
export * from "./api/modules/sidequests";
export * from "./api/modules/deckStats";
export * from "./api/modules/profileInsights";
export * from "./api/modules/coverage";
export * from "./api/modules/pathways";
export {
  type GrowthDashboardResponse,
  type GrowthScoreData,
  type GrowthArcData,
  type SelfInsightData,
  type PathwayMomentumData,
  type BlindSpotData,
  type ExplorationCompassData,
  type CalibrationType,
  type ExplorationProfile,
  type GrowthHistoryPoint,
  type PathwayTrendPoint,
} from "./api/modules/growthDashboard";

class ApiClient extends BaseApiClient {
  private static instance: ApiClient | null = null;

  public readonly auth: AuthModule;
  public readonly sidequests: SidequestsModule;

  private constructor(baseUrl: string) {
    super(baseUrl);
    this.auth = new AuthModule(this);
    this.sidequests = new SidequestsModule(this);
  }

  public static getInstance(baseUrl?: string): ApiClient {
    if (!ApiClient.instance) {
      if (!baseUrl) {
        throw new Error(
          "Base URL must be provided when creating ApiClient instance",
        );
      }
      ApiClient.instance = new ApiClient(baseUrl);
    }
    return ApiClient.instance;
  }

  // ── Inlined from thin modules ─────────────────────────────────

  async sendLocation(lat: number, lng: number): Promise<void> {
    const url = `${this.baseUrl}/api/users/location`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lng, lat }),
    });
    if (!response.ok) {
      console.error("[LocationSender] API error:", response.status);
    }
  }

  async getDeckStats(): Promise<DeckStatsResponse> {
    const url = `${this.baseUrl}/api/sidequests/deck-stats`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<DeckStatsResponse>(response);
  }

  async getCoverageSummary(): Promise<CoverageSummaryResponse> {
    const url = `${this.baseUrl}/api/users/me/coverage`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<CoverageSummaryResponse>(response);
  }

  async getPathways(): Promise<PathwaysResponse> {
    const url = `${this.baseUrl}/api/users/me/pathways`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<PathwaysResponse>(response);
  }

  async getGrowthDashboard(): Promise<GrowthDashboardResponse> {
    const url = `${this.baseUrl}/api/users/me/growth-dashboard`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<GrowthDashboardResponse>(response);
  }

  async getProfileInsights(): Promise<ProfileInsightsResponse> {
    const url = `${this.baseUrl}/api/users/me/profile-insights`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<ProfileInsightsResponse>(response);
  }

  async registerPushToken(
    token: string,
    deviceInfo?: DeviceInfo,
  ): Promise<PushToken> {
    const url = `${this.baseUrl}/api/push-notifications/register`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ token, deviceInfo }),
    });
    const data = await this.handleResponse<{
      success: boolean;
      token: PushToken;
    }>(response);
    return data.token;
  }

  async unregisterPushToken(token: string): Promise<void> {
    const url = `${this.baseUrl}/api/push-notifications/unregister`;
    await this.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  }

  async getUserPushTokens(): Promise<PushToken[]> {
    const url = `${this.baseUrl}/api/push-notifications/tokens`;
    const response = await this.fetchWithAuth(url, { method: "GET" });
    const data = await this.handleResponse<{
      success: boolean;
      tokens: PushToken[];
    }>(response);
    return data.tokens;
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance(
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
);
