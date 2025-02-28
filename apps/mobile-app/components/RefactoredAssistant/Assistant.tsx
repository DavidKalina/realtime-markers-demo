// components/RefactoredAssistant/Assistant.tsx - Updated with event broker
import React, { useState, useEffect } from "react";
import { View, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Event Broker
import { eventBroker, EventTypes, BaseEvent, MarkerEvent } from "@/services/EventBroker";

// Stores
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";

// Hooks
import { useEventDrivenMessaging } from "@/hooks/useEventDrivenMessaging";
import { useEventBroker } from "@/hooks/useEventBroker";

// Components
import { ActionBar } from "./ActionBar";
import { EventDetailsView } from "./EventDetailsView";
import { MessageBubble } from "./MessageBubble";
import { ScanView } from "./ScanView";
import { SearchView } from "./SearchView";
import { ShareView } from "./ShareView";
import { styles } from "./styles";
import ConnectionIndicator from "./ConnectionIndicator";
import { FloatingEmojiWithStore } from "./FloatingEmoji";

const EventDrivenAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { publish, subscribe } = useEventBroker();

  // Local UI state
  const [containerLayout, setContainerLayout] = useState<{ width: number; height: number } | null>(
    null
  );

  // Use our new event-driven messaging hook
  const { currentStreamedText, isTyping } = useEventDrivenMessaging();

  // Track connection status and marker count for the connection indicator
  const [isConnected, setIsConnected] = useState(false);
  const [markersCount, setMarkersCount] = useState(0);

  // Get state and actions from the Zustand store
  const {
    currentEvent,
    showActions,

    // View states
    activeView,
    detailsViewVisible,
    shareViewVisible,
    searchViewVisible,
    scanViewVisible,

    // View handlers
    openDetailsView,
    closeDetailsView,
    openShareView,
    closeShareView,
    openSearchView,
    closeSearchView,
    openScanView,
    closeScanView,

    // Action handlers
    shareEvent,
    openMaps,
    handleScannedEvent,
    handleSelectEventFromSearch,
    navigateToNext,
    navigateToPrevious,
  } = useEventAssistantStore();

  // Subscribe to websocket connection events
  useEffect(() => {
    const unsubscribeConnected = subscribe<BaseEvent>(EventTypes.WEBSOCKET_CONNECTED, () => {
      setIsConnected(true);
    });

    const unsubscribeDisconnected = subscribe<BaseEvent>(EventTypes.WEBSOCKET_DISCONNECTED, () => {
      setIsConnected(false);
    });

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
  }, [subscribe]);

  // Subscribe to marker updates for count
  useEffect(() => {
    const unsubscribe = subscribe<BaseEvent & { markers: any[]; count: number }>(
      EventTypes.MARKERS_UPDATED,
      (eventData) => {
        setMarkersCount(eventData.count);
      }
    );

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to marker selection to update current event
  useEffect(() => {
    const unsubscribe = subscribe<MarkerEvent>(EventTypes.MARKER_SELECTED, (event) => {
      // Extract event data from marker and set as current event
      if (event.markerData && event.markerData.data) {
        const newEventData = {
          id: event.markerData.id,
          coordinates: event.markerData.coordinates,
          ...event.markerData.data,
        };
        // Use the store's setCurrentEvent function
        // This assumes the markerData contains all the fields needed for an event
        useEventAssistantStore.getState().setCurrentEvent(newEventData);
      }
    });

    return unsubscribe;
  }, []);

  // Handle action button presses by emitting events
  const onActionPress = (action: string) => {
    if (action === "details") {
      openDetailsView();
      publish<BaseEvent>(EventTypes.OPEN_DETAILS, {
        timestamp: Date.now(),
        source: "EventDrivenAssistant",
      });
    } else if (action === "share") {
      openShareView();
      publish<BaseEvent>(EventTypes.OPEN_SHARE, {
        timestamp: Date.now(),
        source: "EventDrivenAssistant",
      });
    } else if (action === "search") {
      openSearchView();
      publish<BaseEvent>(EventTypes.OPEN_SEARCH, {
        timestamp: Date.now(),
        source: "EventDrivenAssistant",
      });
    } else if (action === "camera") {
      openScanView();
      publish<BaseEvent>(EventTypes.OPEN_SCAN, {
        timestamp: Date.now(),
        source: "EventDrivenAssistant",
      });
    } else if (action === "next") {
      navigateToNext();
      publish<BaseEvent>(EventTypes.NEXT_EVENT, {
        timestamp: Date.now(),
        source: "EventDrivenAssistant",
      });
    } else if (action === "previous") {
      navigateToPrevious();
      publish<BaseEvent>(EventTypes.PREVIOUS_EVENT, {
        timestamp: Date.now(),
        source: "EventDrivenAssistant",
      });
    }
  };

  // Close view handlers with event publishing
  const handleCloseDetailsView = () => {
    closeDetailsView();
    publish<BaseEvent>(EventTypes.CLOSE_VIEW, {
      timestamp: Date.now(),
      source: "EventDrivenAssistant",
    });
  };

  const handleCloseShareView = () => {
    closeShareView();
    publish<BaseEvent>(EventTypes.CLOSE_VIEW, {
      timestamp: Date.now(),
      source: "EventDrivenAssistant",
    });
  };

  const handleCloseSearchView = () => {
    closeSearchView();
    publish<BaseEvent>(EventTypes.CLOSE_VIEW, {
      timestamp: Date.now(),
      source: "EventDrivenAssistant",
    });
  };

  const handleCloseScanView = () => {
    closeScanView();
    publish<BaseEvent>(EventTypes.CLOSE_VIEW, {
      timestamp: Date.now(),
      source: "EventDrivenAssistant",
    });
  };

  // Layout event handlers
  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerLayout({ width, height });
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Connection Indicator with actual connection state */}
      <ConnectionIndicator isConnected={isConnected} eventsCount={markersCount} />

      {/* Event Details View */}
      {activeView === "details" && (
        <EventDetailsView
          isVisible={detailsViewVisible}
          event={currentEvent}
          onClose={handleCloseDetailsView}
          onShare={shareEvent}
          onGetDirections={() => openMaps(currentEvent.location)}
        />
      )}

      {/* Share View */}
      {activeView === "share" && (
        <ShareView
          isVisible={shareViewVisible}
          event={currentEvent}
          onClose={handleCloseShareView}
        />
      )}

      {/* Search View */}
      {activeView === "search" && (
        <SearchView
          isVisible={searchViewVisible}
          onClose={handleCloseSearchView}
          onSelectEvent={handleSelectEventFromSearch}
        />
      )}

      {/* Scan View */}
      {activeView === "camera" && (
        <ScanView
          isVisible={scanViewVisible}
          onClose={handleCloseScanView}
          onScanComplete={handleScannedEvent}
        />
      )}

      {/* Main assistant UI - Always visible at the bottom */}
      <View style={styles.innerContainer} onLayout={handleLayout}>
        <View style={styles.card}>
          <View style={styles.row}>
            <FloatingEmojiWithStore emoji={currentEvent.emoji} />
            <MessageBubble
              message={
                currentStreamedText ||
                "Hello! I'm your event assistant. I can help you discover events nearby."
              }
              isTyping={isTyping}
            />
          </View>
          <ActionBar onActionPress={onActionPress} />
        </View>
      </View>
    </View>
  );
};

export default EventDrivenAssistant;
