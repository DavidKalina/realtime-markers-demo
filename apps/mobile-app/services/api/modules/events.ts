import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import {
  ApiEvent,
  CreateEventPayload,
  EventEngagementMetrics,
  GetEventsParams,
  JobStatus,
  JobStreamMessage,
  ProcessEventImagePayload,
  RsvpStatus,
  UpdateEventPayload,
} from "../base/types";
import { EventType } from "@/types/types";
import * as FileSystem from "expo-file-system";
import { mapEventToEventType } from "../utils/eventMapper";

export class EventApiClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  // Event fetching methods
  async getUserCreatedEvents(params: GetEventsParams = {}): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const url = `${this.client.baseUrl}/api/users/me/events/created?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getUserDiscoveredEvents(params: GetEventsParams = {}): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const url = `${this.client.baseUrl}/api/events/discovered?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getEvents(params: GetEventsParams = {}): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);
    if (params.query) queryParams.append("query", params.query);
    if (params.categoryId) queryParams.append("categoryId", params.categoryId);
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);

    const url = `${this.client.baseUrl}/api/events?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getEventById(id: string): Promise<EventType> {
    const url = `${this.client.baseUrl}/api/events/${id}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<ApiEvent>(response);
    return mapEventToEventType(data);
  }

  async getNearbyEvents(
    latitude: number,
    longitude: number,
    params: GetEventsParams & { radius?: number } = {},
  ): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    if (params.radius) queryParams.append("radius", params.radius.toString());
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);

    const url = `${this.client.baseUrl}/api/events/nearby?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async searchEvents(
    query: string,
    params: GetEventsParams = {},
  ): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams({ q: query });
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const url = `${this.client.baseUrl}/api/events/search?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);

    const data = await this.handleResponse<{
      query: string;
      results: ApiEvent[];
    }>(response);

    // Validate response data
    if (!data || !Array.isArray(data.results)) {
      console.error("Invalid API response data:", data);
      throw new Error("Invalid API response format");
    }

    return {
      events: data.results.map(mapEventToEventType),
      nextCursor: undefined, // The new API format doesn't seem to include cursors
      prevCursor: undefined,
    };
  }

  async getEventsByCategories(
    categoryIds: string[],
    params: GetEventsParams = {},
  ): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams({
      categories: categoryIds.join(","),
    });

    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);

    const url = `${this.client.baseUrl}/api/events/by-categories?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getEventsByCategory(
    categoryId: string,
    params: GetEventsParams = {},
  ): Promise<{
    events: EventType[];
    nextCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const url = `${this.client.baseUrl}/api/events/category/${categoryId}?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
    }>(response);

    return {
      events: data.events.map(mapEventToEventType),
      nextCursor: data.nextCursor,
    };
  }

  async getLandingPageData(
    params: {
      userLat?: number;
      userLng?: number;
      featuredLimit?: number;
      upcomingLimit?: number;
    } = {},
  ): Promise<{
    featuredEvents: EventType[];
    upcomingEvents: EventType[];
    popularCategories: Array<{
      id: string;
      name: string;
      icon: string;
    }>;
  }> {
    const queryParams = new URLSearchParams();
    if (params.userLat !== undefined)
      queryParams.append("lat", params.userLat.toString());
    if (params.userLng !== undefined)
      queryParams.append("lng", params.userLng.toString());
    if (params.featuredLimit)
      queryParams.append("featuredLimit", params.featuredLimit.toString());
    if (params.upcomingLimit)
      queryParams.append("upcomingLimit", params.upcomingLimit.toString());

    const url = `${this.client.baseUrl}/api/events/landing?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      featuredEvents: ApiEvent[];
      upcomingEvents: ApiEvent[];
      popularCategories: Array<{
        id: string;
        name: string;
        icon: string;
      }>;
    }>(response);

    return {
      featuredEvents: data.featuredEvents.map(mapEventToEventType),
      upcomingEvents: data.upcomingEvents.map(mapEventToEventType),
      popularCategories: data.popularCategories,
    };
  }

  // Event interaction methods
  async toggleSaveEvent(
    eventId: string,
  ): Promise<{ saved: boolean; saveCount: number }> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/save`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ saved: boolean; saveCount: number }>(response);
  }

  async isEventSaved(eventId: string): Promise<{ isSaved: boolean }> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/saved`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ isSaved: boolean }>(response);
  }

  async getSavedEvents(params: GetEventsParams = {}): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const url = `${this.client.baseUrl}/api/events/saved?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getFriendsSavedEvents(params: GetEventsParams = {}): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const url = `${this.client.baseUrl}/api/events/saved/friends?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  // RSVP methods
  async toggleRsvpEvent(
    eventId: string,
    status: RsvpStatus,
  ): Promise<{
    eventId: string;
    status: RsvpStatus;
    goingCount: number;
    notGoingCount: number;
  }> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvp`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    return this.handleResponse<{
      eventId: string;
      status: RsvpStatus;
      goingCount: number;
      notGoingCount: number;
    }>(response);
  }

  async isEventRsvped(eventId: string): Promise<{ isRsvped: boolean }> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/rsvped`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ isRsvped: boolean }>(response);
  }

  // Event creation and management methods
  async createEvent(payload: CreateEventPayload): Promise<EventType> {
    const url = `${this.client.baseUrl}/api/events`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await this.handleResponse<ApiEvent>(response);
    return mapEventToEventType(data);
  }

  async createPrivateEvent(payload: CreateEventPayload): Promise<{
    status: string;
    jobId: string;
    message: string;
    _links: {
      self: string;
      status: string;
      stream: string;
    };
  }> {
    const url = `${this.client.baseUrl}/api/events/private`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return this.handleResponse<{
      status: string;
      jobId: string;
      message: string;
      _links: {
        self: string;
        status: string;
        stream: string;
      };
    }>(response);
  }

  async processEventImage(
    payload: ProcessEventImagePayload,
  ): Promise<{ jobId: string; status: string }> {
    const formData = new FormData();
    formData.append("image", payload.imageFile);
    formData.append("userLat", payload.userLat.toString());
    formData.append("userLng", payload.userLng.toString());
    formData.append("source", payload.source);

    const url = `${this.client.baseUrl}/api/events/process`;
    const requestOptions = this.createRequestOptions({
      method: "POST",
      body: formData,
    });

    const response = await this.fetchWithAuth(url, requestOptions);
    return this.handleResponse<{ jobId: string; status: string }>(response);
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const url = `${this.client.baseUrl}/api/events/process/${jobId}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<JobStatus>(response);
  }

  async createJobStream(
    jobId: string,
    callbacks: {
      onMessage: (data: JobStreamMessage) => void;
      onError?: (error: Event) => void;
      onComplete?: () => void;
    },
  ): Promise<EventSource> {
    let url = `${this.client.baseUrl}/api/jobs/${jobId}/stream`;
    const accessToken = await this.client.getAccessToken();
    if (accessToken) {
      url += `?token=${encodeURIComponent(accessToken)}`;
    }

    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callbacks.onMessage(data);
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

  async deleteEvent(eventId: string): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/events/${eventId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  async updateEvent(
    eventId: string,
    payload: UpdateEventPayload,
  ): Promise<EventType> {
    const url = `${this.client.baseUrl}/api/events/${eventId}`;
    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await this.handleResponse<ApiEvent>(response);
    return mapEventToEventType(data);
  }

  // Event sharing methods
  async getEventShares(
    eventId: string,
  ): Promise<{ sharedWithId: string; sharedById: string }[]> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/shares`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ sharedWithId: string; sharedById: string }[]>(
      response,
    );
  }

  // Event engagement methods
  async getEventEngagement(eventId: string): Promise<EventEngagementMetrics> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/engagement`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<EventEngagementMetrics>(response);
  }

  async trackEventView(
    eventId: string,
  ): Promise<{ success: boolean; message: string }> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/view`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ success: boolean; message: string }>(response);
  }

  // Image management methods
  async streamEventImage(eventId: string): Promise<string> {
    await this.ensureInitialized();

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("Authentication required to access event images");
    }

    const url = `${this.client.baseUrl}/api/admin/images/${eventId}/image`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Server returned error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (!data.originalImageUrl) {
        throw new Error("No image URL returned from server");
      }

      const fileName = `event-${eventId}-original.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const now = new Date().getTime();
      const oneHourAgo = now - 60 * 60 * 1000;

      if (
        fileInfo.exists &&
        fileInfo.modificationTime &&
        fileInfo.modificationTime > oneHourAgo &&
        fileInfo.size > 1000
      ) {
        return fileUri;
      }

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }

      const downloadResult = await FileSystem.downloadAsync(
        data.originalImageUrl,
        fileUri,
      );

      if (downloadResult.status !== 200) {
        throw new Error(`Failed to download image: ${downloadResult.status}`);
      }

      const downloadedFileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!downloadedFileInfo.exists || downloadedFileInfo.size < 1000) {
        throw new Error("Downloaded file is too small to be a valid image");
      }

      return fileUri;
    } catch (error) {
      console.error("Error fetching event image:", error);
      throw error;
    }
  }
}
