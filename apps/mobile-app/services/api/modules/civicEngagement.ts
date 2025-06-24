import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export enum CivicEngagementType {
  POSITIVE_FEEDBACK = "POSITIVE_FEEDBACK",
  NEGATIVE_FEEDBACK = "NEGATIVE_FEEDBACK",
  IDEA = "IDEA",
}

export enum CivicEngagementStatus {
  PENDING = "PENDING",
  IN_REVIEW = "IN_REVIEW",
  IMPLEMENTED = "IMPLEMENTED",
  CLOSED = "CLOSED",
}

export interface CivicEngagement {
  id: string;
  title: string;
  description?: string;
  type: CivicEngagementType;
  status: CivicEngagementStatus;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;
  imageUrls?: string[];
  creatorId: string;
  adminNotes?: string;
  implementedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCivicEngagementPayload {
  title: string;
  description?: string;
  type: CivicEngagementType;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;
  imageBuffer?: string; // base64 encoded image
  contentType?: string;
  filename?: string;
}

export interface UpdateCivicEngagementPayload {
  title?: string;
  description?: string;
  status?: CivicEngagementStatus;
  adminNotes?: string;
  imageUrls?: string[];
}

export interface CivicEngagementFilters {
  type?: CivicEngagementType[];
  status?: CivicEngagementStatus[];
  search?: string;
  limit?: number;
  offset?: number;
  lat?: number;
  lng?: number;
  radius?: number;
}

export class CivicEngagementApiClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  /**
   * Create a new civic engagement
   */
  async createCivicEngagement(
    payload: CreateCivicEngagementPayload,
  ): Promise<{ jobId: string; message: string; status: string }> {
    const url = `${this.client.baseUrl}/api/civic-engagements`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return this.handleResponse<{
      jobId: string;
      message: string;
      status: string;
    }>(response);
  }

  /**
   * Get civic engagements with optional filters
   */
  async getCivicEngagements(
    filters?: CivicEngagementFilters,
  ): Promise<{ civicEngagements: CivicEngagement[]; total: number }> {
    const params = new URLSearchParams();

    if (filters?.type) {
      params.append("type", filters.type.join(","));
    }
    if (filters?.status) {
      params.append("status", filters.status.join(","));
    }
    if (filters?.search) {
      params.append("search", filters.search);
    }
    if (filters?.limit) {
      params.append("limit", filters.limit.toString());
    }
    if (filters?.offset) {
      params.append("offset", filters.offset.toString());
    }
    if (filters?.lat) {
      params.append("lat", filters.lat.toString());
    }
    if (filters?.lng) {
      params.append("lng", filters.lng.toString());
    }
    if (filters?.radius) {
      params.append("radius", filters.radius.toString());
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.client.baseUrl}/api/civic-engagements?${queryString}`
      : `${this.client.baseUrl}/api/civic-engagements`;

    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      civicEngagements: CivicEngagement[];
      total: number;
    }>(response);
  }

  /**
   * Get a specific civic engagement by ID
   */
  async getCivicEngagementById(id: string): Promise<CivicEngagement> {
    const url = `${this.client.baseUrl}/api/civic-engagements/${id}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<CivicEngagement>(response);
  }

  /**
   * Update a civic engagement (creator or admin only)
   */
  async updateCivicEngagement(
    id: string,
    payload: UpdateCivicEngagementPayload,
  ): Promise<CivicEngagement> {
    const url = `${this.client.baseUrl}/api/civic-engagements/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return this.handleResponse<CivicEngagement>(response);
  }

  /**
   * Get nearby civic engagements
   */
  async getNearbyCivicEngagements(
    lat: number,
    lng: number,
    radius?: number,
    filters?: {
      type?: CivicEngagementType[];
      status?: CivicEngagementStatus[];
      search?: string;
    },
  ): Promise<CivicEngagement[]> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });

    if (radius) {
      params.append("radius", radius.toString());
    }
    if (filters?.type) {
      params.append("type", filters.type.join(","));
    }
    if (filters?.status) {
      params.append("status", filters.status.join(","));
    }
    if (filters?.search) {
      params.append("search", filters.search);
    }

    const url = `${this.client.baseUrl}/api/civic-engagements/nearby?${params.toString()}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<CivicEngagement[]>(response);
  }

  /**
   * Get civic engagement statistics
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<CivicEngagementType, number>;
    byStatus: Record<CivicEngagementStatus, number>;
  }> {
    const url = `${this.client.baseUrl}/api/civic-engagements/stats`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      total: number;
      byType: Record<CivicEngagementType, number>;
      byStatus: Record<CivicEngagementStatus, number>;
    }>(response);
  }

  /**
   * Get civic engagements created by a specific user
   * Similar to getSavedEventsByUser in the events module
   */
  async getCivicEngagementsByCreator(
    creatorId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ civicEngagements: CivicEngagement[]; nextCursor?: string }> {
    const params = new URLSearchParams();

    if (options.limit) {
      params.append("limit", options.limit.toString());
    }
    if (options.cursor) {
      params.append("cursor", options.cursor);
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.client.baseUrl}/api/civic-engagements/creator/${creatorId}?${queryString}`
      : `${this.client.baseUrl}/api/civic-engagements/creator/${creatorId}`;

    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      civicEngagements: CivicEngagement[];
      nextCursor?: string;
    }>(response);
  }

  /**
   * Search civic engagements using backend search
   */
  async searchCivicEngagements(
    query: string,
    limit?: number,
  ): Promise<{
    civicEngagements: CivicEngagement[];
    total: number;
    scores?: Array<{ id: string; score: number }>;
  }> {
    const params = new URLSearchParams();
    if (limit) {
      params.append("limit", limit.toString());
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.client.baseUrl}/api/civic-engagements/search/${encodeURIComponent(query)}?${queryString}`
      : `${this.client.baseUrl}/api/civic-engagements/search/${encodeURIComponent(query)}`;

    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      civicEngagements: CivicEngagement[];
      total: number;
      scores?: Array<{ id: string; score: number }>;
    }>(response);
  }

  /**
   * Delete a civic engagement (creator or admin only)
   */
  async deleteCivicEngagement(id: string): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/civic-engagements/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }
}
