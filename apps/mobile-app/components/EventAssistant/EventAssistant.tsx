import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { Marker } from "@/hooks/useMapWebsocket";
import { useMarkerEffects } from "@/hooks/useMarkerEffects";
import { useEnhancedTextStreaming } from "@/hooks/useTextStreaming"; // Same import
import { useUserLocation } from "@/hooks/useUserLocation";
import { useLocationStore } from "@/stores/useLocationStore";
import {
  generateActionMessages,
  generateGoodbyeMessage,
  generateMessageSequence,
} from "@/utils/messageUtils";
import AssistantActions from "./AssistantActions";
import AssistantCard from "./AssistantCard";
import { useAuth } from "@/contexts/AuthContext";

// Configuration constants
const CONFIG = {
  READING_PAUSE_MS: 3000, // Pause after streaming to give users time to read (3 seconds)
  ACTION_PAUSE_MS: 1500, // Shorter pause for action messages (1.5 seconds)
  ERROR_PAUSE_MS: 2500, // Pause after error messages (2.5 seconds)
};

/**
 * EventAssistant component with enhanced navigation flow and improved marker transition handling
 * Now with reading pauses after text streaming
 */
const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();

  // User location
  const { userLocation } = useUserLocation();

  const { user } = useAuth();

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
      // Add pause time for reading
      streamForMarker(
        markerId,
        messages,
        undefined, // no callback
        { pauseAfterMs: CONFIG.READING_PAUSE_MS }
      );
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
        {
          markerId: "goodbye",
          debounceMs: 0, // No need to debounce goodbye message
          pauseAfterMs: CONFIG.ACTION_PAUSE_MS, // Shorter pause for goodbye
        }
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

  // Execute navigation with proper state setting and assistant cleanup
  const executeNavigation = useCallback(
    (navigateFn: () => void) => {
      // Set that we're navigating (not just unmounting)
      isNavigatingRef.current = true;

      // Hide the assistant since we're navigating away
      animationControls.hideAssistant();

      // Small delay before navigation to allow animation to start
      setTimeout(() => {
        // Execute the navigation function
        navigateFn();
      }, 100);
    },
    [animationControls]
  );

  const handleActionPress = useCallback(
    (action: string) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      // Show assistant with animation (always show for any action press)
      animationControls.showAssistant(200);

      // IMPORTANT: Get the most up-to-date state from the store directly
      // This is the key fix - always get fresh data at execution time
      const { selectedMarker: currentMarker, selectedMarkerId: currentMarkerId } =
        useLocationStore.getState();

      // Validate marker selection only for marker-dependent actions
      if (!currentMarker && ["details", "share"].includes(action)) {
        // Show error message with no debounce and a pause to read
        streamImmediate(
          "Please select a location first.",
          () => {
            // Auto-hide after showing error
            setTimeout(() => {
              animationControls.hideAssistant();
            }, 1000); // Additional delay after the pause
          },
          CONFIG.ERROR_PAUSE_MS // Allow time to read error message
        );
        return;
      }

      // Generate action-specific messages
      const actionMessages = generateActionMessages(action, user?.displayName, userLocation);

      // Store the current action for when we return
      navigationActionRef.current = action;

      // Use the current marker's ID when streaming action messages or a special action ID if no marker
      const markerId = currentMarker?.id || `action-${action}`;

      // Handle different actions
      switch (action) {
        case "details":
          // Show action message, then navigate
          streamForMarker(
            markerId,
            actionMessages,
            () => executeNavigation(() => navigate(`details?eventId=${currentMarkerId}` as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;

        case "share":
          // Show action message, then navigate to share
          streamForMarker(
            markerId,
            actionMessages,
            () => executeNavigation(() => navigate(`share?eventId=${currentMarkerId}` as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;

        case "search":
          // Show action message, then navigate to search
          // No marker needed, always show assistant
          streamForMarker(
            markerId,
            actionMessages,
            () => executeNavigation(() => navigate("search" as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;

        case "camera":
          // Show action message, then navigate to camera
          // No marker needed, always show assistant
          streamForMarker(
            markerId,
            actionMessages,
            () => executeNavigation(() => navigate("scan" as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;
        case "user":
          // Show action message, then navigate to camera
          // No marker needed, always show assistant
          streamForMarker(
            markerId,
            actionMessages,
            () => executeNavigation(() => navigate("user" as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;

        default:
          // Just show the messages for other actions with reading pause
          streamForMarker(markerId, actionMessages, undefined, {
            pauseAfterMs: CONFIG.READING_PAUSE_MS,
          });
          break;
      }
    },
    [
      animationControls,
      streamImmediate,
      streamForMarker,
      navigate,
      executeNavigation,
      user?.displayName,
    ]
    // IMPORTANT: Removed selectedMarker and selectedMarkerId from dependencies
    // since we're accessing them fresh from the store each time
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
