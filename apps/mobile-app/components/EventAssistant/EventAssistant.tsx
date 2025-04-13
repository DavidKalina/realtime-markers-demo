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

  // Track mounted state
  const isMountedRef = useRef(true);

  // Auto-dismiss timer reference
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationActionRef = useRef<string | null>(null);
  const isNavigatingRef = useRef<boolean>(false);

  // Get the unified selection state from the store - using selector
  const selectedItem = useLocationStore((state) => state.selectedItem);

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

  // Memoize configuration getters to prevent unnecessary rerenders
  const getUserName = useCallback(() => user?.displayName, [user?.displayName]);
  const getUserLocation = useCallback(() => userLocation, [userLocation]);

  // Memoize the getStoreSelectedItem function to avoid recreating on each render
  const getStoreSelectedItem = useCallback(() => {
    return useLocationStore.getState().selectedItem;
  }, []);

  // Memoize the showError function to avoid recreating on each render
  const showError = useCallback(
    (errorMessage: string) => {
      streamImmediate(
        errorMessage,
        () => {
          setTimeout(() => {
            if (isMountedRef.current) {
              animationControls.hideAssistant();
            }
          }, 1000);
        },
        CONFIG.ERROR_PAUSE_MS
      );
    },
    [streamImmediate, animationControls]
  );

  // Memoize navigation handlers
  const navigationHandlers = useMemo(() => ({
    filter: () => router.push("filter" as never),
    search: () => router.push("search" as never),
    scan: () => router.push("scan" as never),
    user: () => router.push("user" as never),
    saved: () => router.push("saved" as never),
  }), [router]);

  // Cleanup function for all timers and animations
  const cleanupAll = useCallback(() => {
    if (!isMountedRef.current) return;

    // Clear all timers
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }

    // Cancel any ongoing streaming
    cancelStreaming();
    resetStreaming();

    // Reset navigation state
    navigationActionRef.current = null;
    isNavigatingRef.current = false;

    // Hide assistant and reset animations
    animationControls.hideAssistant();
    animationControls.quickTransition();
  }, [cancelStreaming, resetStreaming, animationControls]);

  // Function to schedule auto-dismiss with cleanup
  const scheduleAutoDismiss = useCallback(() => {
    if (!isMountedRef.current) return;

    // Clear any existing timer
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    autoDismissTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && !isStreaming) {
        animationControls.hideAssistant();
      }
      autoDismissTimerRef.current = null;
    }, CONFIG.AUTO_DISMISS_DELAY_MS);
  }, [animationControls, isStreaming]);

  // Clear any pending navigation with cleanup
  const clearNavigationTimer = useCallback(() => {
    if (!isMountedRef.current) return;

    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  }, []);

  // Execute navigation with proper state setting and assistant cleanup
  const executeNavigation = useCallback(
    (navigateFn: () => void) => {
      if (!isMountedRef.current) return;

      isNavigatingRef.current = true;
      clearNavigationTimer();
      animationControls.hideAssistant();

      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          navigateFn();
        }
      }, 100);

      return () => clearTimeout(timer);
    },
    [animationControls, clearNavigationTimer]
  );

  // Handle direct navigation to details when marker or cluster is selected
  const navigateToDetails = useCallback(
    (item: MapItem) => {
      if (!isMountedRef.current) return;

      clearNavigationTimer();

      navigationTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;

        const route = item.type === "marker" ? `details?eventId=${item.id}` : "cluster";
        executeNavigation(() => router.push(route as never));
        navigationTimerRef.current = null;
      }, CONFIG.NAVIGATION_DELAY_MS);
    },
    [executeNavigation, router, clearNavigationTimer]
  );

  // Handle item selection using our useMapItemEvents hook
  const handleItemSelect = useCallback(
    (item: MapItem, messages: string[], itemId: string) => {
      if (!isMountedRef.current) return;

      if (currentMarkerId === itemId) {
        return;
      }

      animationControls.showAssistant(200);

      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      streamForMarker(
        itemId,
        messages,
        () => {
          if (isMountedRef.current) {
            navigateToDetails(item);
          }
        },
        { pauseAfterMs: CONFIG.ACTION_PAUSE_MS }
      );
    },
    [animationControls, currentMarkerId, streamForMarker, navigateToDetails]
  );

  // Handle item deselection
  const handleItemDeselect = useCallback(
    (itemName: string) => {
      if (!isMountedRef.current) return;

      clearNavigationTimer();

      const goodbyeMessage = mapItemEvents.getGoodbyeMessage(itemName);

      streamMessages(
        [goodbyeMessage],
        () => {
          if (isMountedRef.current) {
            animationControls.hideAssistant();
            resetStreaming();
          }
        },
        {
          markerId: "goodbye",
          debounceMs: 0,
          pauseAfterMs: CONFIG.ACTION_PAUSE_MS,
        }
      );
    },
    [animationControls, resetStreaming, streamMessages, clearNavigationTimer]
  );

  // Handle user panning the map
  const handleUserPanning = useCallback(() => {
    if (!isMountedRef.current) return;

    if (isStreaming || autoDismissTimerRef.current) {
      cancelStreaming();

      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      clearNavigationTimer();
      animationControls.hideAssistant();
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

  // Handle button actions
  const handleActionPress = useCallback(
    (action: string) => {
      if (!isMountedRef.current) return;

      clearNavigationTimer();
      animationControls.showAssistant(200);

      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }

      const currentItem = getStoreSelectedItem();

      if (!currentItem && ["details", "share"].includes(action)) {
        showError("Please select a location first.");
        return;
      }

      const actionMessages = generateActionMessages(action, getUserName(), getUserLocation());
      navigationActionRef.current = action;
      const itemId = currentItem?.id || `action-${action}`;

      const navigationHandler = navigationHandlers[action as keyof typeof navigationHandlers];
      if (navigationHandler) {
        streamForMarker(
          itemId,
          actionMessages,
          () => executeNavigation(navigationHandler),
          { pauseAfterMs: CONFIG.ACTION_PAUSE_MS }
        );
      } else if (action === "locate") {
        // Special handling for locate action
        streamForMarker(
          itemId,
          actionMessages,
          () => {
            // After locate action completes, hide the assistant
            if (isMountedRef.current) {
              animationControls.hideAssistant();
              resetStreaming();
            }
          },
          { pauseAfterMs: CONFIG.ACTION_PAUSE_MS }
        );
      } else {
        streamForMarker(
          itemId,
          actionMessages,
          undefined,
          { pauseAfterMs: CONFIG.READING_PAUSE_MS }
        );
      }
    },
    [
      animationControls,
      streamForMarker,
      executeNavigation,
      getUserName,
      getUserLocation,
      clearNavigationTimer,
      getStoreSelectedItem,
      showError,
      navigationHandlers,
      resetStreaming,
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

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cleanupAll();
    };
  }, [cleanupAll]);

  // Watch for streaming state changes to handle auto-dismiss
  useEffect(() => {
    if (!isStreaming && isMountedRef.current) {
      scheduleAutoDismiss();
    }

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };
  }, [isStreaming, scheduleAutoDismiss]);

  // Handle navigation cleanup
  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = null;
      }
    };
  }, []);

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