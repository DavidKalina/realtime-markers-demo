// Optimized EventAssistant with improved performance
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { Marker } from "@/hooks/useMapWebsocket";
import { useEnhancedTextStreaming } from "@/hooks/useTextStreaming";
import { useLocationStore } from "@/stores/useLocationStore";
import { generateActionMessages } from "@/utils/messageUtils";
import AssistantActions from "./AssistantActions";
import AssistantCard from "./AssistantCard";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapItemEvents } from "@/hooks/useMapItemEvents";

// Define the map item types for internal use
interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

interface AppMarkerItem extends BaseMapItem {
  type: "marker";
  data: Marker["data"];
}

interface AppClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[];
}

type MapItem = AppMarkerItem | AppClusterItem;

// Configuration constants - moved outside component to prevent recreation
const CONFIG = {
  READING_PAUSE_MS: 1500,
  ACTION_PAUSE_MS: 800,
  ERROR_PAUSE_MS: 2000,
  AUTO_DISMISS_DELAY_MS: 3000,
  NAVIGATION_DELAY_MS: 1200,
};

/**
 * EventAssistant that responds to map item events and user panning
 */
const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // User location and auth context
  const { userLocation } = useUserLocation();
  const { user } = useAuth();

  // Auto-dismiss timer reference
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigation timer reference
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the unified selection state from the store - using selector
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

  // Navigation state
  const navigationActionRef = useRef<string | null>(null);
  const isNavigatingRef = useRef<boolean>(false);

  // Memoize configuration getters to prevent unnecessary rerenders
  const getUserName = useCallback(() => user?.displayName, [user?.displayName]);
  const getUserLocation = useCallback(() => userLocation, [userLocation]);

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

  // Clear any pending navigation
  const clearNavigationTimer = useCallback(() => {
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  }, []);

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

  // Handle item selection using our useMapItemEvents hook
  const handleItemSelect = useCallback(
    (item: MapItem, messages: string[], itemId: string) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

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
    [animationControls, currentMarkerId, streamForMarker, navigateToDetails]
  );

  // Handle item deselection
  const handleItemDeselect = useCallback(
    (itemName: string) => {
      // Skip if not mounted
      if (!isMountedRef.current) return;

      // Clear any pending navigation when deselecting
      clearNavigationTimer();

      // Get goodbye message
      const goodbyeMessage = mapItemEvents.getGoodbyeMessage(itemName);

      // Show goodbye message and then hide assistant
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
    },
    [animationControls, resetStreaming, streamMessages, clearNavigationTimer]
  );

  // Handle user panning the map
  const handleUserPanning = useCallback(() => {
    // Skip if not mounted
    if (!isMountedRef.current) return;

    // Only respond if we're currently streaming or visible
    if (isStreaming || autoDismissTimerRef.current) {
      // Cancel any current streaming
      cancelStreaming();

      // Clear any auto-dismiss timer
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      // Clear any navigation timer
      clearNavigationTimer();

      // Hide the assistant immediately
      animationControls.hideAssistant();

      // Reset streaming state
      resetStreaming();
    }
  }, [isStreaming, cancelStreaming, resetStreaming, animationControls, clearNavigationTimer]);

  // Use our custom hook to handle MAP_ITEM events and user panning
  const mapItemEvents = useMapItemEvents({
    userLocation,
    onItemSelect: handleItemSelect,
    onItemDeselect: handleItemDeselect,
    onUserPanning: handleUserPanning,
    isMountedRef,
  });

  // Pre-define navigation handlers for common routes
  const navigateToFilter = useCallback(() => router.push("filter" as never), [router]);
  const navigateToSearch = useCallback(() => router.push("search" as never), [router]);
  const navigateToScan = useCallback(() => router.push("scan" as never), [router]);
  const navigateToUpload = useCallback(() => router.push("upload" as never), [router]);
  const navigateToUser = useCallback(() => router.push("user" as never), [router]);
  const navigateToSaved = useCallback(() => router.push("saved" as never), [router]);

  // Memoize the getStoreSelectedItem function to avoid recreating on each render
  const getStoreSelectedItem = useCallback(() => {
    return useLocationStore.getState().selectedItem;
  }, []);

  // Memoize the showError function to avoid recreating on each render
  const showError = useCallback(
    (errorMessage: string) => {
      // Show error message with no debounce and a pause to read
      streamImmediate(
        errorMessage,
        () => {
          // Auto-hide after showing error
          setTimeout(() => {
            if (isMountedRef.current) {
              animationControls.hideAssistant();
            }
          }, 1000); // Additional delay after the pause
        },
        CONFIG.ERROR_PAUSE_MS // Allow time to read error message
      );
    },
    [streamImmediate, animationControls]
  );

  // Handle button actions
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
      const currentItem = getStoreSelectedItem();

      // Validate item selection only for item-dependent actions
      if (!currentItem && ["details", "share"].includes(action)) {
        showError("Please select a location first.");
        return;
      }

      // Generate action-specific messages
      const actionMessages = generateActionMessages(action, getUserName(), getUserLocation());

      // Store the current action for when we return
      navigationActionRef.current = action;

      // Use the current item's ID when streaming action messages or a special action ID if no item
      const itemId = currentItem?.id || `action-${action}`;

      // Handle navigation based on the selected item type and action
      switch (action) {
        case "filter":
          // Show action message, then navigate to filter
          streamForMarker(itemId, actionMessages, () => executeNavigation(navigateToFilter), {
            pauseAfterMs: CONFIG.ACTION_PAUSE_MS,
          });
          break;
        case "search":
          // Show action message, then navigate to search
          streamForMarker(itemId, actionMessages, () => executeNavigation(navigateToSearch), {
            pauseAfterMs: CONFIG.ACTION_PAUSE_MS,
          });
          break;
        case "camera":
          // Show action message, then navigate to camera
          streamForMarker(itemId, actionMessages, () => executeNavigation(navigateToScan), {
            pauseAfterMs: CONFIG.ACTION_PAUSE_MS,
          });
          break;
        case "upload":
          // Show action message, then navigate to upload
          streamForMarker(itemId, actionMessages, () => executeNavigation(navigateToUpload), {
            pauseAfterMs: CONFIG.ACTION_PAUSE_MS,
          });
          break;
        case "user":
          // Show action message, then navigate to user profile
          streamForMarker(itemId, actionMessages, () => executeNavigation(navigateToUser), {
            pauseAfterMs: CONFIG.ACTION_PAUSE_MS,
          });
          break;
        case "saved":
          // Show action message, then navigate to saved
          streamForMarker(itemId, actionMessages, () => executeNavigation(navigateToSaved), {
            pauseAfterMs: CONFIG.ACTION_PAUSE_MS,
          });
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
      streamForMarker,
      executeNavigation,
      navigateToFilter,
      navigateToSearch,
      navigateToScan,
      navigateToUpload,
      navigateToUser,
      navigateToSaved,
      getUserName,
      getUserLocation,
      clearNavigationTimer,
      getStoreSelectedItem,
      showError,
    ]
  );

  // Memoize UI components to prevent unnecessary renders
  const assistantCard = useMemo(
    () => (
      <AssistantCard
        message={currentText}
        isTyping={isStreaming}
        containerStyle={animationStyles.cardContainer}
        contentStyle={animationStyles.cardContent}
      />
    ),
    [currentText, isStreaming, animationStyles.cardContainer, animationStyles.cardContent]
  );

  const assistantActions = useMemo(
    () => (
      <AssistantActions
        onActionPress={handleActionPress}
        isStandalone={!selectedItem}
        animatedStyle={animationStyles.actionBar}
      />
    ),
    [handleActionPress, selectedItem, animationStyles.actionBar]
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.innerContainer}>
        {assistantCard}
        {assistantActions}
      </View>
    </View>
  );
};

export default React.memo(EventAssistant);
