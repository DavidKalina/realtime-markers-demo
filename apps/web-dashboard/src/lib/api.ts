import AuthService from "./auth";
import type { Event } from "./dashboard-data";

// Civic Engagement interface
interface CivicEngagement {
  id: string;
  title: string;
  description?: string;
  type: "POSITIVE_FEEDBACK" | "NEGATIVE_FEEDBACK" | "IDEA";
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "IMPLEMENTED";
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

interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  }

  private async makeRequest<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const { requireAuth = true, ...requestOptions } = options;

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...requestOptions.headers,
      },
      ...requestOptions,
    };

    // Add authentication header if required
    if (requireAuth) {
      const token = AuthService.getAccessToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    let response = await fetch(url, config);

    // If we get a 401 and we're using auth, try to refresh the token
    if (response.status === 401 && requireAuth) {
      const newToken = await AuthService.refreshAccessToken();
      if (newToken) {
        // Retry the request with the new token
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${newToken}`,
        };
        response = await fetch(url, config);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.details || errorData.error || `HTTP ${response.status}`,
      );
    }

    return response.json();
  }

  // Generic GET request
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.makeRequest<T>(endpoint, { ...options, method: "GET" });
  }

  // Generic POST request
  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic PUT request
  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic DELETE request
  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.makeRequest<T>(endpoint, { ...options, method: "DELETE" });
  }

  // Generic PATCH request
  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Fetch all events (admin/events page)
  async getAllEvents(): Promise<Event[]> {
    // The backend returns { events: Event[], total: number, hasMore: boolean }
    const response = await this.get<{ events: Event[] }>("/api/events");
    return response.events;
  }

  // Fetch all civic engagements (admin/feedback page)
  async getAllCivicEngagements(): Promise<CivicEngagement[]> {
    const response = await this.get<{ civicEngagements: CivicEngagement[] }>(
      "/api/civic-engagements",
    );
    return response.civicEngagements;
  }

  // Fetch a specific event by ID
  async getEventById(id: string): Promise<Event> {
    return this.get<Event>(`/api/events/${id}`);
  }

  // Fetch a specific civic engagement by ID
  async getCivicEngagementById(id: string): Promise<CivicEngagement> {
    return this.get<CivicEngagement>(`/api/civic-engagements/${id}`);
  }

  // Delete a specific event by ID
  async deleteEvent(id: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/api/events/${id}`);
  }

  // Delete a specific civic engagement by ID
  async deleteCivicEngagement(id: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/api/civic-engagements/${id}`);
  }

  async getCivicEngagementSignedImageUrl(id: string): Promise<string | null> {
    const res = await this.get<{ signedImageUrl?: string }>(
      `/api/admin/civic-engagements/${id}/image`,
    );
    return res.signedImageUrl || null;
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Export convenience methods
export const api = {
  get: <T>(endpoint: string, options?: ApiRequestOptions) =>
    apiClient.get<T>(endpoint, options),
  post: <T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) =>
    apiClient.post<T>(endpoint, data, options),
  put: <T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) =>
    apiClient.put<T>(endpoint, data, options),
  delete: <T>(endpoint: string, options?: ApiRequestOptions) =>
    apiClient.delete<T>(endpoint, options),
  patch: <T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) =>
    apiClient.patch<T>(endpoint, data, options),
  getAllEvents: () => apiClient.getAllEvents(),
  getEventById: (id: string) => apiClient.getEventById(id),
  deleteEvent: (id: string) => apiClient.deleteEvent(id),
  getAllCivicEngagements: () => apiClient.getAllCivicEngagements(),
  getCivicEngagementById: (id: string) => apiClient.getCivicEngagementById(id),
  deleteCivicEngagement: (id: string) => apiClient.deleteCivicEngagement(id),
  getCivicEngagementSignedImageUrl: (id: string) =>
    apiClient.getCivicEngagementSignedImageUrl(id),
};

export default apiClient;
