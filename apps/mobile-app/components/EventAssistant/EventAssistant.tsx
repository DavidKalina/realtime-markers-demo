import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { Marker } from "@/hooks/useMapWebsocket";
import { useMarkerEffects } from "@/hooks/useMarkerEffects";
import { useSimplifiedTextStreaming } from "@/hooks/useTextStreaming";
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
 * EventAssistant component with enhanced navigation flow
 */
const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();

  // User location
  const { userLocation } = useUserLocation();

  // Location store (for marker selection)
  const { selectedMarker, selectedMarkerId, openShareView } = useLocationStore();

  // Animation hooks
  const { styles: animationStyles, controls: animationControls } = useAssistantAnimations();

  // Simplified text streaming
  const {
    currentText,
    isStreaming,
    streamMessages,
    streamImmediate,
    cancelStreaming,
    resetStreaming,
  } = useSimplifiedTextStreaming();

  // Track marker selection count to prevent multiple processes for same marker
  const markerSelectionCountRef = useRef<Record<string, number>>({});

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

        // Show welcome back message
        streamMessages(welcomeBackMessages);
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
    }, [isReturningFromNavigation, selectedMarker, animationControls, streamMessages])
  );

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

    // If we have a selected marker, show a goodbye message
    if (selectedMarker) {
      const markerName = selectedMarker.data?.title || "";
      const goodbyeMessage = generateGoodbyeMessage(markerName);

      // Show goodbye message and then hide assistant
      streamMessages([goodbyeMessage], () => {
        // Hide assistant after showing goodbye message
        animationControls.hideAssistant();
        resetStreaming();
      });
    } else {
      // No marker selected, just hide
      cancelStreaming();
      animationControls.hideAssistant();
      resetStreaming();
    }

    // Reset marker selection tracking
    markerSelectionCountRef.current = {};
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
        // Show error message
        streamMessages(["Please select a location first."], () => {
          // Auto-hide after showing error
          animationControls.showAndHideWithDelay(3000);
        });
        return;
      }

      // Generate action-specific messages
      const actionMessages = generateActionMessages(action);

      // Store the current action for when we return
      navigationActionRef.current = action;

      // Handle different actions
      switch (action) {
        case "details":
          // Show action message, then navigate
          streamMessages(actionMessages, () =>
            executeNavigation(() => navigate(`details?eventId=${selectedMarkerId}` as never))
          );
          break;

        case "share":
          // Show action message, then open share view
          streamMessages(actionMessages, () => executeNavigation(() => openShareView()));
          break;

        case "search":
          // Show action message, then navigate to search
          streamMessages(actionMessages, () =>
            executeNavigation(() => navigate("search" as never))
          );
          break;

        case "camera":
          // Show action message, then navigate to camera
          streamMessages(actionMessages, () => executeNavigation(() => navigate("scan" as never)));
          break;

        default:
          // Just show the messages for other actions
          streamMessages(actionMessages);
          break;
      }
    },
    [
      selectedMarker,
      selectedMarkerId,
      animationControls,
      streamMessages,
      navigate,
      openShareView,
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
