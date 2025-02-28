// stores/useMarkerStore.ts - Updated with EventBroker integration
import { create } from "zustand";
import { eventBroker, EventTypes, MarkerEvent, BaseEvent } from "@/services/EventBroker";

interface Marker {
  id: string;
  coordinates: [number, number];
  data: {
    title: string;
    emoji: string;
    color: string;
    created_at: string;
    updated_at: string;
    [key: string]: any;
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

      console.log("Selected marker exists:", selectedExists);

      // If the selected marker no longer exists, emit a deselection event
      if (state.selectedMarkerId && !selectedExists) {
        eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
          timestamp: Date.now(),
          source: "useMarkerStore",
        });
      }

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
    set((state) => {
      // If we're deleting the currently selected marker, emit deselection event
      if (state.selectedMarkerId === markerId) {
        eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
          timestamp: Date.now(),
          source: "useMarkerStore",
        });
      }

      return {
        markers: state.markers.filter((m) => m.id !== markerId),
        selectedMarkerId: state.selectedMarkerId === markerId ? null : state.selectedMarkerId,
        selectedMarker: state.selectedMarkerId === markerId ? null : state.selectedMarker,
      };
    }),

  selectMarker: (markerId) =>
    set((state) => {
      // If the selected marker is changing, emit appropriate events
      if (state.selectedMarkerId !== markerId) {
        // If we had a previously selected marker, emit deselection event
        if (state.selectedMarkerId) {
          eventBroker.emit<BaseEvent>(EventTypes.MARKER_DESELECTED, {
            timestamp: Date.now(),
            source: "useMarkerStore",
          });
        }

        // If we're selecting a new marker, emit selection event
        if (markerId) {
          const marker = state.markers.find((m) => m.id === markerId);
          if (marker) {
            eventBroker.emit<MarkerEvent>(EventTypes.MARKER_SELECTED, {
              timestamp: Date.now(),
              source: "useMarkerStore",
              markerId,
              markerData: marker,
            });
          }
        }
      }

      return {
        selectedMarkerId: markerId,
        selectedMarker: markerId ? state.markers.find((m) => m.id === markerId) || null : null,
      };
    }),
}));
