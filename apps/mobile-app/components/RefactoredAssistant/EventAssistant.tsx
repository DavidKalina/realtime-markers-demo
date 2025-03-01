import React, { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";
import { useEventBroker } from "@/hooks/useEventBroker";
import { ActionBar } from "./ActionBar";
import ConnectionIndicator from "./ConnectionIndicator";
import { EventDetailsView } from "./EventDetailsView";
import { FloatingEmojiWithStore } from "./FloatingEmoji";
import { MessageBubble } from "./MessageBubble";
import { ScanView } from "./ScanView";
import { SearchView } from "./SearchView";
import { ShareView } from "./ShareView";
import { styles } from "./styles";

const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [markersCount, setMarkersCount] = useState(0);

  const {
    currentEvent,

    activeView,
    detailsViewVisible,
    shareViewVisible,
    searchViewVisible,
    scanViewVisible,

    openDetailsView,
    closeDetailsView,
    openShareView,
    closeShareView,
    openSearchView,
    closeSearchView,
    openScanView,
    closeScanView,

    shareEvent,
    openMaps,
    handleScannedEvent,
    handleSelectEventFromSearch,
    navigateToNext,
    navigateToPrevious,
  } = useEventAssistantStore();

  // Handle action button presses by emitting events
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

  // Close view handlers with event publishing
  const handleCloseDetailsView = () => {
    closeDetailsView();
  };

  const handleCloseShareView = () => {
    closeShareView();
  };

  const handleCloseSearchView = () => {
    closeSearchView();
  };

  const handleCloseScanView = () => {
    closeScanView();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Connection Indicator with actual connection state */}
      <ConnectionIndicator eventsCount={markersCount} />

      {/* Event Details View */}
      {activeView === "details" && (
        <EventDetailsView
          isVisible={detailsViewVisible}
          eventId={currentEvent.id ?? ""}
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

      <View style={styles.innerContainer}>
        <View style={styles.card}>
          <View style={styles.row}>
            <FloatingEmojiWithStore />
            <MessageBubble message={""} isTyping={false} />
          </View>
          <ActionBar onActionPress={onActionPress} />
        </View>
      </View>
    </View>
  );
};

export default EventAssistant;
