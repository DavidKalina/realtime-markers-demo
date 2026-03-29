import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export interface ObjectiveResponse {
  id: string;
  sortOrder: number;
  title: string;
  description?: string;
  emoji?: string;
  estimatedCost?: number;
  venueName?: string;
  venueAddress?: string;
  venueCategory?: string;
  latitude?: number;
  longitude?: number;
  hook?: string;
  checkedInAt?: string;
  entryLatitude?: number;
  entryLongitude?: number;
  entryPointName?: string;
}

export interface SidequestResponse {
  id: string;
  city: string;
  budgetMax: number;
  activityTypes: string[];
  prompt?: string;
  intention?: string;
  title?: string;
  summary?: string;
  status: "GENERATING" | "READY" | "FAILED";
  tier?: "QUICK" | "SWEET_SPOT" | "BEST";
  categories?: string[];
  objectives: ObjectiveResponse[];
  children?: SidequestResponse[];
  parentId?: string;
  rating?: number;
  ratingComment?: string;
  completedAt?: string;
  promotedAt?: string;
  createdAt: string;
  isPublished?: boolean;
  timesAdopted?: number;
}

export interface BrowseSidequestResponse {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  intention: string | null;
  durationHours?: number;
  rating: number | null;
  timesAdopted: number;
  itemCount?: number;
  objectiveCount?: number;
  creatorFirstName: string | null;
  completedAt: string;
  items: {
    emoji: string | null;
    title: string;
    venueName: string | null;
  }[];
  objectives?: {
    emoji: string | null;
    title: string;
    venueName: string | null;
  }[];
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

export class SidequestsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async createSidequest(
    params: CreateSidequestParams,
  ): Promise<{ sidequestId: string; jobId: string; streamUrl: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{
      sidequestId: string;
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
  ): Promise<{ data: SidequestResponse[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    if (filters?.sort) params.set("sort", filters.sort);
    if (filters?.intention) params.set("intention", filters.intention);
    if (filters?.status) params.set("status", filters.status);
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests?${params}`,
    );
    const json = await response.json();
    if (Array.isArray(json)) {
      return { data: json, nextCursor: null };
    }
    return json;
  }

  async getById(id: string): Promise<SidequestResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}`,
    );
    return this.handleResponse<SidequestResponse>(response);
  }

  async getOptions(
    parentId: string,
  ): Promise<{ data: SidequestResponse[] }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${parentId}/options`,
    );
    return this.handleResponse<{ data: SidequestResponse[] }>(response);
  }

  async selectOption(childId: string): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${childId}/select`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async deleteById(id: string): Promise<void> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}`,
      { method: "DELETE" },
    );
    await this.handleResponse(response);
  }

  async share(id: string): Promise<{ shareToken: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/share`,
      { method: "POST" },
    );
    return this.handleResponse<{ shareToken: string }>(response);
  }

  async activate(id: string): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/activate`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async deactivate(): Promise<{ success: boolean }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/deactivate`,
      { method: "POST" },
    );
    return this.handleResponse<{ success: boolean }>(response);
  }

  async getActive(): Promise<{
    active: boolean;
    sidequest?: SidequestResponse;
  }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/active`,
    );
    return this.handleResponse<{
      active: boolean;
      sidequest?: SidequestResponse;
    }>(response);
  }

  async checkin(
    sidequestId: string,
    objectiveId: string,
  ): Promise<{ success: boolean; checkedInAt?: string }> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${sidequestId}/objectives/${objectiveId}/checkin`,
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
      `${this.client.baseUrl}/api/sidequests/${id}/rate`,
      {
        method: "POST",
        body: JSON.stringify({ rating, ...(comment && { comment }) }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<{ success: boolean; rating: number }>(response);
  }

  async search(
    query: string,
    limit = 20,
  ): Promise<{ data: SidequestResponse[] }> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/search?${params}`,
    );
    return this.handleResponse<{ data: SidequestResponse[] }>(response);
  }

  async listCompleted(limit = 20): Promise<{ data: SidequestResponse[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/completed?${params}`,
    );
    return this.handleResponse<{ data: SidequestResponse[] }>(response);
  }

  async browse(
    city: string,
    options?: {
      sort?: "popular" | "recent" | "top_rated";
      intention?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ data: BrowseSidequestResponse[] }> {
    const params = new URLSearchParams({
      city: encodeURIComponent(city),
    });
    if (options?.sort) params.set("sort", options.sort);
    if (options?.intention) params.set("intention", options.intention);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);

    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/browse?${params}`,
    );
    return this.handleResponse<{ data: BrowseSidequestResponse[] }>(response);
  }

  async promote(id: string): Promise<SidequestResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/promote`,
      { method: "POST" },
    );
    return this.handleResponse<SidequestResponse>(response);
  }

  async adopt(id: string): Promise<SidequestResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/sidequests/${id}/adopt`,
      { method: "POST" },
    );
    return this.handleResponse<SidequestResponse>(response);
  }

  async getPopularStops(city: string, limit = 15): Promise<PopularStop[]> {
    const params = new URLSearchParams({
      city: encodeURIComponent(city),
      limit: String(limit),
    });
    const response = await fetch(
      `${this.client.baseUrl}/api/public/sidequests/popular-stops?${params}`,
    );
    const json = await this.handleResponse<{ data: PopularStop[] }>(response);
    return json.data;
  }
}

// Backward-compat aliases for files still using old names
export type ItineraryResponse = SidequestResponse;
export type ItineraryItemResponse = ObjectiveResponse;
export type BrowseItineraryResponse = BrowseSidequestResponse;
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
