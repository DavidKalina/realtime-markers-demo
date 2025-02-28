// useEventAssistantStore.ts - Updated to handle enhanced event types and map integration
import { create } from "zustand";
import * as Linking from "expo-linking";
import { EventType, MapboxViewport, Marker } from "@/components/RefactoredAssistant/types";
import { eventToMarker, markerToEvent } from "@/components/RefactoredAssistant/mapUtils";
import { eventSuggestions } from "@/components/RefactoredAssistant/data";

type ActiveView = "none" | "details" | "share" | "search" | "camera" | "map";

interface EventAssistantState {
  // Event data
  events: EventType[];
  markers: Marker[];
  currentEventIndex: number;
  currentEvent: EventType;

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

  // Event navigation
  navigateToNext: () => void;
  navigateToPrevious: () => void;
  setCurrentEvent: (event: EventType) => void;
  setCurrentEventById: (id: string) => void;
  setEvents: (events: EventType[]) => void;
  addEvent: (event: EventType) => void;
  updateEvent: (event: EventType) => void;

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
  handleScannedEvent: (event: EventType) => void;
  handleSelectEventFromSearch: (event: EventType) => void;
  handleSelectEventFromMap: (marker: Marker) => void;
  updateMapViewport: (viewport: MapboxViewport) => void;
  setConnectionStatus: (isConnected: boolean) => void;
}

export const useEventAssistantStore = create<EventAssistantState>((set, get) => ({
  // Initial event data
  events: eventSuggestions,
  markers: eventSuggestions
    .map(eventToMarker)
    .filter((marker): marker is Marker => marker !== null),
  currentEventIndex: 0,
  currentEvent: eventSuggestions[0],

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

  // Event navigation
  navigateToNext: () => {
    const { events, currentEventIndex } = get();
    if (currentEventIndex < events.length - 1) {
      const nextIndex = currentEventIndex + 1;
      set({
        currentEventIndex: nextIndex,
        currentEvent: events[nextIndex],
      });
    }
  },

  navigateToPrevious: () => {
    const { events, currentEventIndex } = get();
    if (currentEventIndex > 0) {
      const prevIndex = currentEventIndex - 1;
      set({
        currentEventIndex: prevIndex,
        currentEvent: events[prevIndex],
      });
    }
  },

  setCurrentEvent: (event: EventType) => {
    set({ currentEvent: event });

    // Also update the currentEventIndex if the event exists in the array
    const { events } = get();
    const index = events.findIndex((e) => e.id === event.id);
    if (index !== -1) {
      set({ currentEventIndex: index });
    }
  },

  setCurrentEventById: (id: string) => {
    const { events } = get();
    const index = events.findIndex((event) => event.id === id);
    if (index !== -1) {
      set({
        currentEventIndex: index,
        currentEvent: events[index],
      });
    }
  },

  setEvents: (events: EventType[]) => {
    // Update both events and markers
    const markers = events.map(eventToMarker).filter((marker): marker is Marker => marker !== null);

    set({ events, markers });

    // Reset current event if needed
    if (events.length > 0) {
      set({
        currentEventIndex: 0,
        currentEvent: events[0],
      });
    }
  },

  addEvent: (event: EventType) => {
    // Ensure the event has an ID
    const newEvent = {
      ...event,
      id: event.id || `event-${Math.random().toString(36).substring(2, 9)}`,
    };

    // Add to events array
    set((state) => ({
      events: [...state.events, newEvent],
    }));

    // Add to markers if it has coordinates
    const marker = eventToMarker(newEvent);
    if (marker) {
      set((state) => ({
        markers: [...state.markers, marker],
      }));
    }
  },

  updateEvent: (event: EventType) => {
    // Update in events array
    set((state) => ({
      events: state.events.map((e) => (e.id === event.id ? event : e)),
    }));

    // Update in markers array
    const updatedMarker = eventToMarker(event);
    if (updatedMarker) {
      set((state) => ({
        markers: state.markers.map((m) => (m.id === event.id ? updatedMarker : m)),
      }));
    }

    // Update current event if it's the one being updated
    if (get().currentEvent.id === event.id) {
      set({ currentEvent: event });
    }
  },

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
    const { currentEvent } = get();

    // Try to use coordinates if available, otherwise fall back to location text
    if (currentEvent.coordinates) {
      const [longitude, latitude] = currentEvent.coordinates;
      const url = `https://maps.google.com/?q=${latitude},${longitude}`;
      Linking.openURL(url);
    } else {
      const encodedLocation = encodeURIComponent(location);
      const url = `https://maps.google.com/?q=${encodedLocation}`;
      Linking.openURL(url);
    }
  },

  handleScannedEvent: (event: EventType) => {
    const { addEvent, setCurrentEvent, openDetailsView } = get();

    // Add the new event to the list
    addEvent(event);

    // Set it as the current event
    setCurrentEvent(event);

    // Open the details view to show the scanned event
    openDetailsView();
  },

  handleSelectEventFromSearch: (event: EventType) => {
    const { setCurrentEvent, closeSearchView, openDetailsView } = get();

    // Set the selected event as current
    setCurrentEvent(event);

    // Close search and open details
    closeSearchView();
    openDetailsView();
  },

  handleSelectEventFromMap: (marker: Marker) => {
    const event = markerToEvent(marker);
    const { setCurrentEvent, closeMapView, openDetailsView } = get();

    // Set the selected event as current
    setCurrentEvent(event);

    // Close map and open details
    closeMapView();
    openDetailsView();
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
