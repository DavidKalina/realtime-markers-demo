import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../globalStyles";

import { useAssistantAnimations } from "@/hooks/useEventAssistantAnimations";
import { Marker } from "@/hooks/useMapWebsocket";
import { useMarkerEffects } from "@/hooks/useMarkerEffects";
import { useTextStreaming } from "@/hooks/useTextStreaming"; // local text streaming
import { useUserLocation } from "@/hooks/useUserLocation";
import { useMessageQueueStore } from "@/stores/useEventAssistantMessageQueueStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { generateActionMessages } from "@/utils/messageUtils";
import AssistantActions from "./AssistantActions";
import AssistantCard from "./AssistantCard";

const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();

  // User location
  const { userLocation } = useUserLocation();

  // Location store (for marker selection, views, etc.)
  const {
    selectedMarker,
    selectedMarkerId,
    openDetailsView,
    closeDetailsView,
    openShareView,
    closeShareView,
  } = useLocationStore();

  // Animation hooks
  const { styles: animationStyles, controls: animationControls } = useAssistantAnimations();

  // Global message queue store – managing only the messages, version, markerId
  const { queueMessages, clearMessages, clearMessagesImmediate, messages } = useMessageQueueStore();

  // Local state to track which messages have been processed
  const [processedMessageIndex, setProcessedMessageIndex] = useState(-1);

  // Local text streaming hook – handles character-by-character display and UI effects
  const { currentStreamedText, isTyping, simulateTextStreaming, cancelCurrentStreaming } =
    useTextStreaming();

  // Counters to prevent duplicate marker selections
  const markerSelectionCountRef = useRef<{ [key: string]: number }>({});
  const previousMarkerIdRef = useRef<string | null>(null);

  // Track marker selection changes
  useEffect(() => {
    if (previousMarkerIdRef.current && previousMarkerIdRef.current !== selectedMarkerId) {
      delete markerSelectionCountRef.current[previousMarkerIdRef.current];
    }
    if (!selectedMarkerId) {
      markerSelectionCountRef.current = {};
    }
    previousMarkerIdRef.current = selectedMarkerId;
  }, [selectedMarkerId]);

  // Handle marker selection
  const handleMarkerSelect = useCallback(
    (marker: Marker, newMessages: string[]) => {
      const markerId = marker.id;
      markerSelectionCountRef.current[markerId] =
        (markerSelectionCountRef.current[markerId] || 0) + 1;

      // Only process the first selection
      if (markerSelectionCountRef.current[markerId] === 1) {
        if (previousMarkerIdRef.current && previousMarkerIdRef.current !== markerId) {
          animationControls.quickTransition();
          clearMessagesImmediate();
          queueMessages(newMessages, marker.id);
          setProcessedMessageIndex(-1); // Reset the processed message index
          animationControls.showAssistant(150);
        } else {
          queueMessages(newMessages, marker.id);
          setProcessedMessageIndex(-1); // Reset the processed message index
          animationControls.showAssistant(200);
        }
      }
    },
    [queueMessages, clearMessagesImmediate, animationControls]
  );

  // Handle marker deselection
  const handleMarkerDeselect = useCallback(() => {
    if (previousMarkerIdRef.current) {
      delete markerSelectionCountRef.current[previousMarkerIdRef.current];
    }
    clearMessagesImmediate();
    setProcessedMessageIndex(-1); // Reset the processed message index
    animationControls.hideAssistant();
  }, [clearMessagesImmediate, animationControls]);

  // Use marker effects hook
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
      if (!selectedMarker && ["details", "share"].includes(action)) {
        const showError = async () => {
          await clearMessages();
          queueMessages(["Please select a location first."]);
          setProcessedMessageIndex(-1); // Reset the processed message index
          animationControls.showAndHideWithDelay(3000);
        };
        showError();
        return;
      }

      const processAction = async () => {
        await clearMessages();
        const actionMessages = generateActionMessages(action);
        queueMessages(actionMessages, selectedMarkerId);
        setProcessedMessageIndex(-1); // Reset the processed message index
      };
      processAction();

      if (action === "details") {
        navigate(`details?eventId=${selectedMarkerId}` as never);
      } else if (action === "share") {
        openShareView();
      } else if (action === "search") {
        navigate("search" as never);
      } else if (action === "camera") {
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

  // Modified message processing effect
  useEffect(() => {
    const processNextMessage = async () => {
      // Don't process if already typing or if all messages have been processed
      if (isTyping || processedMessageIndex >= messages.length - 1) {
        return;
      }

      // Get the next message to process
      const nextIndex = processedMessageIndex + 1;
      if (nextIndex < messages.length) {
        const nextMessage = messages[nextIndex];

        // Update the processed index before streaming
        setProcessedMessageIndex(nextIndex);

        // Stream the message
        await simulateTextStreaming(nextMessage);

        // After streaming completes, check if we should process the next message
        // This will trigger this effect again through state update
      }
    };

    processNextMessage();
  }, [messages, isTyping, processedMessageIndex, simulateTextStreaming]);

  // Debug log for message queue state
  useEffect(() => {
    console.log("Message queue:", {
      count: messages.length,
      processed: processedMessageIndex,
      isTyping,
    });
  }, [messages, processedMessageIndex, isTyping]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.innerContainer}>
        <AssistantCard
          message={currentStreamedText}
          isTyping={isTyping}
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
