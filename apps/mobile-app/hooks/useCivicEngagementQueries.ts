// hooks/useCivicEngagementQueries.ts
// Civic engagement-specific implementations using the generic hooks

import { apiClient } from "@/services/ApiClient";
import { CivicEngagement } from "@/services/ApiClient";
import {
  CreateCivicEngagementRequest,
  UpdateCivicEngagementRequest,
} from "@realtime-markers/types";
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
const adaptCivicEngagementResponse = async (
  apiCall: () => Promise<{
    civicEngagements: CivicEngagement[];
    nextCursor?: string;
    prevCursor?: string;
  }>,
): Promise<PaginatedResponse<CivicEngagement>> => {
  const response = await apiCall();
  return {
    items: response.civicEngagements,
    nextCursor: response.nextCursor,
    prevCursor: response.prevCursor,
  };
};

// ============================================================================
// INFINITE CIVIC ENGAGEMENT QUERIES
// ============================================================================

export const useInfiniteCivicEngagements = (params: {
  authUserId: string;
  type: "my-engagements" | "all-engagements";
  limit?: number;
}) => {
  return useInfiniteData<CivicEngagement>({
    queryKey: [
      "civic-engagements",
      params.type,
      params.authUserId,
      JSON.stringify(params),
    ],
    queryFn: (queryParams) => {
      if (params.type === "my-engagements") {
        return adaptCivicEngagementResponse(() =>
          apiClient.civicEngagements.getCivicEngagementsByCreator(
            params.authUserId,
            {
              ...queryParams,
              limit: params.limit || 10,
            },
          ),
        );
      } else {
        return adaptCivicEngagementResponse(() =>
          apiClient.civicEngagements.getCivicEngagements({
            ...queryParams,
            limit: params.limit || 10,
          }),
        );
      }
    },
    initialParams: { limit: params.limit || 10 } as Record<string, unknown>,
    enabled: !!params.authUserId,
  });
};

// ============================================================================
// SINGLE CIVIC ENGAGEMENT QUERIES
// ============================================================================

export const useCivicEngagement = (engagementId: string, enabled = true) => {
  return useSingleData<CivicEngagement>({
    queryKey: ["civic-engagements", engagementId],
    queryFn: () =>
      apiClient.civicEngagements.getCivicEngagementById(engagementId),
    enabled: enabled && !!engagementId,
  });
};

// ============================================================================
// CIVIC ENGAGEMENT SEARCH QUERIES
// ============================================================================

export const useCivicEngagementSearch = (
  initialEngagements: CivicEngagement[] = [],
) => {
  return useSearch<{ civicEngagements: CivicEngagement[] }>({
    queryKey: ["civic-engagements", "search"],
    queryFn: (query: string) =>
      apiClient.civicEngagements.searchCivicEngagements(query, 50),
    debounceMs: 500,
    initialData: { civicEngagements: initialEngagements },
  });
};

export const useInfiniteCivicEngagementSearch = (
  initialParams: Record<string, unknown> = {},
) => {
  return useInfiniteSearch<CivicEngagement>({
    queryKey: ["civic-engagements", "infinite-search"],
    queryFn: (params) =>
      adaptCivicEngagementResponse(() =>
        apiClient.civicEngagements.searchCivicEngagements(
          params.query || "",
          50,
        ),
      ),
    initialParams: initialParams as Record<string, unknown>,
    debounceMs: 500,
  });
};

// ============================================================================
// CIVIC ENGAGEMENT MUTATIONS
// ============================================================================

export const useCreateCivicEngagement = () => {
  return useGenericMutation({
    mutationFn: (payload: CreateCivicEngagementRequest) =>
      apiClient.civicEngagements.createCivicEngagement(payload),
    invalidateQueries: [["civic-engagements"]],
  });
};

export const useUpdateCivicEngagement = () => {
  return useGenericMutation({
    mutationFn: ({
      engagementId,
      payload,
    }: {
      engagementId: string;
      payload: UpdateCivicEngagementRequest;
    }) =>
      apiClient.civicEngagements.updateCivicEngagement(engagementId, payload),
    invalidateQueries: [["civic-engagements"]],
  });
};
