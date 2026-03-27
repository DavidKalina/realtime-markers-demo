import { create } from "zustand";
import type { ItinerarySuggestion } from "@/services/api/modules/sidequests";
import { apiClient } from "@/services/ApiClient";

const STALE_MS = 5 * 60 * 1000; // 5 minutes

interface GetAwaySuggestionsStore {
  suggestions: ItinerarySuggestion[];
  city: string;
  fetchedAt: number | null;
  isLoading: boolean;
  error: string | null;
  /** Maps suggestion index → itineraryId for picked suggestions */
  pickedMap: Record<number, string>;

  /** Fetch suggestions if stale/empty, or force refresh */
  fetch: (latitude: number, longitude: number, force?: boolean) => void;
  /** Mark a suggestion as picked with the created itineraryId */
  markPicked: (index: number, itineraryId: string) => void;
  clear: () => void;
}

export const useGetAwaySuggestionsStore = create<GetAwaySuggestionsStore>(
  (set, get) => ({
    suggestions: [],
    city: "",
    fetchedAt: null,
    isLoading: false,
    error: null,
    pickedMap: {},

    fetch: async (latitude, longitude, force = false) => {
      const state = get();

      // If already loading, don't double-fetch
      if (state.isLoading) return;

      // If fresh and not forced, skip
      if (
        !force &&
        state.fetchedAt &&
        Date.now() - state.fetchedAt < STALE_MS &&
        state.suggestions.length > 0
      ) {
        return;
      }

      set({ isLoading: true, error: null });

      try {
        const result = await apiClient.sidequests.suggestions(
          latitude,
          longitude,
        );
        set({
          suggestions: result.suggestions,
          city: result.city,
          fetchedAt: Date.now(),
          isLoading: false,
          error: null,
          pickedMap: {}, // reset on fresh fetch
        });
      } catch (err) {
        set({
          isLoading: false,
          error:
            err instanceof Error ? err.message : "Failed to load suggestions",
        });
      }
    },

    markPicked: (index, itineraryId) =>
      set((state) => ({
        pickedMap: { ...state.pickedMap, [index]: itineraryId },
      })),

    clear: () =>
      set({
        suggestions: [],
        city: "",
        fetchedAt: null,
        isLoading: false,
        error: null,
        pickedMap: {},
      }),
  }),
);
