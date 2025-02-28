// hooks/useEventAssistantStore.ts
import { create } from "zustand";
import * as Haptics from "expo-haptics";
import { EventType } from "@/components/Assistant/types";
import { eventSuggestions } from "@/components/Assistant/data";
import { Platform, Linking } from "react-native";

// Define view types
type ActiveView = "details" | "share" | "search" | "camera" | "directions" | null;

interface EventAssistantState {
  // UI States
  showActions: boolean;
  setShowActions: (show: boolean) => void;

  messageIndex: number;
  setMessageIndex: (index: number) => void;

  transitionMessage: string | null;
  setTransitionMessage: (message: string | null) => void;

  // Current event
  currentEvent: EventType;
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
}

export const useEventAssistantStore = create<EventAssistantState>((set, get) => {
  // Initial state
  const initialEvent = eventSuggestions[0];
  let currentIndex = 0;

  return {
    // UI States
    showActions: false,
    setShowActions: (show) => set({ showActions: show }),

    messageIndex: 0,
    setMessageIndex: (index) => set({ messageIndex: index }),

    transitionMessage: null,
    setTransitionMessage: (message) => set({ transitionMessage: message }),

    // Current event
    currentEvent: initialEvent,

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

    // Navigation handlers
    navigateToNext: () => {
      currentIndex = (currentIndex + 1) % eventSuggestions.length;
      const nextEvent = eventSuggestions[currentIndex];
      set({ currentEvent: nextEvent });
      return nextEvent;
    },

    navigateToPrevious: () => {
      currentIndex = (currentIndex - 1 + eventSuggestions.length) % eventSuggestions.length;
      const prevEvent = eventSuggestions[currentIndex];
      set({ currentEvent: prevEvent });
      return prevEvent;
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

          simulateTextStreaming("I've pulled up the events view for you.");
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
        setTimeout(() => {
          set({ transitionMessage: null });
          simulateTextStreaming(`I found an event near you!`);
        }, 800);
      } else if (action === "previous") {
        set({ transitionMessage: "Finding previous event..." });
        set({ messageIndex: 0 });
        const prevEvent = state.navigateToPrevious();
        setTimeout(() => {
          set({ transitionMessage: null });
          simulateTextStreaming(`I found an event near you!`);
        }, 800);
      } else {
        simulateTextStreaming(`What would you like to know about this event?`);
      }
    },
  };
});
