// src/services/ApiClient.ts

import { BaseApiClient } from "./api/base/ApiClient";
import { AuthModule } from "./api/modules/auth";
import { PushNotificationsModule } from "./api/modules/pushNotifications";
import { SidequestsModule } from "./api/modules/sidequests";
import { DeckStatsModule } from "./api/modules/deckStats";
import { ProfileInsightsModule } from "./api/modules/profileInsights";
import { CoverageModule } from "./api/modules/coverage";
import { PathwaysModule } from "./api/modules/pathways";
import { GrowthDashboardModule } from "./api/modules/growthDashboard";
import { UsersModule } from "./api/modules/users";

// Re-export types and enums
export * from "./api/base/types";
export * from "./api/modules/auth";
export * from "./api/modules/pushNotifications";
export * from "./api/modules/sidequests";

export * from "./api/modules/deckStats";
export * from "./api/modules/profileInsights";
export * from "./api/modules/coverage";
export * from "./api/modules/pathways";
export {
  GrowthDashboardModule,
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
  public readonly pushNotifications: PushNotificationsModule;
  public readonly sidequests: SidequestsModule;
  public readonly deckStats: DeckStatsModule;
  public readonly profileInsights: ProfileInsightsModule;
  public readonly coverage: CoverageModule;
  public readonly pathways: PathwaysModule;
  public readonly growthDashboard: GrowthDashboardModule;
  public readonly users: UsersModule;

  private constructor(baseUrl: string) {
    super(baseUrl);
    this.auth = new AuthModule(this);
    this.pushNotifications = new PushNotificationsModule(this);
    this.sidequests = new SidequestsModule(this);
    this.deckStats = new DeckStatsModule(this);
    this.profileInsights = new ProfileInsightsModule(this);
    this.coverage = new CoverageModule(this);
    this.pathways = new PathwaysModule(this);
    this.growthDashboard = new GrowthDashboardModule(this);
    this.users = new UsersModule(this);
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
}

// Export singleton instance
export const apiClient = ApiClient.getInstance(
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
);
