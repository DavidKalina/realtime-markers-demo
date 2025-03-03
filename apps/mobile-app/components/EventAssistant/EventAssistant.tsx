// EventAssistant.tsx - Edited to fix marker reselection bug
import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

// Hooks
import { useUserLocation } from "@/hooks/useUserLocation";
import { useLocationStore } from "@/stores/useLocationStore";

import { Marker } from "@/hooks/useMapWebsocket";
import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { useMessageQueue } from "@/hooks/useEventAssistantMessageQueue";
import { useMarkerEffects } from "@/hooks/useMarkerEffects";
import { generateActionMessages } from "@/utils/messageUtils";
import AssistantActions from "./AssistantActions";
import AssistantCard from "./AssistantCard";
import AssistantViews from "./AssistantViews";

const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();

  // Get user location using the hook
  const { userLocation } = useUserLocation();

  // Get location store state and functions
  const {
    activeView,
    detailsViewVisible,
    shareViewVisible,
    selectedMarker,
    selectedMarkerId,

    openDetailsView,
    closeDetailsView,
    openShareView,
    closeShareView,

    shareEvent,
  } = useLocationStore();

  // Animation hooks - with proper memoization
  const { styles: animationStyles, controls: animationControls } = useAssistantAnimations();

  // Message queue management
  const {
    currentText,
    isTyping,
    queueMessages,
    clearMessages,
    clearMessagesImmediate, // Add this new function
  } = useMessageQueue();
  const markerSelectionCountRef = useRef<{ [key: string]: number }>({});
  const previousMarkerIdRef = useRef<string | null>(null);

  // Track when marker selection changes
  React.useEffect(() => {
    // If marker changed, reset the counter for the previous marker
    if (previousMarkerIdRef.current && previousMarkerIdRef.current !== selectedMarkerId) {
      delete markerSelectionCountRef.current[previousMarkerIdRef.current];
    }

    // If marker deselected completely, reset all counters
    if (!selectedMarkerId) {
      markerSelectionCountRef.current = {};
    }

    previousMarkerIdRef.current = selectedMarkerId;
  }, [selectedMarkerId]);

  // Then update handleMarkerSelect to use it:
  const handleMarkerSelect = useCallback(
    (marker: Marker, messages: string[]) => {
      // Count selection to prevent multiple calls
      const markerId = marker.id;
      markerSelectionCountRef.current[markerId] =
        (markerSelectionCountRef.current[markerId] || 0) + 1;

      // Only proceed if this is the first selection
      if (markerSelectionCountRef.current[markerId] === 1) {
        // Immediate reset of all previous content (no waiting for animations)
        if (previousMarkerIdRef.current && previousMarkerIdRef.current !== markerId) {
          // Use quickTransition if we're switching between markers
          animationControls.quickTransition();

          // Clear messages immediately without waiting
          clearMessagesImmediate(); // Use the immediate version

          // Queue new messages immediately
          queueMessages(messages, marker.id);

          // Show assistant with faster animation
          animationControls.showAssistant(150);
        } else {
          // First-time selection, use normal approach
          queueMessages(messages, marker.id);
          animationControls.showAssistant(200);
        }
      }
    },
    [queueMessages, clearMessagesImmediate, animationControls]
  );

  // Also update handleMarkerDeselect to use the immediate version
  const handleMarkerDeselect = useCallback(() => {
    // Reset selection counter for the deselected marker
    if (previousMarkerIdRef.current) {
      delete markerSelectionCountRef.current[previousMarkerIdRef.current];
    }

    // Simply clear messages and hide the assistant immediately
    clearMessagesImmediate();
    animationControls.quickTransition();
  }, [clearMessagesImmediate, animationControls]);
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
      // Skip actions if no current event is selected for certain actions
      if (!selectedMarker && ["details", "share"].includes(action)) {
        // Use a local async function to avoid returning promises to render
        const showError = async () => {
          // Clear any existing messages first
          await clearMessages();

          // Set temporary error message
          queueMessages(["Please select a location first."]);

          // Show and then hide after delay
          animationControls.showAndHideWithDelay(3000);
        };

        // Execute without returning a promise
        showError();
        return;
      }

      // Use a local async function instead of top-level async
      const processAction = async () => {
        // Clear existing queue and stop any current streaming
        await clearMessages();

        // Generate and queue action response messages
        const actionMessages = generateActionMessages(action);
        queueMessages(actionMessages, selectedMarkerId);
      };

      // Execute without returning a promise
      processAction();

      // Perform the actual action
      if (action === "details") {
        openDetailsView();
      } else if (action === "share") {
        openShareView();
      } else if (action === "search") {
        navigate("search" as never);
      } else if (action === "camera") {
        // Navigate to the scan screen instead of opening a view
        navigate("scan" as never);
      }
    },
    [
      selectedMarker,
      selectedMarkerId,
      clearMessages,
      queueMessages,
      animationControls,
      openDetailsView,
      openShareView,
      navigate,
    ]
  );

  // Close view handlers
  const handleCloseDetailsView = useCallback(() => {
    closeDetailsView();

    // Use local async function
    const updateMessages = async () => {
      // Clear existing queue first
      await clearMessages();

      // If there's a selected marker, return to showing its information
      if (selectedMarker) {
        queueMessages(["Returning to location overview."], selectedMarkerId);
      }
    };

    // Execute without returning a promise
    updateMessages();
  }, [closeDetailsView, clearMessages, queueMessages, selectedMarker, selectedMarkerId]);

  const handleCloseShareView = useCallback(() => {
    closeShareView();

    // Use local async function
    const updateMessages = async () => {
      // Clear existing queue first
      await clearMessages();

      // Return to marker information
      if (selectedMarker) {
        queueMessages(
          ["Sharing cancelled. How else can I help you with this location?"],
          selectedMarkerId
        );
      }
    };

    // Execute without returning a promise
    updateMessages();
  }, [closeShareView, clearMessages, queueMessages, selectedMarker, selectedMarkerId]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Views component */}
      <AssistantViews
        activeView={activeView}
        detailsViewVisible={detailsViewVisible}
        shareViewVisible={shareViewVisible}
        selectedMarker={selectedMarker}
        onCloseDetailsView={handleCloseDetailsView}
        onCloseShareView={handleCloseShareView}
        onShareEvent={shareEvent}
      />

      <View style={styles.innerContainer}>
        {/* Card component */}
        <AssistantCard
          message={currentText}
          isTyping={isTyping}
          containerStyle={animationStyles.cardContainer}
          contentStyle={animationStyles.cardContent}
        />

        {/* Actions component */}
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
