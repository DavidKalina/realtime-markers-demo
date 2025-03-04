import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { Marker } from "@/hooks/useMapWebsocket";
import { useMarkerEffects } from "@/hooks/useMarkerEffects";
import { useEnhancedTextStreaming } from "@/hooks/useTextStreaming"; // Updated import
import { useUserLocation } from "@/hooks/useUserLocation";
import { useLocationStore } from "@/stores/useLocationStore";
import {
  generateActionMessages,
  generateMessageSequence,
  generateGoodbyeMessage,
  generateWelcomeBackMessage,
} from "@/utils/messageUtils";
import AssistantActions from "./AssistantActions";
import AssistantCard from "./AssistantCard";

/**
 * EventAssistant component with enhanced navigation flow and improved marker transition handling
 */
const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();

  // User location
  const { userLocation } = useUserLocation();

  // Location store (for marker selection)
  const { selectedMarker, selectedMarkerId } = useLocationStore();

  // Animation hooks
  const { styles: animationStyles, controls: animationControls } = useAssistantAnimations();

  // Enhanced text streaming
  const {
    currentText,
    isStreaming,
    streamMessages,
    streamForMarker,
    streamImmediate,
    cancelStreaming,
    resetStreaming,
    currentMarkerId,
  } = useEnhancedTextStreaming();

  // Check if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Keep track of navigation state
  const [isReturningFromNavigation, setIsReturningFromNavigation] = useState(false);
  const previousMarkerRef = useRef<Marker | null>(null);
  const navigationActionRef = useRef<string | null>(null);
  const isNavigatingRef = useRef<boolean>(false);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelStreaming();
    };
  }, [cancelStreaming]);

  // Handle screen focus/blur with the useFocusEffect hook from expo-router
  useFocusEffect(
    useCallback(() => {
      console.log("EventAssistant screen is now focused");

      // Only show welcome back when returning from navigation (not on initial load)
      if (isReturningFromNavigation && selectedMarker && navigationActionRef.current) {
        const action = navigationActionRef.current;
        const markerName = selectedMarker.data?.title || "this location";

        // Generate a welcome back message based on the previous action
        const welcomeBackMessages = generateWelcomeBackMessage(markerName, action);

        // Show welcome back message with marker ID to prevent conflicts
        streamForMarker(selectedMarker.id, welcomeBackMessages);
        animationControls.showAssistant(200);

        // Reset the returning flag and action
        setIsReturningFromNavigation(false);
        navigationActionRef.current = null;
      }

      // Reset navigation flag when focusing on this screen
      isNavigatingRef.current = false;

      return () => {
        // Only set returning flag if we're actually navigating away
        // (not unmounting for other reasons)
        if (isNavigatingRef.current) {
          setIsReturningFromNavigation(true);
        }
      };
    }, [isReturningFromNavigation, selectedMarker, animationControls, streamForMarker])
  );

  // Handle marker selection
  const handleMarkerSelect = useCallback(
    (marker: Marker) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      const markerId = marker.id;

      // Store the previous marker for comparison
      const prevMarker = previousMarkerRef.current;
      previousMarkerRef.current = marker;

      // If we're already showing this marker, don't restart the stream
      if (currentMarkerId === markerId) {
        return;
      }

      // If we're switching markers rapidly, use the streamForMarker function
      // which will properly handle the transition
      const messages = generateMessageSequence(marker, userLocation);

      // Show assistant with animation (if not already visible)
      animationControls.showAssistant(200);

      // Use the direct marker streaming function to handle rapid transitions
      streamForMarker(markerId, messages);
    },
    [userLocation, animationControls, streamForMarker, currentMarkerId]
  );

  // Handle marker deselection
  const handleMarkerDeselect = useCallback(() => {
    // Skip if not mounted
    if (!isMountedRef.current) return;

    // Reset previous marker reference
    previousMarkerRef.current = null;

    // If we have a selected marker, show a goodbye message
    if (selectedMarker) {
      const markerName = selectedMarker.data?.title || "";
      const goodbyeMessage = generateGoodbyeMessage(markerName);

      // Show goodbye message and then hide assistant
      // Use markerId "goodbye" to indicate this is a special case
      streamMessages(
        [goodbyeMessage],
        () => {
          // Hide assistant after showing goodbye message
          animationControls.hideAssistant();
          resetStreaming();
        },
        { markerId: "goodbye", debounceMs: 0 } // No need to debounce goodbye message
      );
    } else {
      // No marker selected, just hide
      cancelStreaming();
      animationControls.hideAssistant();
      resetStreaming();
    }
  }, [selectedMarker, animationControls, cancelStreaming, resetStreaming, streamMessages]);

  // Use marker effects hook to handle marker selection/deselection
  useMarkerEffects({
    selectedMarker,
    selectedMarkerId,
    userLocation,
    onMarkerSelect: handleMarkerSelect,
    onMarkerDeselect: handleMarkerDeselect,
  });

  // Execute navigation with proper state setting
  const executeNavigation = useCallback((navigateFn: () => void) => {
    // Set that we're navigating (not just unmounting)
    isNavigatingRef.current = true;

    // Execute the navigation function
    navigateFn();
  }, []);

  // Handle action button presses
  const handleActionPress = useCallback(
    (action: string) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      // Validate marker selection for actions that require it
      if (!selectedMarker && ["details", "share"].includes(action)) {
        // Show error message with no debounce
        streamMessages(
          ["Please select a location first."],
          () => {
            // Auto-hide after showing error
            animationControls.showAndHideWithDelay(3000);
          },
          { debounceMs: 0 }
        );
        return;
      }

      // Generate action-specific messages
      const actionMessages = generateActionMessages(action);

      // Store the current action for when we return
      navigationActionRef.current = action;

      // Use the current marker's ID when streaming action messages
      const markerId = selectedMarker?.id || "action";

      // Handle different actions
      switch (action) {
        case "details":
          // Show action message, then navigate
          streamForMarker(markerId, actionMessages, () =>
            executeNavigation(() => navigate(`details?eventId=${selectedMarkerId}` as never))
          );
          break;

        case "share":
          // Show action message, then open share view
          streamForMarker(markerId, actionMessages, () =>
            executeNavigation(() => navigate(`share?eventId=${selectedMarkerId}` as never))
          );
          break;

        case "search":
          // Show action message, then navigate to search
          streamForMarker(markerId, actionMessages, () =>
            executeNavigation(() => navigate("search" as never))
          );
          break;

        case "camera":
          // Show action message, then navigate to camera
          streamForMarker(markerId, actionMessages, () =>
            executeNavigation(() => navigate("scan" as never))
          );
          break;

        default:
          // Just show the messages for other actions
          streamForMarker(markerId, actionMessages);
          break;
      }
    },
    [
      selectedMarker,
      selectedMarkerId,
      animationControls,
      streamMessages,
      streamForMarker,
      navigate,
      executeNavigation,
    ]
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
