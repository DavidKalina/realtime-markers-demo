import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { Marker } from "@/hooks/useMapWebsocket";
import { useMarkerEffects } from "@/hooks/useMarkerEffects";
import { useEnhancedTextStreaming } from "@/hooks/useTextStreaming";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useLocationStore } from "@/stores/useLocationStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  generateActionMessages,
  generateGoodbyeMessage,
  generateMessageSequence,
  generateFirstTimeWelcomeMessages,
} from "@/utils/messageUtils";
import AssistantActions from "./AssistantActions";
import AssistantCard from "./AssistantCard";
import { useAuth } from "@/contexts/AuthContext";

// Configuration constants
const CONFIG = {
  READING_PAUSE_MS: 3000, // Pause after streaming to give users time to read (3 seconds)
  ACTION_PAUSE_MS: 1500, // Shorter pause for action messages (1.5 seconds)
  ERROR_PAUSE_MS: 2500, // Pause after error messages (2.5 seconds)
  STORAGE_KEY: "has_seen_welcome", // Key for storing first-time user state
  AUTO_DISMISS_DELAY_MS: 3000, // Auto-dismiss delay after streaming completes (3 seconds)
};

/**
 * EventAssistant component with enhanced navigation flow and improved marker transition handling
 * Now with reading pauses after text streaming and first-time user welcome
 * Allows interruption of welcome flow when action buttons are pressed
 */
const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();

  // User location
  const { userLocation } = useUserLocation();

  const { user } = useAuth();

  // Auto-dismiss timer reference
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Location store (for marker selection)
  const { selectedMarker, selectedMarkerId } = useLocationStore();

  // Animation hooks
  const { styles: animationStyles, controls: animationControls } = useAssistantAnimations();

  // Check if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Track welcome flow state with both state and ref for reliability
  const [isWelcomeFlowActive, setIsWelcomeFlowActive] = useState(false);
  const isWelcomeFlowActiveRef = useRef(false);

  // Track if we've already initiated the welcome flow check in this session
  const hasInitiatedWelcomeCheckRef = useRef(false);

  // Track if we should skip the welcome flow (e.g., after an action button is pressed)
  const skipWelcomeFlowRef = useRef(false);

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

  // Keep track of navigation state
  const previousMarkerRef = useRef<Marker | null>(null);
  const navigationActionRef = useRef<string | null>(null);
  const isNavigatingRef = useRef<boolean>(false);

  // Function to schedule auto-dismiss
  const scheduleAutoDismiss = useCallback(() => {
    // Clear any existing auto-dismiss timer
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    // Set a new auto-dismiss timer
    autoDismissTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && !isStreaming) {
        // Only hide if we're not in the middle of streaming
        animationControls.hideAssistant();
      }
      autoDismissTimerRef.current = null;
    }, CONFIG.AUTO_DISMISS_DELAY_MS);
  }, [animationControls, isStreaming]);

  // Watch for streaming state changes to handle auto-dismiss
  useEffect(() => {
    // If streaming stopped, schedule auto-dismiss
    if (!isStreaming && isMountedRef.current) {
      scheduleAutoDismiss();
    }
  }, [isStreaming, scheduleAutoDismiss]);

  // Function to mark user as no longer first-time - both AsyncStorage and local state
  const markWelcomeSeen = useCallback(async () => {
    try {
      // Immediately update our refs to prevent race conditions
      isWelcomeFlowActiveRef.current = false;
      skipWelcomeFlowRef.current = true;

      // Cancel any ongoing welcome streaming
      cancelStreaming();

      if (isMountedRef.current) {
        // Update state for React rendering
        setIsWelcomeFlowActive(false);

        // Persist to AsyncStorage
        await AsyncStorage.setItem(CONFIG.STORAGE_KEY, "true");
      }
    } catch (error) {
      console.error("Error setting welcome seen status:", error);
    }
  }, [cancelStreaming]);

  // Interrupt welcome flow and proceed with other actions
  const interruptWelcomeFlow = useCallback(() => {
    if (isWelcomeFlowActiveRef.current || isWelcomeFlowActive) {
      // Cancel ongoing streaming immediately
      cancelStreaming();

      // Update both the ref and state immediately
      isWelcomeFlowActiveRef.current = false;
      skipWelcomeFlowRef.current = true;

      // Update React state (async, but we've already updated the ref)
      setIsWelcomeFlowActive(false);

      // Persist to storage (async, but we've already updated the ref)
      AsyncStorage.setItem(CONFIG.STORAGE_KEY, "true").catch((err) =>
        console.error("Error saving welcome seen status:", err)
      );
    }
  }, [isWelcomeFlowActive, cancelStreaming]);

  // Check for first-time user and show welcome message
  useEffect(() => {
    // Only run this effect once per component lifecycle
    if (hasInitiatedWelcomeCheckRef.current) {
      return;
    }

    hasInitiatedWelcomeCheckRef.current = true;

    const checkFirstTimeUser = async () => {
      try {
        // If we've already decided to skip the welcome flow, don't proceed
        if (skipWelcomeFlowRef.current) {
          return;
        }

        const value = await AsyncStorage.getItem(CONFIG.STORAGE_KEY);
        const isFirstTime = value === null;

        if (isFirstTime && isMountedRef.current && !skipWelcomeFlowRef.current) {
          // Update both state and ref for reliability
          setIsWelcomeFlowActive(true);
          isWelcomeFlowActiveRef.current = true;

          // Show welcome message for first-time users
          const welcomeMessages = generateFirstTimeWelcomeMessages(user?.displayName);

          // Show assistant with animation
          animationControls.showAssistant(200);

          // Stream welcome messages
          streamMessages(
            welcomeMessages,
            async () => {
              // Only mark as seen if we completed the entire welcome sequence
              // and haven't been interrupted
              if (
                isMountedRef.current &&
                isWelcomeFlowActiveRef.current &&
                !skipWelcomeFlowRef.current
              ) {
                await markWelcomeSeen();
              }
            },
            {
              markerId: "welcome",
              debounceMs: 0,
              pauseAfterMs: CONFIG.READING_PAUSE_MS,
            }
          );
        }
      } catch (error) {
        console.error("Error checking first-time user status:", error);
      }
    };

    checkFirstTimeUser();
    // Empty dependency array ensures this runs only once
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear auto-dismiss timer on unmount
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      cancelStreaming();
    };
  }, [cancelStreaming]);

  // Handle marker deselection
  const handleMarkerDeselect = useCallback(() => {
    // Skip if not mounted
    if (!isMountedRef.current) return;

    // Reset previous marker reference
    previousMarkerRef.current = null;

    // If welcome flow is active, don't proceed with deselection behavior
    if (isWelcomeFlowActiveRef.current) {
      return;
    }

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

  // Execute navigation with proper state setting and assistant cleanup
  const executeNavigation = useCallback(
    (navigateFn: () => void) => {
      // Set that we're navigating (not just unmounting)
      isNavigatingRef.current = true;

      // If welcome flow is active, interrupt it before navigating
      if (isWelcomeFlowActiveRef.current || isWelcomeFlowActive) {
        interruptWelcomeFlow();
      }

      // Hide the assistant since we're navigating away
      animationControls.hideAssistant();

      // Small delay before navigation to allow animation to start
      setTimeout(() => {
        // Execute the navigation function
        navigateFn();
      }, 100);
    },
    [animationControls, isWelcomeFlowActive, interruptWelcomeFlow]
  );

  const handleActionPress = useCallback(
    (action: string) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      // CRITICAL: Interrupt welcome flow FIRST before proceeding with any action
      if (isWelcomeFlowActiveRef.current || isWelcomeFlowActive) {
        interruptWelcomeFlow();
      }

      // Show assistant with animation (always show for any action press)
      animationControls.showAssistant(200);

      // Clear any existing auto-dismiss timer since we're showing new content
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      // IMPORTANT: Get the most up-to-date state from the store directly
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
          // Show action message, then navigate to user profile
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
      userLocation,
      isWelcomeFlowActive,
      interruptWelcomeFlow,
    ]
  );

  // This version directly handles marker interactions in the component
  useMarkerEffects({
    selectedMarker,
    selectedMarkerId,
    userLocation,
    onMarkerSelect: (marker: Marker) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      const markerId = marker.id;

      // Store the previous marker for comparison
      previousMarkerRef.current = marker;

      // If we're already showing this marker, don't restart the stream
      if (currentMarkerId === markerId) {
        return;
      }

      // If welcome flow is active, interrupt it
      if (isWelcomeFlowActiveRef.current || isWelcomeFlowActive) {
        interruptWelcomeFlow();
      }

      // Generate messages for this marker
      const messages = generateMessageSequence(marker, userLocation);

      // Show assistant with animation (if not already visible)
      animationControls.showAssistant(200);

      // Clear any existing auto-dismiss timer since we're showing new content
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      // Use the direct marker streaming function to handle rapid transitions
      // Add pause time for reading
      streamForMarker(
        markerId,
        messages,
        undefined, // no callback
        { pauseAfterMs: CONFIG.READING_PAUSE_MS }
      );
    },
    onMarkerDeselect: handleMarkerDeselect,
  });

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
