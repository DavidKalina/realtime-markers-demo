// hooks/useEventQueries.ts
// Event-specific implementations using the generic hooks

import { apiClient } from "@/services/ApiClient";
import { EventResponse as EventType } from "@realtime-markers/types";
import {
  GetEventsParams,
  CreateEventRequest,
  UpdateEventRequest,
  RsvpStatus,
} from "@/services/api/base/types";
import {
  useInfiniteData,
  useSingleData,
  useGenericMutation,
  useSearch,
  useInfiniteSearch,
  PaginatedResponse,
} from "./useGenericQueries";

// ============================================================================
// ADAPTER FUNCTIONS
// ============================================================================

// Convert API response to generic PaginatedResponse format
const adaptEventResponse = async (
  apiCall: () => Promise<{
    events: EventType[];
    nextCursor?: string;
    prevCursor?: string;
  }>,
): Promise<PaginatedResponse<EventType>> => {
  const response = await apiCall();
  return {
    items: response.events,
    nextCursor: response.nextCursor,
    prevCursor: response.prevCursor,
  };
};

// ============================================================================
// INFINITE EVENT QUERIES
// ============================================================================

export const useInfiniteUserCreatedEvents = (params: GetEventsParams = {}) => {
  return useInfiniteData<EventType>({
    queryKey: ["events", "user-created", JSON.stringify(params)],
    queryFn: (queryParams) =>
      adaptEventResponse(() =>
        apiClient.events.getUserCreatedEvents(queryParams),
      ),
    initialParams: params as Record<string, unknown>,
  });
};

export const useInfiniteUserDiscoveredEvents = (
  params: GetEventsParams = {},
) => {
  return useInfiniteData<EventType>({
    queryKey: ["events", "user-discovered", JSON.stringify(params)],
    queryFn: (queryParams) =>
      adaptEventResponse(() =>
        apiClient.events.getUserDiscoveredEvents(queryParams),
      ),
    initialParams: params as Record<string, unknown>,
  });
};

export const useInfiniteSavedEvents = (params: GetEventsParams = {}) => {
  return useInfiniteData<EventType>({
    queryKey: ["events", "saved", JSON.stringify(params)],
    queryFn: (queryParams) =>
      adaptEventResponse(() => apiClient.events.getSavedEvents(queryParams)),
    initialParams: params as Record<string, unknown>,
  });
};

export const useInfiniteFriendsSavedEvents = (params: GetEventsParams = {}) => {
  return useInfiniteData<EventType>({
    queryKey: ["events", "friends-saved", JSON.stringify(params)],
    queryFn: (queryParams) =>
      adaptEventResponse(() =>
        apiClient.events.getFriendsSavedEvents(queryParams),
      ),
    initialParams: params as Record<string, unknown>,
  });
};

export const useInfiniteEventsByCategory = (
  categoryId: string,
  params: GetEventsParams = {},
) => {
  return useInfiniteData<EventType>({
    queryKey: ["events", "by-category", categoryId, JSON.stringify(params)],
    queryFn: (queryParams) =>
      adaptEventResponse(() =>
        apiClient.events.getEventsByCategory(categoryId, queryParams),
      ),
    initialParams: params as Record<string, unknown>,
  });
};

export const useInfiniteNearbyEvents = (
  latitude: number,
  longitude: number,
  params: GetEventsParams & { radius?: number } = {},
) => {
  return useInfiniteData<EventType>({
    queryKey: [
      "events",
      "nearby",
      latitude.toString(),
      longitude.toString(),
      JSON.stringify(params),
    ],
    queryFn: (queryParams) =>
      adaptEventResponse(() =>
        apiClient.events.getNearbyEvents(latitude, longitude, {
          ...params,
          ...queryParams,
        }),
      ),
    initialParams: params as Record<string, unknown>,
  });
};

// ============================================================================
// SINGLE EVENT QUERIES
// ============================================================================

export const useEvent = (eventId: string, enabled = true) => {
  return useSingleData<EventType>({
    queryKey: ["events", eventId],
    queryFn: () => apiClient.events.getEventById(eventId),
    enabled: enabled && !!eventId,
  });
};

export const useEventEngagement = (eventId: string, enabled = true) => {
  return useSingleData({
    queryKey: ["events", eventId, "engagement"],
    queryFn: () => apiClient.events.getEventEngagement(eventId),
    enabled: enabled && !!eventId,
  });
};

export const useLandingPageData = (
  params: {
    userLat?: number;
    userLng?: number;
    featuredLimit?: number;
    upcomingLimit?: number;
    communityLimit?: number;
  } = {},
) => {
  return useSingleData({
    queryKey: ["landing-page-data", JSON.stringify(params)],
    queryFn: () => apiClient.events.getLandingPageData(params),
  });
};

// ============================================================================
// EVENT SEARCH QUERIES
// ============================================================================

export const useEventSearch = (initialEvents: EventType[] = []) => {
  return useSearch<{ events: EventType[] }>({
    queryKey: ["events", "search"],
    queryFn: (query: string) =>
      apiClient.events.searchEvents(query, { limit: 10 }),
    debounceMs: 800,
    initialData: { events: initialEvents },
  });
};

export const useInfiniteEventSearch = (initialParams: GetEventsParams = {}) => {
  return useInfiniteSearch<EventType>({
    queryKey: ["events", "infinite-search"],
    queryFn: (params) =>
      adaptEventResponse(() =>
        apiClient.events.searchEvents(params.query || "", params),
      ),
    initialParams: initialParams as Record<string, unknown>,
    debounceMs: 800,
  });
};

// ============================================================================
// EVENT MUTATIONS
// ============================================================================

export const useCreateEvent = () => {
  return useGenericMutation({
    mutationFn: (payload: CreateEventRequest) =>
      apiClient.events.createEvent(payload),
    invalidateQueries: [["events"], ["landing-page-data"]],
  });
};

export const useUpdateEvent = () => {
  return useGenericMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: UpdateEventRequest;
    }) => apiClient.events.updateEvent(eventId, payload),
    invalidateQueries: [["events"]],
  });
};

export const useDeleteEvent = () => {
  return useGenericMutation({
    mutationFn: (eventId: string) => apiClient.events.deleteEvent(eventId),
    invalidateQueries: [["events"], ["landing-page-data"]],
  });
};

export const useToggleSaveEvent = () => {
  return useGenericMutation({
    mutationFn: (eventId: string) => apiClient.events.toggleSaveEvent(eventId),
    invalidateQueries: [["events", "saved"], ["events"]],
  });
};

export const useToggleRsvpEvent = () => {
  return useGenericMutation({
    mutationFn: ({
      eventId,
      status,
    }: {
      eventId: string;
      status: RsvpStatus;
    }) => apiClient.events.toggleRsvpEvent(eventId, status),
    invalidateQueries: [["events"]],
  });
};

export const useTrackEventView = () => {
  return useGenericMutation({
    mutationFn: (eventId: string) => apiClient.events.trackEventView(eventId),
    // Don't invalidate queries for view tracking as it's just analytics
  });
};
