// EventAssistantWithStores.tsx - Complete refactored version with all Zustand stores
import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Stores
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";

// Components
import { ActionBar } from "./ActionBar";
import { EventDetailsView } from "./EventDetailsView";
import { FloatingEmojiWithStore } from "./FloatingEmoji";
import { MessageBubble } from "./MessageBubble";
import { ScanView } from "./ScanView";
import { SearchView } from "./SearchView";
import { ShareView } from "./ShareView";
import { styles } from "./styles";
import { EventType } from "./types";

const EventAssistantWithStores: React.FC = () => {
  const insets = useSafeAreaInsets();

  // Local UI state
  const [containerLayout, setContainerLayout] = useState<{ width: number; height: number } | null>(
    null
  );

  // Get state and actions from the Zustand stores
  const {
    currentEvent,
    showActions,
    setShowActions,
    messageIndex,
    setMessageIndex,
    transitionMessage,
    setTransitionMessage,

    // View states
    activeView,
    detailsViewVisible,
    shareViewVisible,
    searchViewVisible,
    scanViewVisible,

    // View handlers
    closeDetailsView,
    closeShareView,
    closeSearchView,
    closeScanView,

    // Action handlers
    shareEvent,
    openMaps,
    handleScannedEvent,
    handleSelectEventFromSearch,
    handleActionPress,
  } = useEventAssistantStore();

  const { currentStreamedText, isTyping, simulateTextStreaming } = useTextStreamingStore();

  // Returns an array of messages for the event
  const getMessages = (event: EventType) => [
    `I found an event near you!`,
    `${event.title} at ${event.location}.`,
    `It's ${event.distance} from your current location.`,
    `Would you like to check it out?`,
  ];

  // Initialize message sequence on mount
  useEffect(() => {
    startMessageSequence();
  }, []);

  // Handle message sequencing
  useEffect(() => {
    const messages = getMessages(currentEvent);
    if (!isTyping && messageIndex < messages.length - 1) {
      const timer = setTimeout(() => {
        setMessageIndex(messageIndex + 1);
        simulateTextStreaming(messages[messageIndex + 1]);
      }, 800);
      return () => clearTimeout(timer);
    } else if (!isTyping && messageIndex === messages.length - 1 && !showActions) {
      const timer = setTimeout(() => {
        setShowActions(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isTyping, messageIndex, currentEvent, showActions]);

  // Start the initial message sequence
  const startMessageSequence = () => {
    const messages = getMessages(currentEvent);
    simulateTextStreaming(messages[0]);
  };

  // Handle action button presses
  const onActionPress = (action: string) => {
    handleActionPress(action, simulateTextStreaming);
  };

  // Layout event handlers
  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerLayout({ width, height });
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Event Details View - Positioned above the assistant */}
      {activeView === "details" && (
        <EventDetailsView
          isVisible={detailsViewVisible}
          event={currentEvent}
          onClose={closeDetailsView}
          onShare={shareEvent}
          onGetDirections={() => openMaps(currentEvent.location)}
        />
      )}

      {/* Share View - Positioned above the assistant */}
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
              currentEvent={currentEvent}
              currentStreamedText={transitionMessage || currentStreamedText}
              isTyping={isTyping && !transitionMessage}
              messageIndex={messageIndex}
              isTransitioning={!!transitionMessage}
            />
          </View>
          <ActionBar onActionPress={onActionPress} />
        </View>
      </View>
    </View>
  );
};

export default EventAssistantWithStores;
