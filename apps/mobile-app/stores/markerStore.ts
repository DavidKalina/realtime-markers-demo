import { create } from "zustand";

interface Marker {
  id: string;
  coordinates: [number, number];
  data: {
    title: string;
    emoji: string;
    color: string;
    created_at: string;
    updated_at: string;
  };
}

interface MarkerState {
  markers: Marker[];
  selectedMarkerId: string | null;
  selectedMarker: Marker | null;
  setMarkers: (markers: Marker[]) => void;
  updateMarkers: (updates: Marker[]) => void;
  deleteMarker: (markerId: string) => void;
  selectMarker: (markerId: string | null) => void;
}

export const useMarkerStore = create<MarkerState>((set, get) => ({
  markers: [],
  selectedMarkerId: null,
  selectedMarker: null,

  setMarkers: (markers) =>
    set((state) => {
      // If we have a selected marker, check if it still exists in new markers
      const selectedExists = state.selectedMarkerId
        ? markers.some((m) => m.id === state.selectedMarkerId)
        : false;

      console.log({ selectedExists });

      return {
        markers,
        // Deselect if marker no longer exists
        selectedMarkerId: selectedExists ? state.selectedMarkerId : null,
        selectedMarker: selectedExists
          ? markers.find((m) => m.id === state.selectedMarkerId) || null
          : null,
      };
    }),

  updateMarkers: (updates) =>
    set((state) => {
      const newMarkers = [...state.markers];

      updates.forEach((update) => {
        const index = newMarkers.findIndex((m) => m.id === update.id);
        if (index !== -1) {
          newMarkers[index] = update;
        } else {
          newMarkers.push(update);
        }
      });

      // Update selected marker if it was updated
      const updatedSelectedMarker = state.selectedMarkerId
        ? newMarkers.find((m) => m.id === state.selectedMarkerId) || null
        : null;

      return {
        markers: newMarkers,
        selectedMarker: updatedSelectedMarker,
      };
    }),

  deleteMarker: (markerId) =>
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== markerId),
      selectedMarkerId: state.selectedMarkerId === markerId ? null : state.selectedMarkerId,
      selectedMarker: state.selectedMarkerId === markerId ? null : state.selectedMarker,
    })),

  selectMarker: (markerId) =>
    set((state) => ({
      selectedMarkerId: markerId,
      selectedMarker: markerId ? state.markers.find((m) => m.id === markerId) || null : null,
    })),
}));
