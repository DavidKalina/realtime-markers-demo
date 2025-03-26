import { create } from "zustand";
import apiClient from "@/services/ApiClient";
import { Filter } from "@/services/ApiClient";

interface FilterState {
  // State
  filters: Filter[];
  activeFilterIds: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchFilters: () => Promise<void>;
  createFilter: (filter: Partial<Filter>) => Promise<void>;
  updateFilter: (id: string, filter: Partial<Filter>) => Promise<void>;
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
  error: null,

  // Actions
  fetchFilters: async () => {
    set({ isLoading: true, error: null });
    try {
      const userFilters = await apiClient.getUserFilters();
      set({ filters: userFilters });
    } catch (err) {
      set({ error: `Failed to load filters: ${err instanceof Error ? err.message : "Unknown error"}` });
      console.error("Error fetching filters:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  createFilter: async (filter: Partial<Filter>) => {
    try {
      const newFilter = await apiClient.createFilter(filter);
      set((state) => ({ filters: [...state.filters, newFilter] }));
    } catch (err) {
      console.error("Error creating filter:", err);
      throw err;
    }
  },

  updateFilter: async (id: string, filter: Partial<Filter>) => {
    try {
      const updatedFilter = await apiClient.updateFilter(id, filter);
      set((state) => ({
        filters: state.filters.map((f) => (f.id === updatedFilter.id ? updatedFilter : f)),
      }));
    } catch (err) {
      console.error("Error updating filter:", err);
      throw err;
    }
  },

  deleteFilter: async (id: string) => {
    try {
      await apiClient.deleteFilter(id);
      set((state) => ({
        filters: state.filters.filter((f) => f.id !== id),
        activeFilterIds: state.activeFilterIds.filter((filterId) => filterId !== id),
      }));
    } catch (err) {
      console.error("Error deleting filter:", err);
      throw err;
    }
  },

  applyFilters: async (filterIds: string[]) => {
    try {
      await apiClient.applyFilters(filterIds);
      set({ activeFilterIds: filterIds });
    } catch (err) {
      console.error("Error applying filters:", err);
      throw err;
    }
  },

  clearFilters: async () => {
    try {
      await apiClient.clearFilters();
      set({ activeFilterIds: [] });
    } catch (err) {
      console.error("Error clearing filters:", err);
      throw err;
    }
  },

  setActiveFilterIds: (ids: string[]) => {
    set({ activeFilterIds: ids });
  },
})); 