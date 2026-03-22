import { create } from "zustand";
import type { DistrictBrowseResponse } from "@/services/api/modules/districts";

interface DistrictMapState {
  // Data
  districts: DistrictBrowseResponse[];
  coverageMap: Record<string, boolean>;
  completedCountMap: Record<string, number>;

  // Focused district (closest to viewport center)
  focusedDistrictId: string | null;

  // Fetch gating
  isLoading: boolean;

  // Actions
  setDistricts: (districts: DistrictBrowseResponse[]) => void;
  setCoverage: (
    coverage: { id: string; explored: boolean; completedCount: number }[],
  ) => void;
  setFocusedDistrict: (id: string | null) => void;
  markExplored: (districtId: string) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useDistrictMapStore = create<DistrictMapState>((set) => ({
  districts: [],
  coverageMap: {},
  completedCountMap: {},
  focusedDistrictId: null,
  isLoading: false,

  setDistricts: (districts) => set({ districts }),

  setCoverage: (coverage) =>
    set({
      coverageMap: Object.fromEntries(
        coverage.map((d) => [d.id, d.explored]),
      ),
      completedCountMap: Object.fromEntries(
        coverage.map((d) => [d.id, d.completedCount]),
      ),
    }),

  setFocusedDistrict: (id) => set({ focusedDistrictId: id }),

  markExplored: (districtId) =>
    set((state) => ({
      coverageMap: { ...state.coverageMap, [districtId]: true },
    })),

  setLoading: (isLoading) => set({ isLoading }),

  clear: () =>
    set({
      districts: [],
      coverageMap: {},
      completedCountMap: {},
      focusedDistrictId: null,
      isLoading: false,
    }),
}));
