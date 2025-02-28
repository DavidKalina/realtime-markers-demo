// hooks/useEventAssistantStore.ts - Modified to use only WebSocket data
import { create } from "zustand";
import * as Haptics from "expo-haptics";
import { EventType } from "@/components/Assistant/types";
import { Platform, Linking } from "react-native";

// Define view types
type ActiveView = "details" | "share" | "search" | "camera" | "directions" | null;

// Create a placeholder empty event for initial state
const emptyEvent: EventType = {
  emoji: "🔍",
  title: "Searching for events",
  description: "Looking for events in your area...",
  location: "Unknown location",
  time: "Unknown time",
  distance: "Unknown distance",
  categories: ["Search"],
};

interface EventAssistantState {
  // UI States
  showActions: boolean;
  setShowActions: (show: boolean) => void;

  messageIndex: number;
  setMessageIndex: (index: number) => void;

  transitionMessage: string | null;
  setTransitionMessage: (message: string | null) => void;

  // Events state management
  eventList: EventType[];
  setEventList: (events: EventType[]) => void;

  // Current event
  currentEvent: EventType;
  setCurrentEvent: (event: EventType) => void;
  navigateToNext: () => EventType;
  navigateToPrevious: () => EventType;

  // View management
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  detailsViewVisible: boolean;
  setDetailsViewVisible: (visible: boolean) => void;

  shareViewVisible: boolean;
  setShareViewVisible: (visible: boolean) => void;

  searchViewVisible: boolean;
  setSearchViewVisible: (visible: boolean) => void;

  scanViewVisible: boolean;
  setScanViewVisible: (visible: boolean) => void;

  // Action handlers
  openDetailsView: () => void;
  closeDetailsView: () => void;

  openShareView: () => void;
  closeShareView: () => void;

  openSearchView: () => void;
  closeSearchView: () => void;

  openScanView: () => void;
  closeScanView: () => void;

  shareEvent: () => void;
  openMaps: (location: string) => void;
  handleScannedEvent: (event: EventType) => void;
  handleSelectEventFromSearch: (event: EventType) => void;

  // Action bar handler
  handleActionPress: (action: string, simulateTextStreaming: (text: string) => void) => void;

  // Check if we have real events
  hasEvents: () => boolean;
}

export const useEventAssistantStore = create<EventAssistantState>((set, get) => {
  // Start with empty state instead of fallback data
  let currentIndex = 0;

  return {
    // UI States
    showActions: false,
    setShowActions: (show) => {
      console.log("🔘 setShowActions:", show);
      set({ showActions: show });
    },

    messageIndex: 0,
    setMessageIndex: (index) => {
      console.log("📋 setMessageIndex:", index);
      set({ messageIndex: index });
    },

    transitionMessage: null,
    setTransitionMessage: (message) => {
      console.log("💬 setTransitionMessage:", message);
      set({ transitionMessage: message });
    },

    // Events list management - start with empty list
    eventList: [],
    setEventList: (events) => {
      if (events && events.length > 0) {
        console.log("📊 setEventList:", events.length, "events");
        set({ eventList: events });
      }
    },

    // Current event - start with empty placeholder
    currentEvent: emptyEvent,
    setCurrentEvent: (event) => {
      if (event) {
        console.log("🎯 setCurrentEvent:", event.title);
        set({ currentEvent: event });
      }
    },

    // Helper to check if we have real events
    hasEvents: () => {
      const { eventList } = get();
      return eventList.length > 0;
    },

    // View management
    activeView: null,
    setActiveView: (view) => set({ activeView: view }),

    detailsViewVisible: false,
    setDetailsViewVisible: (visible) => set({ detailsViewVisible: visible }),

    shareViewVisible: false,
    setShareViewVisible: (visible) => set({ shareViewVisible: visible }),

    searchViewVisible: false,
    setSearchViewVisible: (visible) => set({ searchViewVisible: visible }),

    scanViewVisible: false,
    setScanViewVisible: (visible) => set({ scanViewVisible: visible }),

    // Navigation handlers - updated to use the dynamic eventList
    navigateToNext: () => {
      const { eventList, currentEvent } = get();

      // Handle empty event list
      if (!eventList || eventList.length === 0) {
        console.warn("Cannot navigate: event list is empty");
        return currentEvent;
      }

      try {
        // Find the current index in the event list
        let currentIndex = eventList.findIndex(
          (event) => event.title === currentEvent.title && event.location === currentEvent.location
        );

        // Calculate next index with proper wrapping
        const nextIndex =
          currentIndex === -1 || currentIndex === eventList.length - 1 ? 0 : currentIndex + 1;

        const nextEvent = eventList[nextIndex];

        if (nextEvent) {
          // Update the global current index
          currentIndex = nextIndex;
          set({ currentEvent: nextEvent });

          // Add visual feedback in console
          console.log(`📊 Navigated to next event: ${nextIndex + 1}/${eventList.length}`);

          return nextEvent;
        } else {
          console.warn(`Event at index ${nextIndex} is undefined`);
          return currentEvent;
        }
      } catch (error) {
        console.error("Error navigating to next event:", error);
        return currentEvent;
      }
    },

    navigateToPrevious: () => {
      const { eventList, currentEvent } = get();

      // Handle empty event list
      if (!eventList || eventList.length === 0) {
        console.warn("Cannot navigate: event list is empty");
        return currentEvent;
      }

      try {
        // Find the current index in the event list
        let currentIndex = eventList.findIndex(
          (event) => event.title === currentEvent.title && event.location === currentEvent.location
        );

        // Calculate previous index with proper wrapping
        const prevIndex =
          currentIndex === -1 || currentIndex === 0 ? eventList.length - 1 : currentIndex - 1;

        const prevEvent = eventList[prevIndex];

        if (prevEvent) {
          // Update the global current index
          currentIndex = prevIndex;
          set({ currentEvent: prevEvent });

          // Add visual feedback in console
          console.log(`📊 Navigated to previous event: ${prevIndex + 1}/${eventList.length}`);

          return prevEvent;
        } else {
          console.warn(`Event at index ${prevIndex} is undefined`);
          return currentEvent;
        }
      } catch (error) {
        console.error("Error navigating to previous event:", error);
        return currentEvent;
      }
    },

    // View handlers
    openDetailsView: () => {
      set({ activeView: "details", detailsViewVisible: true });
    },

    closeDetailsView: () => {
      set({ detailsViewVisible: false });
      setTimeout(() => {
        set({ activeView: null });
      }, 300);
    },

    openShareView: () => {
      set({ activeView: "share", shareViewVisible: true });
    },

    closeShareView: () => {
      set({ shareViewVisible: false });
      setTimeout(() => {
        set({ activeView: null });
      }, 300);
    },

    openSearchView: () => {
      set({ activeView: "search", searchViewVisible: true });
    },

    closeSearchView: () => {
      set({ searchViewVisible: false });
      setTimeout(() => {
        set({ activeView: null });
      }, 300);
    },

    openScanView: () => {
      set({ activeView: "camera", scanViewVisible: true });
    },

    closeScanView: () => {
      set({ scanViewVisible: false });
      setTimeout(() => {
        set({ activeView: null });
      }, 300);
    },

    // Action handlers
    shareEvent: async () => {
      try {
        // Trigger haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Show share view
        set({ activeView: "share", shareViewVisible: true });

        return true;
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return false;
      }
    },

    openMaps: (location: string) => {
      const encodedLocation = encodeURIComponent(location);
      const scheme = Platform.select({ ios: "maps:?q=", android: "geo:0,0?q=" });
      const url = Platform.select({
        ios: `maps:0,0?q=${encodedLocation}`,
        android: `geo:0,0?q=${encodedLocation}`,
      });

      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Linking.canOpenURL(url!)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(url!);
          } else {
            // Fallback to Google Maps web URL
            const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
            return Linking.openURL(webUrl);
          }
        })
        .catch((err) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          console.error("Couldn't open maps:", err.message);
        });
    },

    handleScannedEvent: (event: EventType) => {
      // Set the current event
      set({ currentEvent: event });

      // Close the scan view
      set({ scanViewVisible: false, activeView: null });

      // Show details for the scanned event
      setTimeout(() => {
        set({ activeView: "details", detailsViewVisible: true });
      }, 500);
    },

    handleSelectEventFromSearch: (event: EventType) => {
      // Set the current event
      set({ currentEvent: event });

      // Close the search view
      set({ searchViewVisible: false, activeView: null });

      // Show details for the selected event
      setTimeout(() => {
        set({ activeView: "details", detailsViewVisible: true });
      }, 500);
    },

    // Action bar handler
    handleActionPress: (action: string, simulateTextStreaming: (text: string) => void) => {
      const state = get();

      set({ showActions: false });

      // Check if we have events to handle first
      if ((action === "next" || action === "previous") && !state.hasEvents()) {
        simulateTextStreaming("I don't see any events in this area yet. Try exploring the map!");
        setTimeout(() => set({ showActions: true }), 2000);
        return;
      }

      if (action === "details") {
        // Show transition message first
        set({ transitionMessage: "Opening event details..." });

        // Short delay to allow the message to be seen
        setTimeout(() => {
          set({ activeView: "details", detailsViewVisible: true });

          // Clear the transition message after the view appears
          setTimeout(() => {
            set({ transitionMessage: null });
          }, 300);

          simulateTextStreaming("I've pulled up the event details for you.");
        }, 800);
      } else if (action === "directions") {
        set({ transitionMessage: "Opening maps..." });
        setTimeout(() => {
          set({ activeView: "directions", detailsViewVisible: true });
          setTimeout(() => {
            set({ transitionMessage: null });
          }, 300);
        }, 800);
      } else if (action === "share") {
        set({ transitionMessage: "Preparing to share..." });
        setTimeout(() => {
          state.shareEvent();
          setTimeout(() => {
            set({ transitionMessage: null });
          }, 300);
          simulateTextStreaming(`Creating shareable link for "${state.currentEvent.title}"...`);
        }, 800);
      } else if (action === "search") {
        set({ transitionMessage: "Opening search..." });
        setTimeout(() => {
          set({ activeView: "search", searchViewVisible: true });
          setTimeout(() => {
            set({ transitionMessage: null });
          }, 300);
          simulateTextStreaming("I've pulled up the search view for you.");
        }, 800);
      } else if (action === "camera") {
        set({ transitionMessage: "Opening scanner..." });
        setTimeout(() => {
          set({ activeView: "camera", scanViewVisible: true });
          setTimeout(() => {
            set({ transitionMessage: null });
          }, 300);
        }, 800);
      } else if (action === "next") {
        set({ transitionMessage: "Finding next event..." });
        set({ messageIndex: 0 });
        const nextEvent = state.navigateToNext();

        // Get the list of events for context
        const { eventList } = state;
        const currentIndex = eventList.findIndex(
          (event) => event.title === nextEvent.title && event.location === nextEvent.location
        );

        setTimeout(() => {
          set({ transitionMessage: null });

          // Enhanced message with event number and total count
          simulateTextStreaming(
            `Event ${currentIndex + 1} of ${eventList.length}: ${nextEvent.emoji} ${
              nextEvent.title
            }`
          );
        }, 800);
      } else if (action === "previous") {
        set({ transitionMessage: "Finding previous event..." });
        set({ messageIndex: 0 });
        const prevEvent = state.navigateToPrevious();

        // Get the list of events for context
        const { eventList } = state;
        const currentIndex = eventList.findIndex(
          (event) => event.title === prevEvent.title && event.location === prevEvent.location
        );

        setTimeout(() => {
          set({ transitionMessage: null });

          // Enhanced message with event number and total count
          simulateTextStreaming(
            `Event ${currentIndex + 1} of ${eventList.length}: ${prevEvent.emoji} ${
              prevEvent.title
            }`
          );
        }, 800);
      } else {
        simulateTextStreaming(`What would you like to know about this event?`);
      }
    },
  };
});
