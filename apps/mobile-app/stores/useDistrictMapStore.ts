import { create } from "zustand";
import type { DistrictBrowseResponse } from "@/services/api/modules/districts";

/** Max districts to keep in memory. Farthest from viewport center are pruned. */
const MAX_DISTRICTS = 50;

/** Squared Euclidean distance in degrees — cheap, good enough for sorting. */
const distSq = (
  d: DistrictBrowseResponse,
  lat: number,
  lng: number,
): number => (d.centroidLat - lat) ** 2 + (d.centroidLng - lng) ** 2;

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
  setDistricts: (
    incoming: DistrictBrowseResponse[],
    viewportCenter?: { lat: number; lng: number },
  ) => void;
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

  setDistricts: (incoming, viewportCenter) =>
    set((state) => {
      // Merge incoming districts with existing ones (keyed by id) so that
      // previously-fetched districts don't disappear when the viewport shifts.
      const byId = new Map(state.districts.map((d) => [d.id, d]));
      for (const d of incoming) {
        byId.set(d.id, d); // upsert — fresher data wins
      }

      let merged = Array.from(byId.values());

      // Prune to MAX_DISTRICTS, keeping the nearest to viewport center.
      if (merged.length > MAX_DISTRICTS && viewportCenter) {
        merged.sort(
          (a, b) =>
            distSq(a, viewportCenter.lat, viewportCenter.lng) -
            distSq(b, viewportCenter.lat, viewportCenter.lng),
        );
        merged = merged.slice(0, MAX_DISTRICTS);
      }

      return { districts: merged };
    }),

  setCoverage: (coverage) =>
    set((state) => ({
      coverageMap: {
        ...state.coverageMap,
        ...Object.fromEntries(coverage.map((d) => [d.id, d.explored])),
      },
      completedCountMap: {
        ...state.completedCountMap,
        ...Object.fromEntries(coverage.map((d) => [d.id, d.completedCount])),
      },
    })),

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
