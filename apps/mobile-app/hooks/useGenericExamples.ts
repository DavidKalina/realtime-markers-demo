// hooks/useGenericExamples.ts
// Examples of how to use the generic hooks for different data types

import { apiClient } from "@/services/ApiClient";
import {
  useInfiniteData,
  useSingleData,
  useGenericMutation,
  useSearch,
} from "./useGenericQueries";
import {
  EventResponse,
  CivicEngagementResponse,
  CategoryResponse,
  UserResponse,
} from "@realtime-markers/types";

// ============================================================================
// EVENTS - Using generic hooks directly
// ============================================================================

export const useEventsGeneric = (params: any = {}) => {
  return useInfiniteData<EventResponse>({
    queryKey: ["events", "generic", JSON.stringify(params)],
    queryFn: async (queryParams) => {
      const response = await apiClient.events.getEvents(queryParams);
      return {
        items: response.events,
        nextCursor: response.nextCursor,
        prevCursor: response.prevCursor,
      };
    },
    initialParams: params,
  });
};

export const useEventGeneric = (eventId: string) => {
  return useSingleData<EventResponse>({
    queryKey: ["events", "generic", eventId],
    queryFn: () => apiClient.events.getEventById(eventId),
    enabled: !!eventId,
  });
};

export const useEventSearchGeneric = (initialEvents: EventResponse[] = []) => {
  return useSearch<{ events: EventResponse[] }>({
    queryKey: ["events", "search", "generic"],
    queryFn: async (query: string) => {
      const response = await apiClient.events.searchEvents(query, {
        limit: 10,
      });
      return { events: response.events };
    },
    debounceMs: 800,
    initialData: { events: initialEvents },
  });
};

// ============================================================================
// CIVIC ENGAGEMENTS - Using generic hooks directly
// ============================================================================

export const useCivicEngagementsGeneric = (params: any = {}) => {
  return useInfiniteData<CivicEngagementResponse>({
    queryKey: ["civic-engagements", "generic", JSON.stringify(params)],
    queryFn: async (queryParams) => {
      const response =
        await apiClient.civicEngagements.getCivicEngagements(queryParams);
      return {
        items: response.civicEngagements,
        nextCursor: response.nextCursor,
        prevCursor: response.prevCursor,
      };
    },
    initialParams: params,
  });
};

export const useCivicEngagementGeneric = (engagementId: string) => {
  return useSingleData<CivicEngagementResponse>({
    queryKey: ["civic-engagements", "generic", engagementId],
    queryFn: () =>
      apiClient.civicEngagements.getCivicEngagementById(engagementId),
    enabled: !!engagementId,
  });
};

// ============================================================================
// CATEGORIES - Using generic hooks directly
// ============================================================================

export const useCategoriesGeneric = () => {
  return useSingleData<CategoryResponse[]>({
    queryKey: ["categories", "generic"],
    queryFn: () => apiClient.categories.getCategories(),
    staleTime: 10 * 60 * 1000, // 10 minutes - categories don't change often
  });
};

export const useCategoryGeneric = (categoryId: string) => {
  return useSingleData<CategoryResponse>({
    queryKey: ["categories", "generic", categoryId],
    queryFn: () => apiClient.categories.getCategoryById(categoryId),
    enabled: !!categoryId,
  });
};

// ============================================================================
// USERS - Using generic hooks directly
// ============================================================================

export const useUserGeneric = (userId: string) => {
  return useSingleData<UserResponse>({
    queryKey: ["users", "generic", userId],
    queryFn: () => apiClient.auth.getUserProfile(userId),
    enabled: !!userId,
  });
};

export const useCurrentUserGeneric = () => {
  return useSingleData<UserResponse>({
    queryKey: ["users", "generic", "me"],
    queryFn: () => apiClient.auth.getCurrentUser(),
  });
};

// ============================================================================
// GENERIC MUTATIONS
// ============================================================================

export const useCreateEventGeneric = () => {
  return useGenericMutation({
    mutationFn: (payload: any) => apiClient.events.createEvent(payload),
    invalidateQueries: [["events"], ["landing-page-data"]],
  });
};

export const useUpdateEventGeneric = () => {
  return useGenericMutation({
    mutationFn: ({ eventId, payload }: { eventId: string; payload: any }) =>
      apiClient.events.updateEvent(eventId, payload),
    invalidateQueries: [["events"]],
  });
};

export const useDeleteEventGeneric = () => {
  return useGenericMutation({
    mutationFn: (eventId: string) => apiClient.events.deleteEvent(eventId),
    invalidateQueries: [["events"], ["landing-page-data"]],
  });
};

// ============================================================================
// ADVANCED EXAMPLES - Custom query functions
// ============================================================================

// Custom infinite query with complex logic
export const useComplexEventQuery = (filters: any = {}) => {
  return useInfiniteData<EventResponse>({
    queryKey: ["events", "complex", JSON.stringify(filters)],
    queryFn: async (params) => {
      // Custom logic here
      const response = await apiClient.events.getEvents({
        ...params,
        ...filters,
      });

      // Transform data if needed
      return {
        items: response.events,
        nextCursor: response.nextCursor,
        prevCursor: response.prevCursor,
      };
    },
    initialParams: filters,
    staleTime: 2 * 60 * 1000, // Custom stale time
  });
};

// Custom search with multiple data sources
export const useMultiSourceSearch = (initialData: any = {}) => {
  return useSearch({
    queryKey: ["multi-search"],
    queryFn: async (query: string) => {
      // Search multiple endpoints
      const [events, civicEngagements, categories] = await Promise.all([
        apiClient.events.searchEvents(query, { limit: 5 }),
        apiClient.civicEngagements.searchCivicEngagements(query, 5),
        apiClient.categories.getCategories(), // Filter categories client-side
      ]);

      return {
        events: events.events,
        civicEngagements: civicEngagements.civicEngagements,
        categories: categories.filter((cat: any) =>
          cat.name.toLowerCase().includes(query.toLowerCase()),
        ),
      };
    },
    debounceMs: 1000,
    initialData,
  });
};

// ============================================================================
// UTILITY EXAMPLES
// ============================================================================

// Hook to combine multiple infinite queries
export const useCombinedEvents = (params: any = {}) => {
  const userEvents = useInfiniteData<EventResponse>({
    queryKey: ["events", "user", JSON.stringify(params)],
    queryFn: async (queryParams) => {
      const response = await apiClient.events.getUserCreatedEvents(queryParams);
      return {
        items: response.events,
        nextCursor: response.nextCursor,
        prevCursor: response.prevCursor,
      };
    },
    initialParams: params,
  });

  const savedEvents = useInfiniteData<EventResponse>({
    queryKey: ["events", "saved", JSON.stringify(params)],
    queryFn: async (queryParams) => {
      const response = await apiClient.events.getSavedEvents(queryParams);
      return {
        items: response.events,
        nextCursor: response.nextCursor,
        prevCursor: response.prevCursor,
      };
    },
    initialParams: params,
  });

  // Combine the data
  const combinedData = useMemo(() => {
    const allEvents = [
      ...(userEvents.data?.pages.flatMap((page) => page.items) || []),
      ...(savedEvents.data?.pages.flatMap((page) => page.items) || []),
    ];

    // Remove duplicates
    const uniqueEvents = allEvents.filter(
      (event, index, self) =>
        index === self.findIndex((e) => e.id === event.id),
    );

    return uniqueEvents;
  }, [userEvents.data, savedEvents.data]);

  return {
    data: combinedData,
    isLoading: userEvents.isLoading || savedEvents.isLoading,
    isFetching: userEvents.isFetching || savedEvents.isFetching,
    error: userEvents.error || savedEvents.error,
    refetch: () => {
      userEvents.refetch();
      savedEvents.refetch();
    },
  };
};
