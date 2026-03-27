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
  entryLatitude?: number;
  entryLongitude?: number;
  entryPointName?: string;
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
  intention?: string;
  title?: string;
  summary?: string;
  status: "GENERATING" | "READY" | "FAILED";
  items: ItineraryItemResponse[];
  forecast?: DayForecast;
  rating?: number;
  ratingComment?: string;
  completedAt?: string;
  createdAt: string;
  isPublished?: boolean;
  timesAdopted?: number;
  sourceItineraryId?: string;
}

export interface BrowseItineraryResponse {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  durationHours: number;
  rating: number | null;
  timesAdopted: number;
  itemCount: number;
  creatorFirstName: string | null;
  completedAt: string;
  items: {
    emoji: string | null;
    title: string;
    venueName: string | null;
  }[];
}

export interface AnchorStopParam {
  coordinates: [number, number]; // [lng, lat]
  label?: string;
  address?: string;
  placeId?: string;
  primaryType?: string;
  rating?: number;
  note?: string;
}

export interface CreateItineraryParams {
  city?: string;
  plannedDate: string; // ISO 8601 datetime string (e.g. "2026-03-25T00:00:00-06:00")
  budgetMin?: number;
  budgetMax?: number;
  durationHours: number;
  activityTypes?: string[];
  stopCount?: number;
  startTime?: string; // HH:MM (24h)
  endTime?: string; // HH:MM (24h)
  intention?: string;
  title?: string;
  anchorStops?: AnchorStopParam[];
  surpriseMe?: boolean;
  timezone?: string;
}

export interface CreateSidequestParams {
  prompt: string;
  radiusMiles: number;
  budgetMax: number;
  latitude: number;
  longitude: number;
  timezone?: string;
  activityTypes?: string[];
  intention?: string;
  city?: string;
  surpriseMe?: boolean;
  note?: string;
}

export class ItinerariesModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async createSidequest(
    params: CreateSidequestParams,
  ): Promise<{ itineraryId: string; jobId: string; streamUrl: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/sidequest`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{
      itineraryId: string;
      jobId: string;
      streamUrl: string;
    }>(response);
  }

  async create(
    params: CreateItineraryParams,
  ): Promise<{ itineraryId: string; jobId: string; streamUrl: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{
      itineraryId: string;
      jobId: string;
      streamUrl: string;
    }>(response);
  }

  async list(
    limit = 20,
    cursor?: string,
    filters?: {
      sort?: string;
      intention?: string;
      status?: string;
    },
  ): Promise<{ data: ItineraryResponse[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    if (filters?.sort) params.set("sort", filters.sort);
    if (filters?.intention) params.set("intention", filters.intention);
    if (filters?.status) params.set("status", filters.status);
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries?${params}`,
    );
    const json = await response.json();
    // Handle both paginated { data, nextCursor } and legacy array responses
    if (Array.isArray(json)) {
      return { data: json, nextCursor: null };
    }
    return json;
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

  async rate(
    id: string,
    rating: number,
    comment?: string,
  ): Promise<{ success: boolean; rating: number }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/${id}/rate`,
      {
        method: "POST",
        body: JSON.stringify({ rating, ...(comment && { comment }) }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{ success: boolean; rating: number }>(response);
  }

  async listCompleted(limit = 20): Promise<{ data: ItineraryResponse[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/completed?${params}`,
    );
    return this.handleResponse<{ data: ItineraryResponse[] }>(response);
  }

  async browse(
    city: string,
    options?: {
      sort?: "popular" | "recent" | "top_rated";
      intention?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ data: BrowseItineraryResponse[] }> {
    const params = new URLSearchParams({
      city: encodeURIComponent(city),
    });
    if (options?.sort) params.set("sort", options.sort);
    if (options?.intention) params.set("intention", options.intention);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);

    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/browse?${params}`,
    );
    return this.handleResponse<{ data: BrowseItineraryResponse[] }>(response);
  }

  async adopt(id: string): Promise<ItineraryResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/${id}/adopt`,
      { method: "POST" },
    );
    return this.handleResponse<ItineraryResponse>(response);
  }

  async suggestions(
    latitude: number,
    longitude: number,
  ): Promise<{ city: string; suggestions: ItinerarySuggestion[] }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/itineraries/suggestions`,
      {
        method: "POST",
        body: JSON.stringify({ latitude, longitude }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{
      city: string;
      suggestions: ItinerarySuggestion[];
    }>(response);
  }

  async getPopularStops(city: string, limit = 15): Promise<PopularStop[]> {
    const params = new URLSearchParams({
      city: encodeURIComponent(city),
      limit: String(limit),
    });
    const response = await fetch(
      `${this.client.baseUrl}/api/public/itineraries/popular-stops?${params}`,
    );
    const json = await this.handleResponse<{ data: PopularStop[] }>(response);
    return json.data;
  }
}

export interface ItinerarySuggestion {
  title: string;
  emoji: string;
  city: string;
  costTier: "$" | "$$" | "$$$";
  durationHours: number;
  stopCount: number;
  activityTypes: string[];
  intention: string;
  budgetMax: number;
}

export interface PopularStop {
  venueName: string;
  venueCategory: string | null;
  emoji: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  frequency: number;
  completions: number;
  completionRate: number;
  score: number;
}
