// stores/useFilterStore.ts
import { create } from "zustand";
import { Category } from "@/hooks/useCategories";

// This interface matches the EventFilter interface from useMapWebsocket.ts
export interface FilterState {
  categories?: string[]; // Now storing category names instead of IDs
  categoryIds?: string[]; // Keep IDs for backward compatibility
  dateRange?: {
    start?: string;
    end?: string;
  };
  status?: string[];
  keywords?: string[];
  creatorId?: string;
  tags?: string[];
}

interface FilterStore {
  // Current filter state
  filter: FilterState;

  // Selected category objects (for UI display)
  selectedCategories: Category[];

  // Current active subscription ID from the server
  activeSubscriptionId: string | null;

  // Status flags
  isApplyingFilter: boolean;

  // Actions
  setCategories: (categories: Category[]) => void;
  setDateRange: (start?: string, end?: string) => void;
  setStatus: (status: string[]) => void;
  setKeywords: (keywords: string[]) => void;
  setTags: (tags: string[]) => void;

  // Set the active subscription ID returned from the server
  setActiveSubscriptionId: (id: string | null) => void;

  // Set the applying filter status
  setIsApplyingFilter: (isApplying: boolean) => void;

  // Clear all filters
  clearFilters: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  // Initial state
  filter: {
    categories: [],
    dateRange: {
      start: undefined,
      end: undefined,
    },
    status: [],
    keywords: [],
    tags: [],
  },
  selectedCategories: [],
  activeSubscriptionId: null,
  isApplyingFilter: false,

  // Actions
  setCategories: (categories: Category[]) =>
    set((state) => ({
      selectedCategories: categories,
      filter: {
        ...state.filter,
        categories: categories.map((cat) => cat.name), // Store names instead of IDs
        categoryIds: categories.map((cat) => cat.id), // Keep IDs for backward compatibility
      },
    })),

  setDateRange: (start?: string, end?: string) =>
    set((state) => ({
      filter: {
        ...state.filter,
        dateRange: { start, end },
      },
    })),

  setStatus: (status: string[]) =>
    set((state) => ({
      filter: {
        ...state.filter,
        status,
      },
    })),

  setKeywords: (keywords: string[]) =>
    set((state) => ({
      filter: {
        ...state.filter,
        keywords,
      },
    })),

  setTags: (tags: string[]) =>
    set((state) => ({
      filter: {
        ...state.filter,
        tags,
      },
    })),

  setActiveSubscriptionId: (id: string | null) => set({ activeSubscriptionId: id }),

  setIsApplyingFilter: (isApplying: boolean) => set({ isApplyingFilter: isApplying }),

  clearFilters: () =>
    set({
      filter: {
        categories: [],
        categoryIds: [],
        dateRange: {
          start: undefined,
          end: undefined,
        },
        status: [],
        keywords: [],
        tags: [],
      },
      selectedCategories: [],
      activeSubscriptionId: null,
    }),
}));
