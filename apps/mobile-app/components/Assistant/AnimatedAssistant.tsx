// EventAssistantPreview.tsx
import * as Contacts from "expo-contacts";
import React, { useEffect, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, Linking, Platform, View } from "react-native";
import { styles } from "./styles";
import * as Haptics from "expo-haptics";
import { useEventNavigation } from "@/hooks/useEventNavigation";
import { useFloatingEmoji } from "@/hooks/useFloatingEmoji";
import { useTextStreaming } from "@/hooks/useTextStreaming";
import { eventSuggestions } from "./data";
import { FloatingEmoji } from "./FloatingEmoji";
import { MessageBubble } from "./MessageBubble";
import { ActionBar } from "./ActionBar";

const EventAssistantPreview: React.FC = () => {
  const [showActions, setShowActions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [containerLayout, setContainerLayout] = useState<{ width: number; height: number } | null>(
    null
  );

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
      const { status } = await Contacts.requestPermissionsAsync();

      if (status === "granted") {
        // In a real app, you would open the contacts picker or share sheet here
        // For this demo, we'll just simulate the behavior
        simulateTextStreaming(`Creating shareable link for "${currentEvent.title}"...`);

        // Create event details for sharing
        const eventDetails = `
          Event: ${currentEvent.title}
          Where: ${currentEvent.location}
          When: ${currentEvent.time}
          Description: ${currentEvent.description}
        `;

        // In a real app, you would use Share API or a deep link
        // For this demo, we'll simulate successful sharing after a delay
        setTimeout(() => {
          simulateTextStreaming(`Event details ready to share! You can now select contacts.`);
        }, 1000);
      } else {
        simulateTextStreaming("Contact permissions are needed to share this event.");
      }
    } catch (error) {
      simulateTextStreaming("There was an error preparing to share this event.");
    }
  };

  // Navigate to camera screen
  const navigateToCamera = () => {
    // In a real app, this would use navigation to go to the camera screen
    simulateTextStreaming(`Opening camera to scan event QR codes or posters...`);

    // Simulate navigation delay
    setTimeout(() => {
      simulateTextStreaming(`Camera activated. Point at an event QR code to scan.`);
    }, 1000);
  };

  // Navigate to event details screen
  const navigateToEventDetails = () => {
    // In a real app, this would use navigation to go to the event details screen
    setShowDetails(true);
    simulateTextStreaming(`Here are more details about ${currentEvent.title}.`);
  };

  const handleActionPress = (action: string) => {
    setShowActions(false);

    if (action === "details") {
      navigateToEventDetails();
    } else if (action === "directions") {
      openMaps(currentEvent.location);
      simulateTextStreaming(`Opening maps to ${currentEvent.location}...`);
    } else if (action === "share") {
      shareEvent();
    } else if (action === "search") {
      simulateTextStreaming(`What type of events are you looking for?`);
      // In a real app, this would navigate to a search screen
    } else if (action === "camera") {
      navigateToCamera();
    } else if (action === "next") {
      setShowDetails(false);
      setMessageIndex(0);
      const nextEvent = navigateToNext();
      setTimeout(() => {
        const messages = getMessages(nextEvent);
        simulateTextStreaming(messages[0]);
      }, 300);
    } else if (action === "previous") {
      setShowDetails(false);
      setMessageIndex(0);
      const prevEvent = navigateToPrevious();
      setTimeout(() => {
        const messages = getMessages(prevEvent);
        simulateTextStreaming(messages[0]);
      }, 300);
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
    <View style={styles.innerContainer} onLayout={handleLayout} onTouchMove={handleTouchMove}>
      <View style={styles.card}>
        <View style={styles.row}>
          <FloatingEmoji emoji={currentEvent.emoji} onTouchMove={updateManualPosition} />
          <MessageBubble
            currentEvent={currentEvent}
            currentStreamedText={currentStreamedText}
            isTyping={isTyping}
            messageIndex={messageIndex}
            showDetails={showDetails}
          />
        </View>
        <ActionBar onActionPress={handleActionPress} />
      </View>
    </View>
  );
};

export default EventAssistantPreview;
