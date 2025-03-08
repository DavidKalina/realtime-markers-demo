// Modified EventAssistant.tsx with welcome flow removed

import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { Marker } from "@/hooks/useMapWebsocket";
import { useMarkerEffects } from "@/hooks/useMarkerEffects";
import { useEnhancedTextStreaming } from "@/hooks/useTextStreaming";
import { useLocationStore } from "@/stores/useLocationStore";
import { generateActionMessages, generateGoodbyeMessage } from "@/utils/messageUtils";
import AssistantActions from "./AssistantActions";
import AssistantCard from "./AssistantCard";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocation } from "@/contexts/LocationContext";

// Import or define the MapItem types - these should be in a common types file
interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

interface MarkerItem extends BaseMapItem {
  type: "marker";
  data: Marker["data"];
}

interface ClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[];
}

type MapItem = MarkerItem | ClusterItem;

// Configuration constants
const CONFIG = {
  READING_PAUSE_MS: 1500, // Reduced from 3000ms to 1500ms for quicker navigation
  ACTION_PAUSE_MS: 800, // Reduced from 1500ms to 800ms for quicker navigation
  ERROR_PAUSE_MS: 2000, // Reduced from 2500ms to 2000ms
  AUTO_DISMISS_DELAY_MS: 3000, // Auto-dismiss delay after streaming completes (3 seconds)
  NAVIGATION_DELAY_MS: 1200, // Delay before navigation after showing marker/cluster info (1.2 seconds)
};

/**
 * EventAssistant component with unified marker/cluster selection logic
 * Includes direct navigation to details when a marker is pressed
 */
const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // User location
  const { userLocation } = useUserLocation();

  const { user } = useAuth();

  // Auto-dismiss timer reference
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigation timer reference
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the unified selection state
  const selectedItem = useLocationStore((state) => state.selectedItem);

  // Animation hooks
  const { styles: animationStyles, controls: animationControls } = useAssistantAnimations();

  // Check if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

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
  const previousItemRef = useRef<MapItem | null>(null);
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

      // Clear navigation timer on unmount
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = null;
      }

      cancelStreaming();
    };
  }, [cancelStreaming]);

  // Clear any pending navigation when component unmounts
  const clearNavigationTimer = useCallback(() => {
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  }, []);

  // Handle item deselection (works for both markers and clusters)
  const handleItemDeselect = useCallback(() => {
    // Skip if not mounted
    if (!isMountedRef.current) return;

    // Clear any pending navigation when deselecting
    clearNavigationTimer();

    // Reset previous item reference
    previousItemRef.current = null;

    // If we have a selected item, show a goodbye message
    if (selectedItem) {
      let itemName = "";

      // Get the appropriate name based on item type
      if (selectedItem.type === "marker") {
        itemName = selectedItem.data?.title || "this location";
      } else if (selectedItem.type === "cluster") {
        itemName = "this group of events";
      }

      const goodbyeMessage = generateGoodbyeMessage(itemName);

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
      // No item selected, just hide
      cancelStreaming();
      animationControls.hideAssistant();
      resetStreaming();
    }
  }, [
    selectedItem,
    animationControls,
    cancelStreaming,
    resetStreaming,
    streamMessages,
    clearNavigationTimer,
  ]);

  // Execute navigation with proper state setting and assistant cleanup
  const executeNavigation = useCallback(
    (navigateFn: () => void) => {
      // Set that we're navigating (not just unmounting)
      isNavigatingRef.current = true;

      // Clear any pending navigation timers
      clearNavigationTimer();

      // Hide the assistant since we're navigating away
      animationControls.hideAssistant();

      // Small delay before navigation to allow animation to start
      setTimeout(() => {
        // Execute the navigation function
        navigateFn();
      }, 100);
    },
    [animationControls, clearNavigationTimer]
  );

  const handleActionPress = useCallback(
    (action: string) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      // Clear any pending navigation when pressing an action button
      clearNavigationTimer();

      // Show assistant with animation (always show for any action press)
      animationControls.showAssistant(200);

      // Clear any existing auto-dismiss timer since we're showing new content
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      // IMPORTANT: Get the most up-to-date state from the store directly
      const currentItem = useLocationStore.getState().selectedItem;

      // Validate item selection only for item-dependent actions
      if (!currentItem && ["details", "share"].includes(action)) {
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

      // Use the current item's ID when streaming action messages or a special action ID if no item
      const itemId = currentItem?.id || `action-${action}`;

      // Handle navigation based on the selected item type and action
      switch (action) {
        case "search":
          // Show action message, then navigate to search
          // No item needed, always show assistant
          streamForMarker(
            itemId,
            actionMessages,
            () => executeNavigation(() => router.push("search" as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;

        case "camera":
          // Show action message, then navigate to camera
          // No item needed, always show assistant
          streamForMarker(
            itemId,
            actionMessages,
            () => executeNavigation(() => router.push("scan" as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;
        case "user":
          // Show action message, then navigate to user profile
          // No item needed, always show assistant
          streamForMarker(
            itemId,
            actionMessages,
            () => executeNavigation(() => router.push("user" as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;
        case "saved":
          // Show action message, then navigate to user profile
          // No item needed, always show assistant
          streamForMarker(
            itemId,
            actionMessages,
            () => executeNavigation(() => router.push("saved" as never)),
            { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Add pause before navigation
          );
          break;

        default:
          // Just show the messages for other actions with reading pause
          streamForMarker(itemId, actionMessages, undefined, {
            pauseAfterMs: CONFIG.READING_PAUSE_MS,
          });
          break;
      }
    },
    [
      animationControls,
      streamImmediate,
      streamForMarker,
      router,
      executeNavigation,
      user?.displayName,
      userLocation,
      clearNavigationTimer,
    ]
  );

  // Handle direct navigation to details when marker or cluster is selected
  const navigateToDetails = useCallback(
    (item: MapItem) => {
      // Clear any pending navigation
      clearNavigationTimer();

      // Set up new navigation timer
      navigationTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;

        // The route depends on the type of item
        const route = item.type === "marker" ? `details?eventId=${item.id}` : "cluster";

        // Execute navigation
        executeNavigation(() => router.push(route as never));

        // Clear the reference after execution
        navigationTimerRef.current = null;
      }, CONFIG.NAVIGATION_DELAY_MS);
    },
    [executeNavigation, router, clearNavigationTimer]
  );

  // Use our updated marker effects hook with the unified selection model
  useMarkerEffects({
    selectedItem,
    userLocation,
    onItemSelect: (item: MapItem, messages: string[]) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      const itemId = item.id;

      // Store the previous item for comparison
      previousItemRef.current = item;

      // If we're already showing this item, don't restart the stream
      if (currentMarkerId === itemId) {
        return;
      }

      // Show assistant with animation (if not already visible)
      animationControls.showAssistant(200);

      // Clear any existing auto-dismiss timer since we're showing new content
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      // Stream marker/cluster info, then navigate to details
      streamForMarker(
        itemId,
        messages,
        () => {
          // Schedule navigation to details after showing marker/cluster info
          navigateToDetails(item);
        },
        { pauseAfterMs: CONFIG.ACTION_PAUSE_MS } // Shorter pause before navigation
      );
    },
    onItemDeselect: handleItemDeselect,
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
          isStandalone={!selectedItem}
          animatedStyle={animationStyles.actionBar}
        />
      </View>
    </View>
  );
};

export default EventAssistant;
