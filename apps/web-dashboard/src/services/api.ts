// API service for web dashboard
// This handles authentication and API calls to the backend

import { AuthService } from "@/lib/auth";

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

interface CreateEventPayload {
  title: string;
  description?: string;
  date: string;
  eventDate: string;
  endDate?: string;
  isPrivate: boolean;
  emoji?: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;
  sharedWithIds?: string[];
  userCoordinates?: {
    lat: number;
    lng: number;
  };
  image?: File;
  // QR code related fields
  qrUrl?: string;
  // Recurring event fields
  isRecurring?: boolean;
  recurrenceFrequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";
  recurrenceDays?: string[];
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  recurrenceTime?: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  isPrivate: boolean;
  creatorId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface EventEngagement {
  eventId: string;
  saveCount: number;
  scanCount: number;
  viewCount: number;
  rsvpCount: number;
  goingCount: number;
  notGoingCount: number;
  totalEngagement: number;
  lastUpdated: string;
}

interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  progressStep: string;
  result?: any;
  error?: string;
}

// Place search interfaces
interface PlaceSearchParams {
  query: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface PlaceSearchResult {
  success: boolean;
  error?: string;
  place?: {
    name: string;
    address: string;
    coordinates: [number, number];
    placeId: string;
    types: string[];
    rating?: number;
    userRatingsTotal?: number;
    distance?: number;
    locationNotes?: string;
  };
}

interface CityStateSearchParams {
  query: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface CityStateSearchResult {
  success: boolean;
  error?: string;
  cityState?: {
    city: string;
    state: string;
    coordinates: [number, number];
    formattedAddress: string;
    placeId: string;
    distance?: number;
  };
}

class ApiService {
  private baseUrl: string;

  constructor() {
    // In development, this would point to your local backend
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  }

  private async getAccessToken(): Promise<string | null> {
    // Get the access token from AuthService
    return AuthService.getAccessToken();
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || `HTTP ${response.status}`,
          status: response.status,
        };
      }

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Network error",
        status: 0,
      };
    }
  }

  // Event-related API calls
  async createEvent(payload: CreateEventPayload): Promise<ApiResponse<Event>> {
    // If image is provided, use FormData
    if (payload.image) {
      const formData = new FormData();

      // Add the image file
      formData.append("image", payload.image);

      // Add other event data as individual fields
      formData.append("title", payload.title);
      if (payload.description)
        formData.append("description", payload.description);
      formData.append("eventDate", payload.eventDate);
      if (payload.endDate) formData.append("endDate", payload.endDate);
      if (payload.emoji) formData.append("emoji", payload.emoji);
      if (payload.address) formData.append("address", payload.address);
      if (payload.locationNotes)
        formData.append("locationNotes", payload.locationNotes);
      formData.append("isPrivate", payload.isPrivate.toString());
      if (payload.sharedWithIds && payload.sharedWithIds.length > 0) {
        formData.append("sharedWithIds", payload.sharedWithIds.join(","));
      }
      formData.append("lat", payload.location.coordinates[0].toString());
      formData.append("lng", payload.location.coordinates[1].toString());

      // Add QR code related fields
      if (payload.qrUrl) {
        formData.append("qrUrl", payload.qrUrl);
      }

      // Add recurring event fields
      if (payload.isRecurring !== undefined) {
        formData.append("isRecurring", payload.isRecurring.toString());
      }
      if (payload.recurrenceFrequency) {
        formData.append("recurrenceFrequency", payload.recurrenceFrequency);
      }
      if (payload.recurrenceDays && payload.recurrenceDays.length > 0) {
        formData.append(
          "recurrenceDays",
          JSON.stringify(payload.recurrenceDays),
        );
      }
      if (payload.recurrenceStartDate) {
        formData.append("recurrenceStartDate", payload.recurrenceStartDate);
      }
      if (payload.recurrenceEndDate) {
        formData.append("recurrenceEndDate", payload.recurrenceEndDate);
      }
      if (payload.recurrenceInterval) {
        formData.append(
          "recurrenceInterval",
          payload.recurrenceInterval.toString(),
        );
      }
      if (payload.recurrenceTime) {
        formData.append("recurrenceTime", payload.recurrenceTime);
      }

      if (payload.userCoordinates) {
        formData.append("userLat", payload.userCoordinates.lat.toString());
        formData.append("userLng", payload.userCoordinates.lng.toString());
      }

      const token = await this.getAccessToken();
      const headers: Record<string, string> = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await fetch(`${this.baseUrl}/api/events`, {
          method: "POST",
          headers,
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            error: data.error || `HTTP ${response.status}`,
            status: response.status,
          };
        }

        return {
          data,
          status: response.status,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Network error",
          status: 0,
        };
      }
    } else {
      // No image, use JSON
      return this.makeRequest<Event>("/api/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  }

  async createPrivateEvent(payload: CreateEventPayload): Promise<
    ApiResponse<{
      status: string;
      jobId: string;
      message: string;
      _links: {
        self: string;
        status: string;
        stream: string;
      };
    }>
  > {
    // If image is provided, use FormData
    if (payload.image) {
      const formData = new FormData();

      // Add the image file
      formData.append("image", payload.image);

      // Add other event data as individual fields
      formData.append("title", payload.title);
      if (payload.description)
        formData.append("description", payload.description);
      formData.append("eventDate", payload.eventDate);
      if (payload.endDate) formData.append("endDate", payload.endDate);
      if (payload.emoji) formData.append("emoji", payload.emoji);
      if (payload.address) formData.append("address", payload.address);
      if (payload.locationNotes)
        formData.append("locationNotes", payload.locationNotes);
      formData.append("isPrivate", payload.isPrivate.toString());
      if (payload.sharedWithIds && payload.sharedWithIds.length > 0) {
        formData.append("sharedWithIds", payload.sharedWithIds.join(","));
      }
      formData.append("lat", payload.location.coordinates[0].toString());
      formData.append("lng", payload.location.coordinates[1].toString());

      // Add QR code related fields
      if (payload.qrUrl) {
        formData.append("qrUrl", payload.qrUrl);
      }

      // Add recurring event fields
      if (payload.isRecurring !== undefined) {
        formData.append("isRecurring", payload.isRecurring.toString());
      }
      if (payload.recurrenceFrequency) {
        formData.append("recurrenceFrequency", payload.recurrenceFrequency);
      }
      if (payload.recurrenceDays && payload.recurrenceDays.length > 0) {
        formData.append(
          "recurrenceDays",
          JSON.stringify(payload.recurrenceDays),
        );
      }
      if (payload.recurrenceStartDate) {
        formData.append("recurrenceStartDate", payload.recurrenceStartDate);
      }
      if (payload.recurrenceEndDate) {
        formData.append("recurrenceEndDate", payload.recurrenceEndDate);
      }
      if (payload.recurrenceInterval) {
        formData.append(
          "recurrenceInterval",
          payload.recurrenceInterval.toString(),
        );
      }
      if (payload.recurrenceTime) {
        formData.append("recurrenceTime", payload.recurrenceTime);
      }

      if (payload.userCoordinates) {
        formData.append("userLat", payload.userCoordinates.lat.toString());
        formData.append("userLng", payload.userCoordinates.lng.toString());
      }

      const token = await this.getAccessToken();
      const headers: Record<string, string> = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await fetch(`${this.baseUrl}/api/events/private`, {
          method: "POST",
          headers,
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            error: data.error || `HTTP ${response.status}`,
            status: response.status,
          };
        }

        return {
          data,
          status: response.status,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Network error",
          status: 0,
        };
      }
    } else {
      // No image, use JSON
      return this.makeRequest("/api/events/private", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  }

  async getEvents(
    params: {
      limit?: number;
      offset?: number;
      cursor?: string;
    } = {},
  ): Promise<
    ApiResponse<{
      events: Event[];
      total: number;
      hasMore: boolean;
    }>
  > {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());
    if (params.cursor) queryParams.append("cursor", params.cursor);

    const queryString = queryParams.toString();
    const endpoint = `/api/events${queryString ? `?${queryString}` : ""}`;

    return this.makeRequest(endpoint);
  }

  async getEventById(id: string): Promise<ApiResponse<Event>> {
    return this.makeRequest<Event>(`/api/events/${id}`);
  }

  async getEventEngagement(id: string): Promise<ApiResponse<EventEngagement>> {
    return this.makeRequest<EventEngagement>(`/api/events/${id}/engagement`);
  }

  async updateEvent(
    id: string,
    payload: Partial<CreateEventPayload>,
  ): Promise<ApiResponse<Event>> {
    return this.makeRequest<Event>(`/api/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteEvent(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(`/api/events/${id}`, {
      method: "DELETE",
    });
  }

  // Job-related API calls
  async getJobStatus(jobId: string): Promise<ApiResponse<JobStatus>> {
    return this.makeRequest<JobStatus>(`/api/jobs/${jobId}`);
  }

  // Friends-related API calls (for private events)
  async getFriends(): Promise<
    ApiResponse<
      Array<{
        id: string;
        name: string;
        email: string;
      }>
    >
  > {
    return this.makeRequest("/api/friends");
  }

  // Place search API calls
  async searchPlace(
    params: PlaceSearchParams,
  ): Promise<ApiResponse<PlaceSearchResult>> {
    return this.makeRequest<PlaceSearchResult>("/api/places/search", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async searchCityState(
    params: CityStateSearchParams,
  ): Promise<ApiResponse<CityStateSearchResult>> {
    return this.makeRequest<CityStateSearchResult>(
      "/api/places/search-city-state",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }
}

// Export a singleton instance
export const apiService = new ApiService();
export type {
  CreateEventPayload,
  Event,
  JobStatus,
  PlaceSearchParams,
  PlaceSearchResult,
  CityStateSearchParams,
  CityStateSearchResult,
  EventEngagement,
};
