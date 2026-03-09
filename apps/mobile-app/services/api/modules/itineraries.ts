import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export interface ItineraryItemResponse {
  id: string;
  sortOrder: number;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  emoji?: string;
  estimatedCost?: number;
  venueName?: string;
  venueAddress?: string;
  eventId?: string;
  travelNote?: string;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  googleRating?: number;
  venueCategory?: string;
  whyThisStop?: string;
  proTip?: string;
  checkedInAt?: string;
}

export interface HourlyForecast {
  hour: number;
  tempF: number;
  feelsLikeF: number;
  precipProbability: number;
  precipMm: number;
  windSpeedMph: number;
  windGustsMph: number;
  uvIndex: number;
  weatherCode: number;
  condition: string;
}

export interface DayForecast {
  date: string;
  sunrise: string;
  sunset: string;
  tempHighF: number;
  tempLowF: number;
  precipProbabilityMax: number;
  uvIndexMax: number;
  dominantCondition: string;
  hourly: HourlyForecast[];
}

export interface ItineraryResponse {
  id: string;
  city: string;
  plannedDate: string;
  budgetMin: number;
  budgetMax: number;
  durationHours: number;
  activityTypes: string[];
  title?: string;
  summary?: string;
  status: "GENERATING" | "READY" | "FAILED";
  items: ItineraryItemResponse[];
  forecast?: DayForecast;
  createdAt: string;
}

export interface CreateItineraryParams {
  city: string;
  plannedDate: string;
  budgetMin?: number;
  budgetMax?: number;
  durationHours: number;
  activityTypes?: string[];
  stopCount?: number;
  categoryNames?: string[];
}

export class ItinerariesModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async create(
    params: CreateItineraryParams,
  ): Promise<{ jobId: string; streamUrl: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{ jobId: string; streamUrl: string }>(response);
  }

  async list(limit = 20): Promise<ItineraryResponse[]> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries?limit=${limit}`,
    );
    return this.handleResponse<ItineraryResponse[]>(response);
  }

  async getById(id: string): Promise<ItineraryResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/${id}`,
    );
    return this.handleResponse<ItineraryResponse>(response);
  }

  async deleteById(id: string): Promise<void> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/${id}`,
      { method: "DELETE" },
    );
    await this.handleResponse(response);
  }

  async share(id: string): Promise<{ shareToken: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/${id}/share`,
      { method: "POST" },
    );
    return this.handleResponse<{ shareToken: string }>(response);
  }

  async activate(id: string): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/${id}/activate`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async deactivate(): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/deactivate`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async getActive(): Promise<{
    active: boolean;
    itinerary?: ItineraryResponse;
  }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/active`,
    );
    return this.handleResponse<{
      active: boolean;
      itinerary?: ItineraryResponse;
    }>(response);
  }

  async checkin(
    itineraryId: string,
    itemId: string,
  ): Promise<{ success: boolean; checkedInAt?: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/${itineraryId}/items/${itemId}/checkin`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean; checkedInAt?: string }>(
      response,
    );
  }
}
