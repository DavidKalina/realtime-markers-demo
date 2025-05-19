import { BaseApiClient } from "../base/ApiClient";
import {
  ApiEvent,
  CreateEventPayload,
  GetEventsParams,
  JobStatus,
  JobStreamMessage,
  ProcessEventImagePayload,
  UpdateEventPayload,
} from "../base/types";
import { EventType } from "@/types/types";
import * as FileSystem from "expo-file-system";

export class EventApiClient extends BaseApiClient {
  // Event mapping methods
  private mapEventToEventType(apiEvent: ApiEvent): EventType {
    return {
      id: apiEvent.id,
      title: apiEvent.title,
      description: apiEvent.description || "",
      eventDate: apiEvent.eventDate,
      endDate: apiEvent.endDate,
      time: new Date(apiEvent.eventDate).toLocaleTimeString(),
      coordinates: apiEvent.location.coordinates,
      location: apiEvent.address || "",
      locationNotes: apiEvent.locationNotes || "",
      distance: "",
      emoji: apiEvent.emoji || "📍",
      emojiDescription: apiEvent.emojiDescription,
      categories: apiEvent.categories?.map((c) => c.name) || [],
      creator: apiEvent.creator,
      creatorId: apiEvent.creatorId,
      scanCount: apiEvent.scanCount || 0,
      saveCount: apiEvent.saveCount || 0,
      timezone: apiEvent.timezone || "UTC",
      qrUrl: apiEvent.qrUrl,
      qrCodeData: apiEvent.qrCodeData,
      qrImagePath: apiEvent.qrImagePath,
      hasQrCode: apiEvent.hasQrCode,
      qrGeneratedAt: apiEvent.qrGeneratedAt,
      qrDetectedInImage: apiEvent.qrDetectedInImage,
      isPrivate: apiEvent.isPrivate,
      detectedQrData: apiEvent.detectedQrData,
      createdAt: apiEvent.createdAt,
      updatedAt: apiEvent.updatedAt,
      sharedWithIds: apiEvent.shares?.map((share) => share.sharedWithId) || [],
      groupId: apiEvent.groupId,
      group: apiEvent.group,
    };
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

    const url = `${this.baseUrl}/api/users/me/events/created?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
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

    const url = `${this.baseUrl}/api/events/discovered?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
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

    const url = `${this.baseUrl}/api/events?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getEventById(id: string): Promise<EventType> {
    const url = `${this.baseUrl}/api/events/${id}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<ApiEvent>(response);
    return this.mapEventToEventType(data);
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

    const url = `${this.baseUrl}/api/events/nearby?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
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
    const queryParams = new URLSearchParams({ query });
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const url = `${this.baseUrl}/api/events/search?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
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

    const url = `${this.baseUrl}/api/events/by-categories?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  // Event interaction methods
  async toggleSaveEvent(
    eventId: string,
  ): Promise<{ saved: boolean; saveCount: number }> {
    const url = `${this.baseUrl}/api/events/${eventId}/save`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ saved: boolean; saveCount: number }>(response);
  }

  async isEventSaved(eventId: string): Promise<{ isSaved: boolean }> {
    const url = `${this.baseUrl}/api/events/${eventId}/saved`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ isSaved: boolean }>(response);
  }

  async isEventRsvped(eventId: string): Promise<{ isRsvped: boolean }> {
    const url = `${this.baseUrl}/api/events/${eventId}/rsvped`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ isRsvped: boolean }>(response);
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

    const url = `${this.baseUrl}/api/events/saved?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  async getRsvpedEvents(params: GetEventsParams = {}): Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append("cursor", params.cursor);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.direction) queryParams.append("direction", params.direction);

    const url = `${this.baseUrl}/api/events/rsvped?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      events: ApiEvent[];
      nextCursor?: string;
      prevCursor?: string;
    }>(response);

    return {
      events: data.events.map(this.mapEventToEventType),
      nextCursor: data.nextCursor,
      prevCursor: data.prevCursor,
    };
  }

  // Event creation and management methods
  async createEvent(payload: CreateEventPayload): Promise<EventType> {
    const url = `${this.baseUrl}/api/events`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await this.handleResponse<ApiEvent>(response);
    return this.mapEventToEventType(data);
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
    const url = `${this.baseUrl}/api/events/private`;
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

    const url = `${this.baseUrl}/api/events/process`;
    const requestOptions = this.createRequestOptions({
      method: "POST",
      body: formData,
    });

    const response = await this.fetchWithAuth(url, requestOptions);
    return this.handleResponse<{ jobId: string; status: string }>(response);
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const url = `${this.baseUrl}/api/events/process/${jobId}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<JobStatus>(response);
  }

  createJobStream(
    jobId: string,
    callbacks: {
      onMessage: (data: JobStreamMessage) => void;
      onError?: (error: Event) => void;
      onComplete?: () => void;
    },
  ): EventSource {
    let url = `${this.baseUrl}/api/jobs/${jobId}/stream`;
    if (this.tokens?.accessToken) {
      url += `?token=${encodeURIComponent(this.tokens.accessToken)}`;
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
    const url = `${this.baseUrl}/api/events/${eventId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  async updateEvent(
    eventId: string,
    payload: UpdateEventPayload,
  ): Promise<EventType> {
    const url = `${this.baseUrl}/api/events/${eventId}`;
    const response = await this.fetchWithAuth(url, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await this.handleResponse<ApiEvent>(response);
    return this.mapEventToEventType(data);
  }

  // RSVP methods
  async toggleRsvp(
    eventId: string,
  ): Promise<{ rsvped: boolean; rsvpCount: number }> {
    const url = `${this.baseUrl}/api/events/${eventId}/rsvp`;
    const { isRsvped } = await this.isEventRsvped(eventId);

    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ status: isRsvped ? "NOT_GOING" : "GOING" }),
    });

    const data = await this.handleResponse<{
      status: string;
      goingCount: number;
      notGoingCount: number;
    }>(response);

    return {
      rsvped: data.status === "GOING",
      rsvpCount: data.goingCount,
    };
  }

  async rsvpToEvent(
    eventId: string,
  ): Promise<{ rsvped: boolean; rsvpCount: number }> {
    return this.toggleRsvp(eventId);
  }

  async cancelRsvp(
    eventId: string,
  ): Promise<{ rsvped: boolean; rsvpCount: number }> {
    const url = `${this.baseUrl}/api/events/${eventId}/rsvp`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ status: "NOT_GOING" }),
    });
    return this.handleResponse<{ rsvped: boolean; rsvpCount: number }>(
      response,
    );
  }

  // Event sharing methods
  async getEventShares(
    eventId: string,
  ): Promise<{ sharedWithId: string; sharedById: string }[]> {
    const url = `${this.baseUrl}/api/events/${eventId}/shares`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ sharedWithId: string; sharedById: string }[]>(
      response,
    );
  }

  // Image management methods
  async streamEventImage(eventId: string): Promise<string> {
    await this.ensureInitialized();

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("Authentication required to access event images");
    }

    const url = `${this.baseUrl}/api/admin/images/${eventId}/image`;

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

  // Cluster hub methods
  async getClusterHubData(markerIds: string[]): Promise<{
    featuredEvent: EventType | null;
    eventsByCategory: {
      category: { id: string; name: string };
      events: EventType[];
    }[];
    eventsByLocation: {
      location: string;
      events: EventType[];
    }[];
    eventsToday: EventType[];
    clusterEmoji: string;
    clusterName: string;
    clusterDescription: string;
    featuredCreator?: {
      id: string;
      displayName: string;
      email: string;
      eventCount: number;
      title: string;
      friendCode: string;
      creatorDescription: string;
    };
  }> {
    const url = `${this.baseUrl}/api/events/cluster-hub`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ markerIds }),
    });

    const data = await this.handleResponse<{
      featuredEvent: ApiEvent | null;
      eventsByCategory: {
        category: { id: string; name: string };
        events: ApiEvent[];
      }[];
      eventsByLocation: {
        location: string;
        events: ApiEvent[];
      }[];
      eventsToday: ApiEvent[];
      clusterEmoji: string;
      clusterName: string;
      clusterDescription: string;
      featuredCreator?: {
        id: string;
        displayName: string;
        email: string;
        eventCount: number;
        creatorDescription: string;
        title: string;
        friendCode: string;
      };
    }>(response);

    return {
      clusterEmoji: data.clusterEmoji,
      clusterName: data.clusterName,
      clusterDescription: data.clusterDescription,
      featuredEvent: data.featuredEvent
        ? this.mapEventToEventType(data.featuredEvent)
        : null,
      eventsByCategory: data.eventsByCategory.map((categoryGroup) => ({
        category: categoryGroup.category,
        events: categoryGroup.events.map(this.mapEventToEventType),
      })),
      eventsByLocation: data.eventsByLocation.map((locationGroup) => ({
        location: locationGroup.location,
        events: locationGroup.events.map(this.mapEventToEventType),
      })),
      eventsToday: data.eventsToday.map(this.mapEventToEventType),
      ...(data.featuredCreator && { featuredCreator: data.featuredCreator }),
    };
  }
}
