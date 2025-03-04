import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { Marker } from "@/hooks/useMapWebsocket";
import { useMarkerEffects } from "@/hooks/useMarkerEffects";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useLocationStore } from "@/stores/useLocationStore";
import { generateActionMessages, generateMessageSequence } from "@/utils/messageUtils";
import AssistantActions from "./AssistantActions";
import AssistantCard from "./AssistantCard";
import { useSimplifiedTextStreaming } from "@/hooks/useTextStreaming";

/**
 * EventAssistant component using a simplified, functional approach
 * with word-by-word text streaming and minimal state management.
 */
const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();

  // User location
  const { userLocation } = useUserLocation();

  // Location store (for marker selection)
  const { selectedMarker, selectedMarkerId, openShareView, selectMarker } = useLocationStore();

  // Animation hooks
  const { styles: animationStyles, controls: animationControls } = useAssistantAnimations();

  // Simplified text streaming
  const { currentText, isStreaming, streamMessages, cancelStreaming, resetStreaming } =
    useSimplifiedTextStreaming();

  // Track marker selection count to prevent multiple processes for same marker
  const markerSelectionCountRef = useRef<Record<string, number>>({});

  // Check if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelStreaming();
    };
  }, [cancelStreaming]);

  // Handle marker selection
  const handleMarkerSelect = useCallback(
    (marker: Marker) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      const markerId = marker.id;

      // Increment selection count for this marker
      markerSelectionCountRef.current[markerId] =
        (markerSelectionCountRef.current[markerId] || 0) + 1;

      // Only process first selection to prevent duplicates
      if (markerSelectionCountRef.current[markerId] === 1) {
        // Generate messages based on marker data
        const messages = generateMessageSequence(marker, userLocation);

        // Show assistant with animation
        animationControls.showAssistant(200);

        // Begin streaming messages
        streamMessages(messages);
      }
    },
    [userLocation, animationControls, streamMessages]
  );

  // Handle marker deselection
  const handleMarkerDeselect = useCallback(() => {
    // Skip if not mounted
    if (!isMountedRef.current) return;

    // Reset marker selection tracking
    markerSelectionCountRef.current = {};

    // Cancel any ongoing streaming
    cancelStreaming();

    // Hide assistant
    animationControls.hideAssistant();

    // Reset text
    resetStreaming();
  }, [animationControls, cancelStreaming, resetStreaming]);

  // Use marker effects hook to handle marker selection/deselection
  useMarkerEffects({
    selectedMarker,
    selectedMarkerId,
    userLocation,
    onMarkerSelect: handleMarkerSelect,
    onMarkerDeselect: handleMarkerDeselect,
  });

  // Handle action button presses
  const handleActionPress = useCallback(
    (action: string) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      // Validate marker selection for actions that require it
      if (!selectedMarker && ["details", "share"].includes(action)) {
        // Show error message
        streamMessages(["Please select a location first."], () => {
          // Auto-hide after showing error
          animationControls.showAndHideWithDelay(3000);
        });
        return;
      }

      // Generate action-specific messages
      const actionMessages = generateActionMessages(action);

      // Display action messages
      switch (action) {
        case "details":
          // Show message and navigate to details screen
          streamMessages(actionMessages, () => {
            resetStreaming();
            animationControls.hideAssistant();
            selectMarker(null);
            navigate(`details?eventId=${selectedMarkerId}` as never);
          });
          break;

        case "share":
          // Show message and open share view
          streamMessages(actionMessages, () => openShareView());
          break;

        case "search":
          // Show message and navigate to search screen
          streamMessages(actionMessages, () => navigate("search" as never));
          break;

        case "camera":
          // Show message and navigate to scan screen
          streamMessages(actionMessages, () => navigate("scan" as never));
          break;

        default:
          // Just show the messages for other actions
          streamMessages(actionMessages);
          break;
      }
    },
    [selectedMarker, selectedMarkerId, animationControls, streamMessages, navigate, openShareView]
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.innerContainer}>
        <AssistantCard
          message={currentText}
          isTyping={isStreaming}
          containerStyle={animationStyles.cardContainer}
          contentStyle={animationStyles.cardContent}
        />

        <AssistantActions
          onActionPress={handleActionPress}
          isStandalone={!selectedMarkerId}
          animatedStyle={animationStyles.actionBar}
        />
      </View>
    </View>
  );
};

export default EventAssistant;
