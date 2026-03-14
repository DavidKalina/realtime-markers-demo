import { create } from "zustand";

type MapMode = "explore" | "itinerary";

interface MapModeState {
  mode: MapMode;
  enterItineraryMode: () => void;
  enterExploreMode: () => void;
}

export const useMapModeStore = create<MapModeState>((set) => ({
  mode: "explore",
  enterItineraryMode: () => set({ mode: "itinerary" }),
  enterExploreMode: () => set({ mode: "explore" }),
}));
