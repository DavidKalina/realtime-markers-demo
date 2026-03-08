// stores/useLocationStore.ts - Unified selection model (legacy fields removed)
import { create } from "zustand";
import { EventType, MapboxViewport, Marker } from "@/types/types";
import type { MapItem, MarkerItem } from "@/types/map";

interface LocationStoreState {
  // Marker data
  markers: Marker[];

  zoomLevel: number;

  setZoomLevel: (z: number) => void;

  // Unified selection state
  selectedItem: MapItem | null;

  // Map state
  mapViewport: MapboxViewport | null;
  isConnected: boolean;

  // View states
  showActions: boolean;

  // Visible marker stats (set by ClusteredMapMarkers after clustering + viewport culling)
  visibleCategoryCounts: Record<string, number>;
  visibleMarkerTotal: number;
  setVisibleMarkerStats: (counts: Record<string, number>, total: number) => void;

  // Marker operations
  setMarkers: (markers: Marker[]) => void;
  updateMarkers: (updates: Marker[]) => void;
  deleteMarker: (markerId: string) => void;

  // Selection operations (unified)
  selectMapItem: (item: MapItem | null) => void;
  isItemSelected: (id: string) => boolean;

  // View handlers
  setShowActions: (show: boolean) => void;

  // Action handlers
  handleSelectEventFromSearch: (event: EventType) => void;
  handleSelectEventFromMap: (marker: Marker) => void;
  updateMapViewport: (viewport: MapboxViewport) => void;
  setConnectionStatus: (isConnected: boolean) => void;
}

export const useLocationStore = create<LocationStoreState>((set, get) => ({
  // Initial marker state
  markers: [],

  zoomLevel: 14,

  // Unified selection state
  selectedItem: null,

  // Map state
  mapViewport: null,
  isConnected: false,

  // Initial view states
  showActions: true,

  // Visible marker stats
  visibleCategoryCounts: {},
  visibleMarkerTotal: 0,
  setVisibleMarkerStats: (counts, total) => set({ visibleCategoryCounts: counts, visibleMarkerTotal: total }),

  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  // Marker operations
  setMarkers: (markers) =>
    set((state) => {
      // If we have a selected marker, check if it still exists in new markers
      const selectedId =
        state.selectedItem?.type === "marker" ? state.selectedItem.id : null;
      const selectedExists = selectedId
        ? markers.some((m) => m.id === selectedId)
        : false;

      // Find the new selected marker if it exists
      const newSelectedMarker = selectedExists
        ? markers.find((m) => m.id === selectedId) || null
        : null;

      // Update the unified selection if needed
      let newSelectedItem = state.selectedItem;
      // Build the final markers array — if the selected marker isn't in the
      // incoming set (e.g. viewport shifted during a camera animation after
      // tap), re-inject it so it stays rendered on screen.
      let finalMarkers = markers;
      if (state.selectedItem?.type === "marker" && selectedId) {
        if (selectedExists && newSelectedMarker) {
          // Update the marker item with new data
          newSelectedItem = {
            id: newSelectedMarker.id,
            type: "marker",
            coordinates: newSelectedMarker.coordinates,
            data: newSelectedMarker.data,
          };
        } else {
          // Selected marker not in incoming set — re-inject it from the
          // previous markers array so it doesn't vanish mid-selection.
          const prevSelected = state.markers.find((m) => m.id === selectedId);
          if (prevSelected) {
            finalMarkers = [...markers, prevSelected];
          } else {
            newSelectedItem = null;
          }
        }
      }

      return {
        markers: finalMarkers,
        selectedItem: newSelectedItem,
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

      // Update the unified selection if needed
      let newSelectedItem = state.selectedItem;
      if (state.selectedItem?.type === "marker") {
        const updatedSelectedMarker = newMarkers.find(
          (m) => m.id === state.selectedItem!.id,
        );
        if (updatedSelectedMarker) {
          newSelectedItem = {
            id: updatedSelectedMarker.id,
            type: "marker",
            coordinates: updatedSelectedMarker.coordinates,
            data: updatedSelectedMarker.data,
          };
        }
      }

      return {
        markers: newMarkers,
        selectedItem: newSelectedItem,
      };
    }),

  deleteMarker: (markerId) =>
    set((state) => {
      const isSelectedMarker =
        state.selectedItem?.type === "marker" &&
        state.selectedItem.id === markerId;

      return {
        markers: state.markers.filter((m) => m.id !== markerId),
        selectedItem: isSelectedMarker ? null : state.selectedItem,
      };
    }),

  // Unified selection method
  selectMapItem: (item) =>
    set(() => ({
      selectedItem: item,
    })),

  // Helper to check if an item is selected
  isItemSelected: (id) => {
    const { selectedItem } = get();
    return selectedItem?.id === id;
  },

  // View state handlers
  setShowActions: (show: boolean) => set({ showActions: show }),

  handleSelectEventFromSearch: (event: EventType) => {
    const { markers, selectMapItem } = get();
    if (event.id) {
      const marker = markers.find((m) => m.id === event.id);
      if (marker) {
        selectMapItem({
          id: marker.id,
          type: "marker",
          coordinates: marker.coordinates,
          data: marker.data,
        });
      }
    }
  },

  handleSelectEventFromMap: (marker: Marker) => {
    try {
      const { selectMapItem } = get();

      // Select the marker using the unified selection method
      if (marker.id) {
        const markerItem: MarkerItem = {
          id: marker.id,
          type: "marker",
          coordinates: marker.coordinates,
          data: marker.data,
        };
        selectMapItem(markerItem);
      }
    } catch (error) {
      console.error("Error handling marker selection:", error);
    }
  },

  // Map viewport management
  updateMapViewport: (viewport: MapboxViewport) => {
    set({ mapViewport: viewport });
  },

  // Connection status management
  setConnectionStatus: (isConnected: boolean) => {
    set({ isConnected });
  },
}));
