import { BaseApiModule } from "../base/BaseApiModule";
import type { BaseApiClient } from "../base/ApiClient";

export interface ActivityDay {
  date: string;
  count: number;
}

export interface VenueCategory {
  category: string;
  count: number;
  pct: number;
}

export interface WeekActivity {
  weekStart: string;
  count: number;
}

export interface CityFootprint {
  city: string;
  completedCount: number;
  checkinCount: number;
  uniqueVenues: number;
}

export interface ProfileInsightsResponse {
  activityHeatmap: ActivityDay[];
  venueDna: VenueCategory[];
  streakCalendar: WeekActivity[];
  footprint: {
    totalDistanceMiles: number;
    totalCheckins: number;
    totalCompletedItineraries: number;
    totalUniqueVenues: number;
    totalStopsVisited: number;
    avgStopsPerItinerary: number;
    cities: CityFootprint[];
  };
}

export class ProfileInsightsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getInsights(): Promise<ProfileInsightsResponse> {
    const url = `${this.client.baseUrl}/api/users/me/profile-insights`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<ProfileInsightsResponse>(response);
  }
}
