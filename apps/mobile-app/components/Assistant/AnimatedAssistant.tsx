// EventAssistantPreview.tsx - Updated with ShareView integration
import React, { useEffect, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, View, Linking, Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { useEventNavigation } from "@/hooks/useEventNavigation";
import { useFloatingEmoji } from "@/hooks/useFloatingEmoji";
import { useTextStreaming } from "@/hooks/useTextStreaming";
import { eventSuggestions } from "./data";
import { FloatingEmoji } from "./FloatingEmoji";
import { ActionBar } from "./ActionBar";
import { MessageBubble } from "./MessageBubble";
import { EventDetailsView } from "./EventDetailsView";
import { styles } from "./styles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchView } from "./SearchView";
import { ShareView } from "./ShareView"; // Import the updated ShareView
import { EventType } from "./types";
import { ScanView } from "./ScanView";

// Define view types
type ActiveView = "details" | "share" | "search" | "camera" | "directions" | null;

const EventAssistantPreview: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [showActions, setShowActions] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [containerLayout, setContainerLayout] = useState<{ width: number; height: number } | null>(
    null
  );
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);

  const [scanViewVisible, setScanViewVisible] = useState(false);

  // View management states
  const [detailsViewVisible, setDetailsViewVisible] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [searchViewVisible, setSearchViewVisible] = useState(false);
  const [shareViewVisible, setShareViewVisible] = useState(false); // Add share view state

  const { currentStreamedText, isTyping, simulateTextStreaming } = useTextStreaming();
  const { currentEvent, navigateToNext, navigateToPrevious } = useEventNavigation(
    eventSuggestions[0]
  );
  const { updateManualPosition } = useFloatingEmoji();

  // Returns an array of messages for the event
  const getMessages = (event: typeof currentEvent) => [
    `I found an event near you!`,
    `${event.title} at ${event.location}.`,
    `It's ${event.distance} from your current location.`,
    `Would you like to check it out?`,
  ];

  useEffect(() => {
    startMessageSequence();
  }, []);

  useEffect(() => {
    const messages = getMessages(currentEvent);
    if (!isTyping && messageIndex < messages.length - 1) {
      const timer = setTimeout(() => {
        setMessageIndex((prev) => prev + 1);
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

  const startMessageSequence = () => {
    const messages = getMessages(currentEvent);
    simulateTextStreaming(messages[0]);
  };

  // Close active views
  const closeDetailsView = () => {
    setDetailsViewVisible(false);
    setTimeout(() => {
      setActiveView(null);
    }, 300);
  };

  const closeShareView = () => {
    setShareViewVisible(false);
    setTimeout(() => {
      setActiveView(null);
    }, 300);
  };

  const closeSearchView = () => {
    setSearchViewVisible(false);
    setTimeout(() => {
      setActiveView(null);
    }, 300);
  };

  // Open location in maps app
  const openMaps = (location: string) => {
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
        simulateTextStreaming(`Couldn't open maps: ${err.message}`);
      });
  };

  // Share event with contacts
  const shareEvent = async () => {
    try {
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show share view - updated to use the new consistent UI
      setActiveView("share");
      setShareViewVisible(true);

      simulateTextStreaming(`Creating shareable link for "${currentEvent.title}"...`);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      simulateTextStreaming("There was an error preparing to share this event.");
    }
  };

  const closeScanView = () => {
    setScanViewVisible(false);
    setTimeout(() => {
      setActiveView(null);
    }, 300);
  };

  // Add handler for selecting scanned event
  const handleScannedEvent = (event: EventType) => {
    // Set the current event

    // Close the scan view
    setScanViewVisible(false);
    setActiveView(null);

    // Show details for the scanned event
    setTimeout(() => {
      setActiveView("details");
      setDetailsViewVisible(true);
      simulateTextStreaming(`I found details about "${event.title}"`);
    }, 500);
  };

  // Navigate to camera screen
  const navigateToCamera = () => {
    // Trigger haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Show camera view
    setActiveView("camera");
    setDetailsViewVisible(true);

    simulateTextStreaming(`Opening camera to scan event QR codes or posters...`);
  };

  // Add a handler for selecting an event from search:
  const handleSelectEventFromSearch = (event: EventType) => {
    // Set the current event
    // If you're using a state management system, update the current event

    // Close the search view
    setSearchViewVisible(false);
    setActiveView(null);

    // Show details for the selected event
    setTimeout(() => {
      setActiveView("details");
      setDetailsViewVisible(true);
    }, 500);
  };

  const handleActionPress = (action: string) => {
    setShowActions(false);

    if (action === "details") {
      // Show transition message first
      setTransitionMessage("Opening event details...");

      // Short delay to allow the message to be seen
      setTimeout(() => {
        setActiveView("details");
        setDetailsViewVisible(true);
        // Clear the transition message after the view appears
        setTimeout(() => {
          setTransitionMessage(null);
        }, 300);
        simulateTextStreaming("I've pulled up the events view for you.");
      }, 800);
    } else if (action === "directions") {
      setTransitionMessage("Opening maps...");
      setTimeout(() => {
        setActiveView("directions");
        setDetailsViewVisible(true);
        setTimeout(() => {
          setTransitionMessage(null);
        }, 300);
      }, 800);
    } else if (action === "share") {
      setTransitionMessage("Preparing to share...");
      setTimeout(() => {
        shareEvent();
        setTimeout(() => {
          setTransitionMessage(null);
        }, 300);
      }, 800);
    } else if (action === "search") {
      setTransitionMessage("Opening search...");
      setTimeout(() => {
        setActiveView("search");
        setSearchViewVisible(true);
        setTimeout(() => {
          setTransitionMessage(null);
        }, 300);
        simulateTextStreaming("I've pulled up the search view for you.");
      }, 800);
    } else if (action === "camera") {
      setTransitionMessage("Opening scanner...");
      setTimeout(() => {
        setActiveView("camera");
        setScanViewVisible(true);
        setTimeout(() => {
          setTransitionMessage(null);
        }, 300);
      }, 800);
    } else if (action === "next") {
      setTransitionMessage("Finding next event...");
      setMessageIndex(0);
      const nextEvent = navigateToNext();
      setTimeout(() => {
        const messages = getMessages(nextEvent);
        simulateTextStreaming(messages[0]);
        setTransitionMessage(null);
      }, 800);
    } else if (action === "previous") {
      setTransitionMessage("Finding previous event...");
      setMessageIndex(0);
      const prevEvent = navigateToPrevious();
      setTimeout(() => {
        const messages = getMessages(prevEvent);
        simulateTextStreaming(messages[0]);
        setTransitionMessage(null);
      }, 800);
    } else {
      simulateTextStreaming(`What would you like to know about this event?`);
    }
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerLayout({ width, height });
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (!containerLayout) return;
    const { locationX, locationY } = e.nativeEvent;
    const centerX = containerLayout.width / 2;
    const centerY = containerLayout.height / 2;
    const dx = (locationX - centerX) / 100;
    const dy = (locationY - centerY) / 100;
    updateManualPosition(dx, dy);
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

      {/* Share View - Positioned above the assistant, using the same conventions */}
      {activeView === "share" && (
        <ShareView isVisible={shareViewVisible} event={currentEvent} onClose={closeShareView} />
      )}

      {activeView === "search" && (
        <SearchView
          isVisible={searchViewVisible}
          onClose={closeSearchView}
          onSelectEvent={handleSelectEventFromSearch}
        />
      )}

      {activeView === "camera" && (
        <ScanView
          isVisible={scanViewVisible}
          onClose={closeScanView}
          onScanComplete={handleScannedEvent}
        />
      )}

      {/* Main assistant UI - Always visible at the bottom */}
      <View style={styles.innerContainer} onLayout={handleLayout} onTouchMove={handleTouchMove}>
        <View style={styles.card}>
          <View style={styles.row}>
            <FloatingEmoji onTouchMove={updateManualPosition} emoji={currentEvent.emoji} />
            <MessageBubble
              currentEvent={currentEvent}
              currentStreamedText={transitionMessage || currentStreamedText}
              isTyping={isTyping && !transitionMessage}
              messageIndex={messageIndex}
              isTransitioning={!!transitionMessage}
            />
          </View>
          <ActionBar onActionPress={handleActionPress} />
        </View>
      </View>
    </View>
  );
};

export default EventAssistantPreview;
