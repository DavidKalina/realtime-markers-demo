import { create } from "zustand";
import { apiClient } from "@/services/ApiClient";
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
  createFilter: (filter: Partial<Filter> & { name: string }) => Promise<Filter>;
  applyFilters: (filterIds: string[]) => Promise<void>;
  clearFilters: () => Promise<void>;
}

export const useFilterStore = create<FilterState>((set) => ({
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
      // Fetch available filters from the API
      const userFilters = await apiClient.filters.getFilters();

      // Clear any stale date filters from previous sessions.
      // Date presets (Tonight, This Weekend, etc.) are session-specific and
      // should not persist across app launches. Category preferences are
      // preserved by the server's clearFilters endpoint.
      await apiClient.filters.clearFilters();
      await AsyncStorage.removeItem(ACTIVE_FILTERS_KEY);

      set({
        filters: userFilters,
        activeFilterIds: [],
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

  createFilter: async (filter: Partial<Filter> & { name: string }) => {
    set({ isLoading: true, error: null });
    try {
      const newFilter = await apiClient.filters.createFilter(filter);

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

  applyFilters: async (filterIds: string[]) => {
    try {
      await apiClient.filters.applyFilters(filterIds);
      set({ activeFilterIds: filterIds });
      // Save to AsyncStorage
      if (filterIds.length > 0) {
        await AsyncStorage.setItem(
          ACTIVE_FILTERS_KEY,
          JSON.stringify(filterIds),
        );
      } else {
        await AsyncStorage.removeItem(ACTIVE_FILTERS_KEY);
      }

      // Emit event to force viewport update
      eventBroker.emit(EventTypes.FORCE_VIEWPORT_UPDATE, {
        timestamp: Date.now(),
        source: "useFilterStore",
      });

      // Emit notification event
      eventBroker.emit(EventTypes.NOTIFICATION, {
        title: "Filters Updated",
        message:
          filterIds.length > 0
            ? "Filters have been applied"
            : "All filters have been cleared",
        notificationType: "success",
        duration: 3000,
        timestamp: Date.now(),
        source: "useFilterStore",
      });
    } catch (err) {
      console.error("Error applying filters:", err);
      // Emit error notification
      eventBroker.emit(EventTypes.NOTIFICATION, {
        title: "Error",
        message: "Failed to apply filters",
        notificationType: "error",
        duration: 3000,
        timestamp: Date.now(),
        source: "useFilterStore",
      });
      throw err;
    }
  },

  clearFilters: async () => {
    set({ isClearing: true, error: null });
    try {
      // Call the API to clear all filters
      await apiClient.filters.clearFilters();

      // Clear active filters in local state
      set({ activeFilterIds: [] });

      // Remove from AsyncStorage
      await AsyncStorage.removeItem(ACTIVE_FILTERS_KEY);

      // Emit notification event
      eventBroker.emit(EventTypes.NOTIFICATION, {
        title: "Filters Cleared",
        message: "All filters have been cleared",
        notificationType: "success",
        duration: 3000,
        timestamp: Date.now(),
        source: "useFilterStore",
      });
    } catch (err) {
      console.error("Error clearing filters:", err);
      // Emit error notification
      eventBroker.emit(EventTypes.NOTIFICATION, {
        title: "Error",
        message: "Failed to clear filters",
        notificationType: "error",
        duration: 3000,
        timestamp: Date.now(),
        source: "useFilterStore",
      });
      set({
        error: `Failed to clear filters: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      throw err;
    } finally {
      set({ isClearing: false });
    }
  },
}));
