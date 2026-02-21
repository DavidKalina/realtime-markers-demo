// stores/useLocationStore.ts - Unified selection model (legacy fields removed)
import { create } from "zustand";
import { EventType, MapboxViewport, Marker } from "@/types/types";
import { markerToEvent, isValidCoordinates } from "@/utils/mapUtils";
import { ClusterFeature } from "@/hooks/useMarkerClustering";
import type { MapItem, MarkerItem, ClusterItem } from "@/types/map";

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

  // Marker operations
  setMarkers: (markers: Marker[]) => void;
  updateMarkers: (updates: Marker[]) => void;
  deleteMarker: (markerId: string) => void;

  // Selection operations (unified)
  selectMapItem: (item: MapItem | null) => void;
  isItemSelected: (id: string) => boolean;

  // Legacy selection methods (thin wrappers for backward compatibility)
  selectMarker: (markerId: string | null) => void;
  selectCluster: (cluster: ClusterFeature | null) => void;

  // View handlers
  setShowActions: (show: boolean) => void;

  // Action handlers
  shareEvent: () => void;
  openMaps: (location: string) => void;
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

      // Sync the events with markers
      const newEvents = markers.map(markerToEvent);

      // Update the unified selection if needed
      let newSelectedItem = state.selectedItem;
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
          // Clear selection if marker no longer exists
          newSelectedItem = null;
        }
      }

      return {
        markers,
        selectedItem: newSelectedItem,
        // Update events derived from markers
        events: newEvents,
        // Update current event if needed
        currentEvent: newSelectedMarker
          ? markerToEvent(newSelectedMarker)
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

  // Legacy selection methods (thin wrappers delegating to selectMapItem)
  selectMarker: (markerId) =>
    set((state) => {
      // Skip if trying to select the same marker that's already selected
      if (
        state.selectedItem?.id === markerId &&
        state.selectedItem?.type === "marker"
      ) {
        return state; // No change needed
      }

      if (!markerId) {
        return { selectedItem: null };
      }

      const selectedMarker =
        state.markers.find((m) => m.id === markerId) || null;

      const selectedItem: MarkerItem | null = selectedMarker
        ? {
            id: selectedMarker.id,
            type: "marker" as const,
            coordinates: selectedMarker.coordinates,
            data: selectedMarker.data,
          }
        : null;

      return { selectedItem };
    }),

  selectCluster: (cluster) =>
    set(() => {
      if (!cluster) {
        return { selectedItem: null };
      }

      // Extract cluster information
      const clusterId = `cluster-${cluster.properties.cluster_id}`;
      const count = cluster.properties.point_count;
      const coordinates = cluster.geometry.coordinates as [number, number];
      const childMarkers = cluster.properties.childMarkers || [];

      const selectedItem: ClusterItem = {
        id: clusterId,
        type: "cluster",
        coordinates,
        count,
        childrenIds: childMarkers,
      };

      return { selectedItem };
    }),

  // View state handlers
  setShowActions: (show: boolean) => set({ showActions: show }),

  // Action handlers
  shareEvent: () => {
    // This function can be implemented as needed
  },

  openMaps: (location: string) => {
    const { selectedItem, markers } = get();

    if (!selectedItem || selectedItem.type !== "marker") {
      console.warn("Cannot open maps: no current event");
      return;
    }

    const selectedMarker = markers.find((m) => m.id === selectedItem.id);
    if (!selectedMarker) return;

    // Try to use coordinates if available, otherwise fall back to location text
    if (
      selectedMarker.coordinates &&
      isValidCoordinates(selectedMarker.coordinates)
    ) {
      const [longitude, latitude] = selectedMarker.coordinates;
      const url = `https://maps.google.com/?q=${latitude},${longitude}`;
      console.log("url", url);
      // Linking.openURL(url);
    } else {
      const encodedLocation = encodeURIComponent(location);
      const url = `https://maps.google.com/?q=${encodedLocation}`;
      console.log("url", url);
      // Linking.openURL(url);
    }
  },

  handleSelectEventFromSearch: (event: EventType) => {
    const { selectMarker } = get();

    // Select the marker to update both marker and event state
    if (event.id) {
      selectMarker(event.id);
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
