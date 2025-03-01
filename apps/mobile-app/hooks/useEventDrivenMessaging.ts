// Simplified useEventDrivenMessaging.ts - Focus on core messaging
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  BaseEvent,
  EventTypes,
  MarkerEvent,
  MarkersEvent,
  ViewportEvent,
} from "@/services/EventBroker";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useCallback, useState } from "react";

// Enhanced message priority levels
enum MessagePriority {
  BACKGROUND = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
  IMMEDIATE = 5,
}

// Queue message interface updated to include an optional emoji
interface QueuedMessage {
  text: string;
  priority: MessagePriority;
  timestamp: number;
  eventType?: EventTypes;
  id: string;
  emoji?: string;
  preserveOnMarkerSelect?: boolean;
}

// Define the MapboxViewport type
interface MapboxViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const useEventDrivenMessaging = () => {
  // Only mount the hook once and track it
  const [isInitialized, setIsInitialized] = useState(false);

  const { subscribe } = useEventBroker();
  const {
    currentStreamedText,
    isTyping,
    simulateTextStreaming,
    streamCount,
    setCurrentEmoji,
    cancelCurrentStreaming,
  } = useTextStreamingStore();

  // Message queue
  const messageQueue = useRef<QueuedMessage[]>([]);
  const isProcessingQueue = useRef(false);

  // Tracking message state
  const lastMessageTimestamp = useRef<number>(0);
  const isInSearchingState = useRef<boolean>(false);
  const lastPanningMessageTime = useRef<number>(0);

  // Track the last marker count
  const lastMarkerCount = useRef<number>(0);

  // Track the last selected marker ID
  const lastSelectedMarkerId = useRef<string | null>(null);

  // Track if welcome message has been shown
  const welcomeMessageShown = useRef(false);

  // Track previous viewport
  const prevViewport = useRef<MapboxViewport | null>(null);

  // Panning state tracking
  const isPanningContinuously = useRef<boolean>(false);
  const lastPanEventTimestamp = useRef<number>(0);
  const PANNING_CONTINUOUS_THRESHOLD = 300; // ms

  // Minimum change in marker count to show message
  const MIN_COUNT_CHANGE = 2;

  // Generate a unique ID for messages
  const generateMessageId = useCallback((text: string, eventType?: EventTypes) => {
    return `${text}-${eventType || "general"}-${Date.now()}`;
  }, []);

  // Simplified queueMessage with strict focus on core messages
  const queueMessage = useCallback(
    (
      text: string,
      priority: MessagePriority = MessagePriority.MEDIUM,
      eventType?: EventTypes,
      emoji?: string,
      preserveOnMarkerSelect: boolean = false
    ) => {
      // Skip if message is empty
      if (!text || text.trim() === "") return;

      // Allow only our two core message types (plus welcome)
      const isWelcomeMessage = text.includes("Hello") || text.includes("I can help you discover");
      const isScanningMessage = text.includes("Scanning area");
      const isFoundEventsMessage = text.includes("Found") && text.includes("event");

      // Only allow our target message types, plus welcome on initial load
      if (!isWelcomeMessage && !isScanningMessage && !isFoundEventsMessage) {
        return;
      }

      // For scanning messages, implement a short debounce
      if (isScanningMessage) {
        const now = Date.now();
        const SCANNING_MESSAGE_DEBOUNCE = 2000; // 2 seconds

        if (now - lastPanningMessageTime.current < SCANNING_MESSAGE_DEBOUNCE) {
          return; // Skip if we recently showed a scanning message
        }

        lastPanningMessageTime.current = now;
      }

      // Prevent duplicate messages of the same type
      const hasSimilarScanningMessage =
        isScanningMessage && messageQueue.current.some((m) => m.text.includes("Scanning area"));

      const hasSimilarFoundMessage =
        isFoundEventsMessage &&
        messageQueue.current.some((m) => m.text.includes("Found") && m.text.includes("event"));

      if (hasSimilarScanningMessage || hasSimilarFoundMessage) {
        return;
      }

      // Generate a unique ID for this message
      const messageId = generateMessageId(text, eventType);

      // Add to queue with unique ID and emoji
      messageQueue.current.push({
        text,
        priority,
        timestamp: Date.now(),
        eventType,
        id: messageId,
        emoji,
        preserveOnMarkerSelect,
      });

      // Update the last message timestamp
      lastMessageTimestamp.current = Date.now();

      // If this is a "searching" message, update the state flag
      if (isScanningMessage) {
        isInSearchingState.current = true;
      }

      // Sort the queue by priority (higher first) and then by timestamp (earlier first)
      messageQueue.current.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.timestamp - b.timestamp;
      });

      // Start processing the queue if not already
      if (!isProcessingQueue.current && !isTyping) {
        processNextMessage();
      }
    },
    [isTyping, generateMessageId]
  );

  // Simplified clearMessageQueue
  const clearMessageQueue = useCallback(() => {
    // Keep track of what we're currently processing
    const currentProcessing = isProcessingQueue.current ? messageQueue.current.shift() : null;

    // Clear all messages
    messageQueue.current = [];

    // Put the currently processing message back at the front if it exists
    if (currentProcessing) {
      messageQueue.current.unshift(currentProcessing);
    }
  }, []);

  // Process the next message in the queue
  const processNextMessage = useCallback(async () => {
    if (messageQueue.current.length === 0) {
      isProcessingQueue.current = false;
      return;
    }

    isProcessingQueue.current = true;
    const nextMessage = messageQueue.current.shift();

    if (nextMessage) {
      // If this is a results message, clear the searching state
      if (nextMessage.text.includes("Found") && nextMessage.text.includes("event")) {
        isInSearchingState.current = false;
      }

      // Update the store with the emoji from the queued message
      setCurrentEmoji(nextMessage.emoji || "");

      const messageText = nextMessage.emoji ? `${nextMessage.text}` : nextMessage.text;

      await simulateTextStreaming(messageText);

      // Small delay between messages
      setTimeout(processNextMessage, 300);
    } else {
      isProcessingQueue.current = false;
    }
  }, [simulateTextStreaming, setCurrentEmoji]);

  // Initialize with a welcome message, but only once
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);

      if (!welcomeMessageShown.current) {
        queueMessage(
          "Hello! I'm your event assistant.",
          MessagePriority.HIGH,
          undefined,
          "👋" // Welcome emoji
        );
        queueMessage(
          "I can help you discover events nearby.",
          MessagePriority.HIGH,
          undefined,
          "👋" // Welcome emoji
        );
        welcomeMessageShown.current = true;
      }
    }
  }, [queueMessage, isInitialized]);

  useEffect(() => {
    const unsubscribe = subscribe<MarkersEvent>(EventTypes.MARKERS_UPDATED, (eventData) => {
      const { count, markers } = eventData;

      // Clear existing messages since we're going to show a new state
      clearMessageQueue();

      // Important: If there are no markers but we previously had some,
      // we need to show "Scanning area..." again to reset the user's expectation
      if ((!markers || markers.length === 0) && lastMarkerCount.current > 0) {
        queueMessage("Scanning area...", MessagePriority.HIGH, EventTypes.VIEWPORT_CHANGING, "🔍");

        // Reset the marker count
        lastMarkerCount.current = 0;
        // Set searching state
        isInSearchingState.current = true;
        return;
      }

      // If user found events, show the count
      if (markers && markers.length > 0) {
        // Only show if there's a significant change in count
        if (
          lastMarkerCount.current === 0 ||
          Math.abs(count - lastMarkerCount.current) >= MIN_COUNT_CHANGE
        ) {
          queueMessage(
            `Found ${count} event${count > 1 ? "s" : ""} in this area!`,
            MessagePriority.HIGH,
            EventTypes.MARKERS_UPDATED,
            "📍" // Marker update emoji
          );
          lastMarkerCount.current = count;
        }

        // Exit searching state
        isInSearchingState.current = false;
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage, clearMessageQueue]);
  // Simplified marker selection handler - keeps markers but removes messages
  useEffect(() => {
    const unsubscribe = subscribe<MarkerEvent>(EventTypes.MARKER_SELECTED, (eventData) => {
      const { markerId } = eventData;

      // Update the last selected marker ID
      lastSelectedMarkerId.current = markerId;

      // Cancel any streaming message
      if (isTyping) {
        cancelCurrentStreaming();
      }

      // Clear the message queue
      clearMessageQueue();

      // Reset searching state
      isInSearchingState.current = false;

      // Trigger haptic feedback for marker selection
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });

    return unsubscribe;
  }, [subscribe, clearMessageQueue, isTyping, cancelCurrentStreaming]);

  // Simplified viewport changing handler - core scanning message
  useEffect(() => {
    const unsubscribe = subscribe<BaseEvent>(EventTypes.VIEWPORT_CHANGING, (_eventData) => {
      const now = Date.now();

      // Check if this is continuous panning
      const isContinuous = now - lastPanEventTimestamp.current < PANNING_CONTINUOUS_THRESHOLD;
      lastPanEventTimestamp.current = now;

      // Track continuous panning state
      isPanningContinuously.current = isContinuous;

      // Only show "Scanning area" if:
      // 1. We're not already in a searching state
      // 2. No marker is actively selected
      // 3. Sufficient time has passed since the last scanning message
      const SCANNING_MESSAGE_DEBOUNCE = 2000; // 2 seconds
      const markerActive = lastSelectedMarkerId.current !== null;

      if (
        !isInSearchingState.current &&
        !markerActive &&
        now - lastPanningMessageTime.current > SCANNING_MESSAGE_DEBOUNCE
      ) {
        // Clear any existing messages
        clearMessageQueue();

        // Show the scanning message
        queueMessage("Scanning area...", MessagePriority.HIGH, EventTypes.VIEWPORT_CHANGING, "🔍");

        // Update timestamps and state
        lastPanningMessageTime.current = now;
        isInSearchingState.current = true;
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage, clearMessageQueue]);

  // Simplified viewport deselection handler
  useEffect(() => {
    const unsubscribe = subscribe<BaseEvent>(EventTypes.MARKER_DESELECTED, (_eventData) => {
      // Reset the last selected marker ID
      lastSelectedMarkerId.current = null;
    });

    return unsubscribe;
  }, [subscribe]);

  // Monitor streaming count changes to detect when messages complete
  useEffect(() => {
    console.log(`Stream count changed: ${streamCount}`);
  }, [streamCount]);

  return {
    currentStreamedText,
    isTyping,
  };
};
