// stores/useLocationStore.ts - Updated with unified selection model
import { create } from "zustand";
import * as Linking from "expo-linking";
import { EventType, MapboxViewport } from "@/types/types";
import { markerToEvent, isValidCoordinates } from "@/utils/mapUtils";
import { Marker } from "@/hooks/useMapWebsocket";
import { ClusterFeature } from "@/hooks/useMarkerClustering";

type ActiveView = "none" | "details" | "share" | "search" | "camera" | "map";

// Define the base interface for map items (markers and clusters)
interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

// Marker-specific properties
interface MarkerItem extends BaseMapItem {
  type: "marker";
  data: Marker["data"];
}

// Cluster-specific properties
interface ClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[]; // Optional IDs of markers in this cluster
}

// Union type for any selectable map item
type MapItem = MarkerItem | ClusterItem;

interface LocationStoreState {
  // Marker data
  markers: Marker[];

  zoomLevel: number;

  setZoomLevel: (z: number) => void;

  // Unified selection state
  selectedItem: MapItem | null;

  // Legacy selection state (for backward compatibility)
  selectedMarkerId: string | null;
  selectedMarker: Marker | null;
  selectedItemType: "marker" | "cluster" | null;
  selectedCluster: {
    id: string;
    count: number;
    coordinates: [number, number];
  } | null;

  // Map state
  mapViewport: MapboxViewport | null;
  isConnected: boolean;

  // View states
  activeView: ActiveView;
  showActions: boolean;
  detailsViewVisible: boolean;
  shareViewVisible: boolean;
  searchViewVisible: boolean;
  scanViewVisible: boolean;
  mapViewVisible: boolean;

  // Marker operations
  setMarkers: (markers: Marker[]) => void;
  updateMarkers: (updates: Marker[]) => void;
  deleteMarker: (markerId: string) => void;

  // Selection operations (unified)
  selectMapItem: (item: MapItem | null) => void;
  isItemSelected: (id: string) => boolean;

  // Legacy selection methods (for backward compatibility)
  selectMarker: (markerId: string | null) => void;
  selectCluster: (cluster: ClusterFeature | null) => void;

  // View handlers
  setShowActions: (show: boolean) => void;
  openDetailsView: () => void;
  closeDetailsView: () => void;
  openShareView: () => void;
  closeShareView: () => void;
  openSearchView: () => void;
  closeSearchView: () => void;
  openScanView: () => void;
  closeScanView: () => void;
  openMapView: () => void;
  closeMapView: () => void;

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

  // Legacy selection state (for backward compatibility)
  selectedMarkerId: null,
  selectedMarker: null,
  selectedItemType: null,
  selectedCluster: null,

  // Map state
  mapViewport: null,
  isConnected: false,

  // Initial view states
  activeView: "none",
  showActions: true,
  detailsViewVisible: false,
  shareViewVisible: false,
  searchViewVisible: false,
  scanViewVisible: false,
  mapViewVisible: false,

  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  // Marker operations
  setMarkers: (markers) =>
    set((state) => {
      // If we have a selected marker, check if it still exists in new markers
      const selectedExists = state.selectedMarkerId
        ? markers.some((m) => m.id === state.selectedMarkerId)
        : false;

      // Find the new selected marker if it exists
      const newSelectedMarker = selectedExists
        ? markers.find((m) => m.id === state.selectedMarkerId) || null
        : null;

      // Sync the events with markers
      const newEvents = markers.map(markerToEvent);

      // Update the unified selection if needed
      let newSelectedItem = state.selectedItem;
      if (state.selectedItem?.type === "marker" && state.selectedMarkerId) {
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
        // Deselect if marker no longer exists
        selectedMarkerId: selectedExists ? state.selectedMarkerId : null,
        selectedMarker: newSelectedMarker,
        // Clear cluster selection when markers are updated
        selectedItemType: selectedExists ? "marker" : null,
        // Update the unified selection
        selectedItem: newSelectedItem,
        // Update events derived from markers
        events: newEvents,
        // Update current event if needed
        currentEvent: newSelectedMarker ? markerToEvent(newSelectedMarker) : null,
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

      // Update the unified selection if needed
      let newSelectedItem = state.selectedItem;
      if (state.selectedItem?.type === "marker" && updatedSelectedMarker) {
        newSelectedItem = {
          id: updatedSelectedMarker.id,
          type: "marker",
          coordinates: updatedSelectedMarker.coordinates,
          data: updatedSelectedMarker.data,
        };
      }

      return {
        markers: newMarkers,
        selectedMarker: updatedSelectedMarker,
        selectedItem: newSelectedItem,
      };
    }),

  deleteMarker: (markerId) =>
    set((state) => {
      // Check if we're deleting the currently selected marker
      const isSelectedMarker = state.selectedMarkerId === markerId;

      return {
        markers: state.markers.filter((m) => m.id !== markerId),
        selectedMarkerId: isSelectedMarker ? null : state.selectedMarkerId,
        selectedMarker: isSelectedMarker ? null : state.selectedMarker,
        selectedItemType: isSelectedMarker ? null : state.selectedItemType,
        // Clear the unified selection if we're deleting the selected marker
        selectedItem:
          isSelectedMarker && state.selectedItem?.type === "marker" ? null : state.selectedItem,
      };
    }),

  // Unified selection method
  selectMapItem: (item) =>
    set((state) => {
      // Update legacy selection state for backward compatibility
      const legacyState = {
        selectedMarkerId: item?.type === "marker" ? item.id : null,
        selectedMarker:
          item?.type === "marker" ? state.markers.find((m) => m.id === item.id) || null : null,
        selectedCluster:
          item?.type === "cluster"
            ? {
                id: item.id,
                count: item.count,
                coordinates: item.coordinates,
              }
            : null,
        selectedItemType: item?.type || null,
      };

      return {
        ...legacyState,
        selectedItem: item,
      };
    }),

  // Helper to check if an item is selected
  isItemSelected: (id) => {
    const { selectedItem } = get();
    return selectedItem?.id === id;
  },

  // Legacy selection methods (adapted to use the unified selection)
  selectMarker: (markerId) =>
    set((state) => {
      // Skip if trying to select the same marker that's already selected
      if (state.selectedMarkerId === markerId && state.selectedItemType === "marker") {
        return state; // No change needed
      }

      const selectedMarker = markerId ? state.markers.find((m) => m.id === markerId) || null : null;

      // Create the unified map item
      const selectedItem = selectedMarker
        ? {
            id: selectedMarker.id,
            type: "marker" as const,
            coordinates: selectedMarker.coordinates,
            data: selectedMarker.data,
          }
        : null;

      return {
        selectedMarkerId: markerId,
        selectedMarker: selectedMarker,
        selectedItemType: markerId ? "marker" : null,
        selectedCluster: null,
        selectedItem: selectedItem,
      };
    }),

  selectCluster: (cluster) =>
    set((state) => {
      if (!cluster) {
        return {
          selectedCluster: null,
          selectedItemType: null,
          selectedMarkerId: null,
          selectedMarker: null,
          selectedItem: null,
        };
      }

      // Extract cluster information
      const clusterId = `cluster-${cluster.properties.cluster_id}`;
      const count = cluster.properties.point_count;
      const coordinates = cluster.geometry.coordinates as [number, number];
      const childMarkers = cluster.properties.childMarkers || [];

      // Create the unified cluster item
      const selectedItem: ClusterItem = {
        id: clusterId,
        type: "cluster",
        coordinates,
        count,
        childrenIds: childMarkers, // Ensure childMarkers are passed through
      };

      return {
        // Store cluster information in legacy format
        selectedCluster: {
          id: clusterId,
          count: count,
          coordinates: coordinates,
        },
        // Set item type to cluster, and clear any marker selection
        selectedItemType: "cluster",
        selectedMarkerId: null,
        selectedMarker: null,
        // Set the unified selection
        selectedItem,
      };
    }),

  // View state handlers
  setShowActions: (show: boolean) => set({ showActions: show }),

  openDetailsView: () =>
    set({
      activeView: "details",
      detailsViewVisible: true,
      shareViewVisible: false,
      searchViewVisible: false,
      scanViewVisible: false,
      mapViewVisible: false,
    }),

  closeDetailsView: () =>
    set({
      activeView: "none",
      detailsViewVisible: false,
    }),

  openShareView: () =>
    set({
      activeView: "share",
      shareViewVisible: true,
      detailsViewVisible: false,
      searchViewVisible: false,
      scanViewVisible: false,
      mapViewVisible: false,
    }),

  closeShareView: () =>
    set({
      activeView: "none",
      shareViewVisible: false,
    }),

  openSearchView: () =>
    set({
      activeView: "search",
      searchViewVisible: true,
      detailsViewVisible: false,
      shareViewVisible: false,
      scanViewVisible: false,
      mapViewVisible: false,
    }),

  closeSearchView: () =>
    set({
      activeView: "none",
      searchViewVisible: false,
    }),

  openScanView: () =>
    set({
      activeView: "camera",
      scanViewVisible: true,
      detailsViewVisible: false,
      shareViewVisible: false,
      searchViewVisible: false,
      mapViewVisible: false,
    }),

  closeScanView: () =>
    set({
      activeView: "none",
      scanViewVisible: false,
    }),

  openMapView: () =>
    set({
      activeView: "map",
      mapViewVisible: true,
      detailsViewVisible: false,
      shareViewVisible: false,
      searchViewVisible: false,
      scanViewVisible: false,
    }),

  closeMapView: () =>
    set({
      activeView: "none",
      mapViewVisible: false,
    }),

  // Action handlers
  shareEvent: () => {
    const { openShareView } = get();
    openShareView();
  },

  openMaps: (location: string) => {
    const { selectedMarker } = get();

    if (!selectedMarker) {
      console.warn("Cannot open maps: no current event");
      return;
    }

    // Try to use coordinates if available, otherwise fall back to location text
    if (selectedMarker.coordinates && isValidCoordinates(selectedMarker.coordinates)) {
      const [longitude, latitude] = selectedMarker.coordinates;
      const url = `https://maps.google.com/?q=${latitude},${longitude}`;
      Linking.openURL(url);
    } else {
      const encodedLocation = encodeURIComponent(location);
      const url = `https://maps.google.com/?q=${encodedLocation}`;
      Linking.openURL(url);
    }
  },

  handleSelectEventFromSearch: (event: EventType) => {
    const { selectMarker, closeSearchView } = get();

    // Close search first
    closeSearchView();

    // Select the marker to update both marker and event state
    if (event.id) {
      selectMarker(event.id);
    }
  },

  handleSelectEventFromMap: (marker: Marker) => {
    try {
      const { selectMapItem, closeMapView } = get();

      // Close map view
      closeMapView();

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
