import React, { useState, useEffect } from "react";
import { View, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Stores
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";

// Hooks
import { useEventDrivenMessaging } from "@/hooks/useEventDrivenMessaging";

// Types
import { MapboxViewport } from "@/components/RefactoredAssistant/types";

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

// Define the WebSocketMarker interface to match what comes from useMapWebSocket
interface WebSocketMarker {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  data: {
    title: string;
    emoji: string;
    color: string;
    description?: string;
    location?: string;
    distance?: string;
    time?: string;
    categories?: string[];
    isVerified?: boolean;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
  };
}

interface EventDrivenAssistantProps {
  markers: WebSocketMarker[];
  isConnected: boolean;
  currentViewport: MapboxViewport | null;
}

const EventDrivenAssistant: React.FC<EventDrivenAssistantProps> = ({
  markers,
  isConnected,
  currentViewport,
}) => {
  const insets = useSafeAreaInsets();

  // Local UI state
  const [containerLayout, setContainerLayout] = useState<{ width: number; height: number } | null>(
    null
  );

  // Log markers for debugging
  useEffect(() => {
    console.log(`EventDrivenAssistant received ${markers.length} markers`);
  }, [markers.length]);

  // Get state and actions from the Zustand store
  const {
    currentEvent,
    showActions,
    setShowActions,

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

  // Use the event-driven messaging hook to get dynamic messages
  const { currentStreamedText, isTyping } = useEventDrivenMessaging({
    markers,
    isConnected,
    currentViewport,
  });

  // Handle action button presses
  const onActionPress = (action: string) => {
    if (action === "details") {
      openDetailsView();
    } else if (action === "share") {
      openShareView();
    } else if (action === "search") {
      openSearchView();
    } else if (action === "camera") {
      openScanView();
    } else if (action === "next") {
      navigateToNext();
    } else if (action === "previous") {
      navigateToPrevious();
    }
  };

  // Layout event handlers
  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerLayout({ width, height });
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Connection Indicator with actual connection state */}
      <ConnectionIndicator isConnected={isConnected} eventsCount={markers.length} />

      {/* Event Details View */}
      {activeView === "details" && (
        <EventDetailsView
          isVisible={detailsViewVisible}
          event={currentEvent}
          onClose={closeDetailsView}
          onShare={shareEvent}
          onGetDirections={() => openMaps(currentEvent.location)}
        />
      )}

      {/* Share View */}
      {activeView === "share" && (
        <ShareView isVisible={shareViewVisible} event={currentEvent} onClose={closeShareView} />
      )}

      {/* Search View */}
      {activeView === "search" && (
        <SearchView
          isVisible={searchViewVisible}
          onClose={closeSearchView}
          onSelectEvent={handleSelectEventFromSearch}
        />
      )}

      {/* Scan View */}
      {activeView === "camera" && (
        <ScanView
          isVisible={scanViewVisible}
          onClose={closeScanView}
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
