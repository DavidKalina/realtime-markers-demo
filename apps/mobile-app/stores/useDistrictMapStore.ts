import { create } from "zustand";
import type {
  DistrictBrowseResponse,
  BrowseItineraryPreview,
} from "@/services/api/modules/districts";

/** Max districts to keep in memory. Farthest from viewport center are pruned. */
const MAX_DISTRICTS = 50;

/** Squared Euclidean distance in degrees — cheap, good enough for sorting. */
const distSq = (
  d: DistrictBrowseResponse,
  lat: number,
  lng: number,
): number => (d.centroidLat - lat) ** 2 + (d.centroidLng - lng) ** 2;

/**
 * Shape of an itinerary as streamed from the FilterProcessor via WebSocket.
 * A subset of the full itinerary — just what's needed for map markers.
 */
export interface StreamedItinerary {
  id: string;
  title: string | null;
  summary: string | null;
  city: string;
  categories?: string[];
  entryLatitude: number | null;
  entryLongitude: number | null;
  rating: number | null;
  timesAdopted: number;
  items?: {
    id?: string;
    title: string;
    emoji?: string | null;
    latitude: number | null;
    longitude: number | null;
    venueCategory?: string | null;
    sortOrder?: number;
  }[];
}

/** Convert a streamed itinerary into BrowseItineraryPreview for rendering. */
export function streamedToBrowsePreview(
  s: StreamedItinerary,
): BrowseItineraryPreview {
  return {
    id: s.id,
    title: s.title,
    summary: s.summary,
    city: s.city,
    intention: null,
    entryLatitude: s.entryLatitude,
    entryLongitude: s.entryLongitude,
    durationHours: 0,
    rating: s.rating,
    timesAdopted: s.timesAdopted,
    itemCount: s.items?.length ?? 0,
    creatorFirstName: null,
    completedAt: "",
    items:
      s.items?.map((item) => ({
        emoji: item.emoji ?? null,
        title: item.title,
        venueName: null,
        latitude: item.latitude,
        longitude: item.longitude,
      })) ?? [],
  };
}

interface DistrictMapState {
  // Data
  districts: DistrictBrowseResponse[];
  coverageMap: Record<string, boolean>;
  completedCountMap: Record<string, number>;

  // Streamed itineraries from WebSocket (replaces district preview data for map)
  streamedItineraries: BrowseItineraryPreview[];

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
  setStreamedItineraries: (itineraries: BrowseItineraryPreview[]) => void;
  addStreamedItinerary: (itinerary: BrowseItineraryPreview) => void;
  updateStreamedItinerary: (itinerary: BrowseItineraryPreview) => void;
  deleteStreamedItinerary: (id: string) => void;
  setFocusedDistrict: (id: string | null) => void;
  markExplored: (districtId: string) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useDistrictMapStore = create<DistrictMapState>((set) => ({
  districts: [],
  coverageMap: {},
  completedCountMap: {},
  streamedItineraries: [],
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

  setStreamedItineraries: (itineraries) =>
    set({ streamedItineraries: itineraries }),

  addStreamedItinerary: (itinerary) =>
    set((state) => {
      if (state.streamedItineraries.some((it) => it.id === itinerary.id)) {
        return state; // already exists
      }
      return {
        streamedItineraries: [...state.streamedItineraries, itinerary],
      };
    }),

  updateStreamedItinerary: (itinerary) =>
    set((state) => ({
      streamedItineraries: state.streamedItineraries.map((it) =>
        it.id === itinerary.id ? itinerary : it,
      ),
    })),

  deleteStreamedItinerary: (id) =>
    set((state) => ({
      streamedItineraries: state.streamedItineraries.filter(
        (it) => it.id !== id,
      ),
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
      streamedItineraries: [],
      focusedDistrictId: null,
      isLoading: false,
    }),
}));
