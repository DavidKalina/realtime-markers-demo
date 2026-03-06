import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import {
  ApiEvent,
  ApiDiscoveredEvent,
  CreateEventPayload,
  EventEngagementMetrics,
  GetEventsParams,
  JobStatus,
  JobStreamMessage,
  ProcessEventImagePayload,
  RsvpStatus,
  UpdateEventPayload,
} from "../base/types";
import {
  EventType,
  DiscoveredEventType,
  TrendingEventType,
} from "@/types/types";
import { File, Paths } from "expo-file-system";
import {
  mapEventToEventType,
  mapDiscoveredEventToType,
  mapTrendingEventToType,
} from "../utils/eventMapper";

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

  async getInitialViewport(
    latitude: number,
    longitude: number,
  ): Promise<{
    center: [number, number];
    zoom: number;
    hasNearbyEvents: boolean;
    nearestEventDistance: number | null;
  }> {
    const queryParams = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    const url = `${this.client.baseUrl}/api/events/initial-viewport?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      center: [number, number];
      zoom: number;
      hasNearbyEvents: boolean;
      nearestEventDistance: number | null;
    }>(response);
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
      communityLimit?: number;
      discoveryLimit?: number;
      trendingLimit?: number;
      radius?: number;
      city?: string;
      includeCategoryIds?: string[];
      excludeCategoryIds?: string[];
    } = {},
  ): Promise<{
    featuredEvents: EventType[];
    upcomingEvents: EventType[];
    communityEvents: EventType[];
    justDiscoveredEvents: DiscoveredEventType[];
    trendingEvents: TrendingEventType[];
    popularCategories: Array<{
      id: string;
      name: string;
      icon: string;
      eventCount?: number;
    }>;
    availableCities: string[];
    resolvedCity?: string;
    topEvents?: EventType[];
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
    if (params.communityLimit)
      queryParams.append("communityLimit", params.communityLimit.toString());
    if (params.discoveryLimit)
      queryParams.append("discoveryLimit", params.discoveryLimit.toString());
    if (params.trendingLimit)
      queryParams.append("trendingLimit", params.trendingLimit.toString());
    if (params.radius !== undefined)
      queryParams.append("radius", params.radius.toString());
    if (params.city) queryParams.append("city", params.city);
    if (params.includeCategoryIds?.length)
      queryParams.append(
        "includeCategoryIds",
        params.includeCategoryIds.join(","),
      );
    if (params.excludeCategoryIds?.length)
      queryParams.append(
        "excludeCategoryIds",
        params.excludeCategoryIds.join(","),
      );

    const url = `${this.client.baseUrl}/api/events/landing?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      featuredEvents: ApiEvent[];
      upcomingEvents: ApiEvent[];
      communityEvents?: ApiEvent[];
      justDiscoveredEvents?: ApiDiscoveredEvent[];
      trendingEvents?: (ApiEvent & {
        isTrending?: boolean;
        trendingScore?: number;
      })[];
      topEvents?: ApiEvent[];
      popularCategories: Array<{
        id: string;
        name: string;
        icon: string;
        eventCount?: number;
      }>;
      availableCities?: string[];
      resolvedCity?: string;
    }>(response);

    console.log("Landing page API response:", {
      featuredEventsCount: data.featuredEvents?.length || 0,
      upcomingEventsCount: data.upcomingEvents?.length || 0,
      communityEventsCount: data.communityEvents?.length || 0,
      justDiscoveredEventsCount: data.justDiscoveredEvents?.length || 0,
      trendingEventsCount: data.trendingEvents?.length || 0,
      hasCommunityEvents: !!data.communityEvents,
    });

    return {
      featuredEvents: data.featuredEvents.map(mapEventToEventType),
      upcomingEvents: data.upcomingEvents.map(mapEventToEventType),
      communityEvents: (data.communityEvents || []).map(mapEventToEventType),
      justDiscoveredEvents: (data.justDiscoveredEvents || []).map(
        mapDiscoveredEventToType,
      ),
      trendingEvents: (data.trendingEvents || []).map(mapTrendingEventToType),
      popularCategories: data.popularCategories.map((cat) => ({
        ...cat,
        eventCount: cat.eventCount ?? undefined,
      })),
      availableCities: data.availableCities || [],
      resolvedCity: data.resolvedCity,
      topEvents: data.topEvents?.map(mapEventToEventType),
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

  async getUserEvents(params: GetEventsParams = {}): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const url = `${this.client.baseUrl}/api/events/my-events?${queryParams.toString()}`;
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
      const file = new File(Paths.cache, fileName);

      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      if (
        file.exists &&
        file.modificationTime &&
        file.modificationTime > oneHourAgo &&
        file.size > 1000
      ) {
        return file.uri;
      }

      if (file.exists) {
        file.delete();
      }

      const downloaded = await File.downloadFileAsync(
        data.originalImageUrl,
        file,
      );

      if (!downloaded.exists || downloaded.size < 1000) {
        throw new Error("Downloaded file is too small to be a valid image");
      }

      return downloaded.uri;
    } catch (error) {
      console.error("Error fetching event image:", error);
      throw error;
    }
  }
}
