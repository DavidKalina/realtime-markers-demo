import { BaseApiModule } from "../base/BaseApiModule";
import type { BaseApiClient } from "../base/ApiClient";

export interface BrowseItineraryPreview {
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
  items: { emoji: string | null; title: string; venueName: string | null }[];
}

export interface DistrictMomentum {
  momentum: "rising" | "steady" | "cooling";
  weeklyNewItineraries: number;
  weeklyAdoptions: number;
  uniqueExplorers: number;
  history: { itineraryCount: number; computedAt: string }[];
}

export interface DistrictBrowseResponse {
  id: string;
  name: string;
  description: string | null;
  centroidLat: number;
  centroidLng: number;
  itineraryCount: number;
  avgRating: number | null;
  totalAdoptions: number;
  activityTags: string[];
  distanceMiles: number;
  previewItineraries: BrowseItineraryPreview[];
  momentum: DistrictMomentum | null;
}

export interface ActivityDnaEntry {
  activity: string;
  pct: number;
}

export interface ActivityDayEntry {
  date: string;
  count: number;
}

export interface DistrictDetailResponse {
  district: {
    id: string;
    name: string;
    description: string | null;
    centroidLat: number;
    centroidLng: number;
    itineraryCount: number;
    avgRating: number | null;
    totalAdoptions: number;
    activityTags: string[];
    momentum: DistrictMomentum | null;
    vitalityScore: number;
  };
  itineraries: BrowseItineraryPreview[];
  nextCursor: string | null;
  activityDna: ActivityDnaEntry[];
  activityHeatmap: ActivityDayEntry[];
  bestMatch: BrowseItineraryPreview | null;
}

export interface CoverageResponse {
  total: number;
  explored: number;
  districts: { id: string; name: string; explored: boolean }[];
}

export class DistrictsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async browse(
    lat: number,
    lng: number,
    radius?: number,
  ): Promise<{ data: DistrictBrowseResponse[] }> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    if (radius != null) params.set("radius", String(radius));

    const url = `${this.client.baseUrl}/api/districts/browse?${params}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ data: DistrictBrowseResponse[] }>(response);
  }

  async getDetail(
    id: string,
    options?: { sort?: string; limit?: number; cursor?: string },
  ): Promise<DistrictDetailResponse> {
    const params = new URLSearchParams();
    if (options?.sort) params.set("sort", options.sort);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);

    const qs = params.toString();
    const url = `${this.client.baseUrl}/api/districts/${id}${qs ? `?${qs}` : ""}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<DistrictDetailResponse>(response);
  }

  async getCoverage(
    lat: number,
    lng: number,
    radius?: number,
  ): Promise<CoverageResponse> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    if (radius != null) params.set("radius", String(radius));

    const url = `${this.client.baseUrl}/api/districts/coverage?${params}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<CoverageResponse>(response);
  }
}
