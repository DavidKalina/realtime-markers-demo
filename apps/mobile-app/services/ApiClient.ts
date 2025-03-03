// src/services/ApiClient.ts

import { EventType } from "@/types/types";

// Define base API types from your backend
interface Location {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
}

interface ApiEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  location: Location;
  address?: string;
  categories?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
  emoji?: string;
}

// Search response from your API
interface SearchResponse {
  query: string;
  results: (ApiEvent & { _score: number })[];
  nextCursor?: string;
}

// Options for fetching events
interface EventOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

class ApiClient {
  public baseUrl: string;

  constructor(baseUrl: string = process.env.EXPO_PUBLIC_API_URL!) {
    this.baseUrl = baseUrl;
  }

  // Set the base URL (useful for environment switching)
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  // Helper method to handle API responses
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  // Convert API event to frontend event type
  private mapEventToEventType(apiEvent: ApiEvent): EventType {
    return {
      id: apiEvent.id,
      title: apiEvent.title,
      description: apiEvent.description || "",
      time: new Date(apiEvent.eventDate).toLocaleString(),
      location: apiEvent.address || "Location not specified",
      distance: "", // This would be calculated based on user's location
      emoji: apiEvent.emoji || "📍",
      categories: apiEvent.categories?.map((c) => c.name) || [],
    };
  }

  // Fetch all events
  async getEvents(options?: EventOptions): Promise<EventType[]> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset) queryParams.append("offset", options.offset.toString());

    const url = `${this.baseUrl}/api/events?${queryParams.toString()}`;
    const response = await fetch(url);
    const data = await this.handleResponse<ApiEvent[]>(response);

    return data.map(this.mapEventToEventType);
  }

  // Fetch a single event by ID
  async getEventById(id: string): Promise<EventType> {
    const url = `${this.baseUrl}/api/events/${id}`;
    const response = await fetch(url);
    const data = await this.handleResponse<ApiEvent>(response);

    return this.mapEventToEventType(data);
  }

  // Fetch nearby events
  async getNearbyEvents(
    latitude: number,
    longitude: number,
    radius?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<EventType[]> {
    const queryParams = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    if (radius) queryParams.append("radius", radius.toString());
    if (startDate) queryParams.append("startDate", startDate.toISOString());
    if (endDate) queryParams.append("endDate", endDate.toISOString());

    const url = `${this.baseUrl}/api/events/nearby?${queryParams.toString()}`;
    const response = await fetch(url);
    const data = await this.handleResponse<ApiEvent[]>(response);

    return data.map((event) => {
      // Add distance calculation here if provided by API
      const eventWithDistance = this.mapEventToEventType(event);
      // You could calculate distance from the coordinates if not provided by API
      return eventWithDistance;
    });
  }

  // Search events
  async searchEvents(query: string, limit?: number, cursor?: string): Promise<SearchResponse> {
    const queryParams = new URLSearchParams({ q: query });

    if (limit) queryParams.append("limit", limit.toString());
    if (cursor) queryParams.append("cursor", cursor);

    const url = `${this.baseUrl}/api/events/search?${queryParams.toString()}`;
    const response = await fetch(url);
    return this.handleResponse<SearchResponse>(response);
  }

  // Get events by categories
  async getEventsByCategories(categoryIds: string[], options?: EventOptions): Promise<EventType[]> {
    const queryParams = new URLSearchParams({
      categories: categoryIds.join(","),
    });

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset) queryParams.append("offset", options.offset.toString());
    if (options?.startDate) queryParams.append("startDate", options.startDate.toISOString());
    if (options?.endDate) queryParams.append("endDate", options.endDate.toISOString());

    const url = `${this.baseUrl}/api/events/by-categories?${queryParams.toString()}`;
    const response = await fetch(url);
    const data = await this.handleResponse<ApiEvent[]>(response);

    return data.map(this.mapEventToEventType);
  }

  // Get all categories
  async getAllCategories(): Promise<{ id: string; name: string }[]> {
    const url = `${this.baseUrl}/api/events/categories`;
    const response = await fetch(url);
    return this.handleResponse<{ id: string; name: string }[]>(response);
  }

  // Create a new event
  async createEvent(eventData: Partial<ApiEvent>): Promise<ApiEvent> {
    const url = `${this.baseUrl}/api/events`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });

    return this.handleResponse<ApiEvent>(response);
  }

  // Upload an image for event processing
  async processEventImage(imageFile: File): Promise<{ jobId: string; status: string }> {
    const formData = new FormData();
    formData.append("image", imageFile);

    const url = `${this.baseUrl}/api/events/process`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    return this.handleResponse<{ jobId: string; status: string }>(response);
  }

  // Get event processing job status
  async getJobStatus(jobId: string): Promise<any> {
    const url = `${this.baseUrl}/api/events/process/${jobId}`;
    const response = await fetch(url);
    return this.handleResponse<any>(response);
  }

  // Create a stream connection for job updates
  createJobStream(
    jobId: string,
    callbacks: {
      onMessage: (data: any) => void;
      onError?: (error: Event) => void;
      onComplete?: () => void;
    }
  ): EventSource {
    const url = `${this.baseUrl}/api/jobs/${jobId}/stream`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callbacks.onMessage(data);

        // Check if job is complete or failed
        if (data.status === "completed" || data.status === "failed") {
          eventSource.close();
          if (callbacks.onComplete) callbacks.onComplete();
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      if (callbacks.onError) callbacks.onError(error);
      eventSource.close();
    };

    return eventSource;
  }
}

// Export as singleton
export const apiClient = new ApiClient();
export default apiClient;
