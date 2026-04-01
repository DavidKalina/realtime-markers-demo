// src/services/ApiClient.ts

import { BaseApiClient } from "./api/base/ApiClient";
import { AuthModule } from "./api/modules/auth";
import { PushNotificationsModule } from "./api/modules/pushNotifications";
import { SidequestsModule } from "./api/modules/sidequests";
import { DeckStatsModule } from "./api/modules/deckStats";
import { ProfileInsightsModule } from "./api/modules/profileInsights";
import { CoverageModule } from "./api/modules/coverage";

// Re-export types and enums
export * from "./api/base/types";
export * from "./api/modules/auth";
export * from "./api/modules/pushNotifications";
export * from "./api/modules/sidequests";

export * from "./api/modules/deckStats";
export * from "./api/modules/profileInsights";
export * from "./api/modules/coverage";

class ApiClient extends BaseApiClient {
  private static instance: ApiClient | null = null;
  private _auth: AuthModule | null = null;
  private _pushNotifications: PushNotificationsModule | null = null;
  private _sidequests: SidequestsModule | null = null;

  private _deckStats: DeckStatsModule | null = null;
  private _profileInsights: ProfileInsightsModule | null = null;
  private _coverage: CoverageModule | null = null;

  private constructor(baseUrl: string) {
    super(baseUrl);
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

  public get auth(): AuthModule {
    if (!this._auth) {
      this._auth = new AuthModule(this);
    }
    return this._auth;
  }

  public get pushNotifications(): PushNotificationsModule {
    if (!this._pushNotifications) {
      this._pushNotifications = new PushNotificationsModule(this);
    }
    return this._pushNotifications;
  }

  public get sidequests(): SidequestsModule {
    if (!this._sidequests) {
      this._sidequests = new SidequestsModule(this);
    }
    return this._sidequests;
  }

  public get deckStats(): DeckStatsModule {
    if (!this._deckStats) {
      this._deckStats = new DeckStatsModule(this);
    }
    return this._deckStats;
  }

  public get profileInsights(): ProfileInsightsModule {
    if (!this._profileInsights) {
      this._profileInsights = new ProfileInsightsModule(this);
    }
    return this._profileInsights;
  }

  public get coverage(): CoverageModule {
    if (!this._coverage) {
      this._coverage = new CoverageModule(this);
    }
    return this._coverage;
  }

  override setBaseUrl(baseUrl: string): void {
    super.setBaseUrl(baseUrl);
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance(
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
);
