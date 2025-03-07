// stores/useLocationStore.ts - Updated with improved cluster typing
import { create } from "zustand";
import * as Linking from "expo-linking";
import { EventType, MapboxViewport } from "@/types/types";
import { markerToEvent, isValidCoordinates } from "@/utils/mapUtils";
import { Marker } from "@/hooks/useMapWebsocket";
import { ClusterFeature } from "@/hooks/useMarkerClustering";

type ActiveView = "none" | "details" | "share" | "search" | "camera" | "map";

// Add a new type to represent what's currently selected
type SelectedItemType = "marker" | "cluster" | null;

// Add information about the selected cluster
interface SelectedClusterInfo {
  id: string;
  count: number;
  coordinates: [number, number];
}

// Define a type for cluster input that can be either ClusterFeature or null
type ClusterInput = ClusterFeature | null;

interface LocationStoreState {
  // Marker data
  markers: Marker[];
  selectedMarkerId: string | null;
  selectedMarker: Marker | null;

  // Cluster data
  selectedItemType: SelectedItemType;
  selectedCluster: SelectedClusterInfo | null;

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
  selectMarker: (markerId: string | null) => void;

  // Cluster operations
  selectCluster: (cluster: ClusterInput) => void;

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
  selectedMarkerId: null,
  selectedMarker: null,

  // Initial cluster state
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

      return {
        markers,
        // Deselect if marker no longer exists
        selectedMarkerId: selectedExists ? state.selectedMarkerId : null,
        selectedMarker: newSelectedMarker,
        // Clear cluster selection when markers are updated
        selectedItemType: selectedExists ? "marker" : null,
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

      return {
        markers: newMarkers,
        selectedMarker: updatedSelectedMarker,
      };
    }),

  deleteMarker: (markerId) =>
    set((state) => {
      return {
        markers: state.markers.filter((m) => m.id !== markerId),
        selectedMarkerId: state.selectedMarkerId === markerId ? null : state.selectedMarkerId,
        selectedMarker: state.selectedMarkerId === markerId ? null : state.selectedMarker,
        selectedItemType: state.selectedMarkerId === markerId ? null : state.selectedItemType,
      };
    }),

  selectMarker: (markerId) =>
    set((state) => {
      // Skip if trying to select the same marker that's already selected
      if (state.selectedMarkerId === markerId && state.selectedItemType === "marker") {
        return state; // No change needed
      }

      const selectedMarker = markerId ? state.markers.find((m) => m.id === markerId) || null : null;

      return {
        selectedMarkerId: markerId,
        selectedMarker: selectedMarker,
        // Set item type to marker, and clear any cluster selection
        selectedItemType: markerId ? "marker" : null,
        // selectedCluster: null,
      };
    }),

  // Function to handle cluster selection with improved type handling
  selectCluster: (cluster) =>
    set((state) => {
      if (!cluster) {
        return {
          selectedCluster: null,
          selectedItemType: null,
          // Clear marker selection when deselecting a cluster
          selectedMarkerId: null,
          selectedMarker: null,
        };
      }

      // Extract cluster information
      const clusterId = `cluster-${cluster.properties.cluster_id}`;
      const count = cluster.properties.point_count;
      const coordinates = cluster.geometry.coordinates;

      return {
        // Store cluster information
        selectedCluster: {
          id: clusterId,
          count: count,
          coordinates: coordinates,
        },
        // Set item type to cluster, and clear any marker selection
        selectedItemType: "cluster",
        selectedMarkerId: null,
        selectedMarker: null,
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
      const { selectMarker, closeMapView } = get();

      // Close map view
      closeMapView();

      // Select the marker to update both marker and event state
      if (marker.id) {
        selectMarker(marker.id);
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
