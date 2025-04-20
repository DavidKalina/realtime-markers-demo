import { create } from "zustand";
import apiClient from "@/services/ApiClient";
import { Filter } from "@/services/ApiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { eventBroker, EventTypes } from "@/services/EventBroker";

const ACTIVE_FILTERS_KEY = "@active_filters";

interface FilterState {
  // State
  filters: Filter[];
  activeFilterIds: string[];
  isLoading: boolean;
  isClearing: boolean;
  error: string | null;

  // Actions
  fetchFilters: () => Promise<void>;
  createFilter: (filter: Partial<Filter>) => Promise<Filter>;
  updateFilter: (id: string, filter: Partial<Filter>) => Promise<Filter>;
  deleteFilter: (id: string) => Promise<void>;
  applyFilters: (filterIds: string[]) => Promise<void>;
  clearFilters: () => Promise<void>;
  setActiveFilterIds: (ids: string[]) => void;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  // Initial state
  filters: [],
  activeFilterIds: [],
  isLoading: false,
  isClearing: false,
  error: null,

  // Actions
  fetchFilters: async () => {
    set({ isLoading: true, error: null });
    try {
      // First fetch the filters from the API
      const userFilters = await apiClient.getUserFilters();

      // Then load active filters from storage
      const storedFilters = await AsyncStorage.getItem(ACTIVE_FILTERS_KEY);
      let activeIds: string[] = [];
      if (storedFilters) {
        activeIds = JSON.parse(storedFilters);
      }

      // If no active filters and we have filters available, apply the oldest one
      if (activeIds.length === 0 && userFilters.length > 0) {
        // Sort filters by creation date and get the oldest one
        const oldestFilter = userFilters.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0];

        // Apply the oldest filter
        await apiClient.applyFilters([oldestFilter.id]);
        activeIds = [oldestFilter.id];
        await AsyncStorage.setItem(ACTIVE_FILTERS_KEY, JSON.stringify(activeIds));
      }

      // Update state with both filters and active IDs
      set({
        filters: userFilters,
        // Only keep active filter IDs that still exist in the fetched filters
        activeFilterIds: activeIds.filter((id) => userFilters.some((filter) => filter.id === id)),
      });
    } catch (err) {
      set({
        error: `Failed to load filters: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      console.error("Error fetching filters:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  createFilter: async (filter: Partial<Filter>) => {
    set({ isLoading: true, error: null });
    try {
      const newFilter = await apiClient.createFilter(filter);

      set((state) => ({
        filters: [...state.filters, newFilter],
        isLoading: false,
      }));
      return newFilter;
    } catch (err) {
      console.error("Error creating filter:", err);
      set({
        error: `Failed to create filter: ${err instanceof Error ? err.message : "Unknown error"}`,
        isLoading: false,
      });
      throw err;
    }
  },

  updateFilter: async (id: string, filter: Partial<Filter>) => {
    set({ isLoading: true, error: null });
    try {
      const updatedFilter = await apiClient.updateFilter(id, filter);

      set((state) => ({
        filters: state.filters.map((f) => (f.id === updatedFilter.id ? updatedFilter : f)),
        isLoading: false,
      }));
      return updatedFilter;
    } catch (err) {
      console.error("Error updating filter:", err);
      set({
        error: `Failed to update filter: ${err instanceof Error ? err.message : "Unknown error"}`,
        isLoading: false,
      });
      throw err;
    }
  },

  deleteFilter: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.deleteFilter(id);
      set((state) => ({
        filters: state.filters.filter((f) => f.id !== id),
        activeFilterIds: state.activeFilterIds.filter((filterId) => filterId !== id),
        isLoading: false,
      }));
    } catch (err) {
      console.error("Error deleting filter:", err);
      set({
        error: `Failed to delete filter: ${err instanceof Error ? err.message : "Unknown error"}`,
        isLoading: false,
      });
      throw err;
    }
  },

  applyFilters: async (filterIds: string[]) => {
    try {
      await apiClient.applyFilters(filterIds);
      set({ activeFilterIds: filterIds });
      // Save to AsyncStorage
      if (filterIds.length > 0) {
        await AsyncStorage.setItem(ACTIVE_FILTERS_KEY, JSON.stringify(filterIds));
      } else {
        await AsyncStorage.removeItem(ACTIVE_FILTERS_KEY);
      }

      // Emit event to force viewport update
      eventBroker.emit(EventTypes.FORCE_VIEWPORT_UPDATE, {
        timestamp: Date.now(),
        source: "useFilterStore",
      });
    } catch (err) {
      console.error("Error applying filters:", err);
      throw err;
    }
  },

  clearFilters: async () => {
    set({ isClearing: true, error: null });
    try {
      // Call the API to clear all filters
      await apiClient.clearFilters();

      // Clear active filters in local state
      set({ activeFilterIds: [] });

      // Remove from AsyncStorage
      await AsyncStorage.removeItem(ACTIVE_FILTERS_KEY);
    } catch (err) {
      console.error("Error clearing filters:", err);
      set({
        error: `Failed to clear filters: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      throw err;
    } finally {
      set({ isClearing: false });
    }
  },

  setActiveFilterIds: (ids: string[]) => {
    set({ activeFilterIds: ids });
  },
}));
