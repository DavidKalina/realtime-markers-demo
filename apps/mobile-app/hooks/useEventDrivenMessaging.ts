// hooks/useEventDrivenMessaging.ts - With connection messages removed
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

// Message priority levels
enum MessagePriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
}

// Queue message interface
interface QueuedMessage {
  text: string;
  priority: MessagePriority;
  timestamp: number;
  eventType?: EventTypes;
  id: string;
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
  const { currentStreamedText, isTyping, simulateTextStreaming, streamCount } =
    useTextStreamingStore();

  // Message queue
  const messageQueue = useRef<QueuedMessage[]>([]);
  const isProcessingQueue = useRef(false);

  // Minimum meaningful change in marker count to show a message
  const MIN_COUNT_CHANGE = 2;

  // Track the last selected marker ID
  const lastSelectedMarkerId = useRef<string | null>(null);

  // Track if welcome message has been shown
  const welcomeMessageShown = useRef(false);

  // Track the last marker count
  const lastMarkerCount = useRef<number>(0);

  // Track previous viewport
  const prevViewport = useRef<MapboxViewport | null>(null);

  // Generate a unique ID for messages
  const generateMessageId = useCallback((text: string, eventType?: EventTypes) => {
    return `${text}-${eventType || "general"}-${Date.now()}`;
  }, []);

  // Add a message to the queue
  const queueMessage = useCallback(
    (text: string, priority: MessagePriority = MessagePriority.MEDIUM, eventType?: EventTypes) => {
      // Skip if message is empty
      if (!text || text.trim() === "") return;

      // Skip connection-related messages
      if (
        text.includes("Connection") ||
        text.includes("Connected") ||
        text.includes("connecting")
      ) {
        console.log(`Skipping connection message: "${text}"`);
        return;
      }

      // Generate a unique ID for this message
      const messageId = generateMessageId(text, eventType);

      // Check if this is a duplicate message already in the queue
      if (messageQueue.current.some((m) => m.text === text)) {
        console.log(`Skipping duplicate message in queue: "${text}"`);
        return;
      }

      console.log(`Queuing message (priority ${priority}): "${text}"`);

      // Add to queue with unique ID
      messageQueue.current.push({
        text,
        priority,
        timestamp: Date.now(),
        eventType,
        id: messageId,
      });

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

  // Process the next message in the queue
  const processNextMessage = useCallback(async () => {
    if (messageQueue.current.length === 0) {
      isProcessingQueue.current = false;
      return;
    }

    isProcessingQueue.current = true;
    const nextMessage = messageQueue.current.shift();

    if (nextMessage) {
      console.log(`Processing message: "${nextMessage.text}"`);

      await simulateTextStreaming(nextMessage.text);
      console.log("Message streaming complete");

      // Small delay between messages
      setTimeout(processNextMessage, 300);
    } else {
      isProcessingQueue.current = false;
    }
  }, [simulateTextStreaming]);

  // Initialize with a welcome message, but only once during the entire app lifecycle
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);

      if (!welcomeMessageShown.current) {
        console.log("useEventDrivenMessaging initialized - showing welcome message");
        queueMessage(
          "Hello! I'm your event assistant. I can help you discover events nearby.",
          MessagePriority.HIGH
        );
        welcomeMessageShown.current = true;
      }
    }
  }, [queueMessage, isInitialized]);

  // We're NOT subscribing to WebSocket connection events
  // since we want to hide those messages completely

  // Subscribe to marker updates
  useEffect(() => {
    const unsubscribe = subscribe<MarkersEvent>(EventTypes.MARKERS_UPDATED, (eventData) => {
      const { count, markers } = eventData;

      // Skip if there's no data
      if (!markers || markers.length === 0) {
        queueMessage(
          "No events found in this area. Try moving the map to explore more locations.",
          MessagePriority.MEDIUM,
          EventTypes.MARKERS_UPDATED
        );
        return;
      }

      // Only show a message if the count changed significantly
      const countDifference = Math.abs(count - lastMarkerCount.current);
      if (countDifference >= MIN_COUNT_CHANGE || lastMarkerCount.current === 0) {
        queueMessage(
          `Found ${count} event${
            count > 1 ? "s" : ""
          } in this area! Swipe through to explore them.`,
          MessagePriority.HIGH,
          EventTypes.MARKERS_UPDATED
        );
        // Update last marker count
        lastMarkerCount.current = count;
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage]);

  // Subscribe to marker selection
  useEffect(() => {
    const unsubscribe = subscribe<MarkerEvent>(EventTypes.MARKER_SELECTED, (eventData) => {
      const { markerData, markerId } = eventData;

      // Only skip if it's the exact same marker being reselected
      if (markerId === lastSelectedMarkerId.current) {
        console.log("Skipping message - same marker reselected:", markerId);
        return;
      }

      // Update the last selected marker ID
      lastSelectedMarkerId.current = markerId;

      if (markerData) {
        // Generate a random supportive message about the selected marker
        const messages = [
          `${markerData.data.emoji} ${markerData.data.title} looks interesting! ${
            markerData.data.distance ? `It's ${markerData.data.distance} from you.` : ""
          }`,
          `Check out ${markerData.data.emoji} ${markerData.data.title}! ${
            markerData.data.time ? `Happening ${markerData.data.time}.` : ""
          }`,
          `How about ${markerData.data.emoji} ${markerData.data.title}? ${
            markerData.data.distance ? `It's ${markerData.data.distance} away.` : ""
          }`,
          `${markerData.data.emoji} ${markerData.data.title} might be fun! ${
            markerData.data.time || ""
          }`,
        ];

        const randomIndex = Math.floor(Math.random() * messages.length);
        queueMessage(messages[randomIndex], MessagePriority.HIGH, EventTypes.MARKER_SELECTED);

        // Trigger haptic feedback for marker selection
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage]);

  // Subscribe to marker deselection
  useEffect(() => {
    const unsubscribe = subscribe<BaseEvent>(EventTypes.MARKER_DESELECTED, (_eventData) => {
      // Reset the last selected marker ID
      lastSelectedMarkerId.current = null;

      // Let the user know there are no events in this area
      queueMessage(
        "No events in this area now. You can explore different locations or zoom out to see more.",
        MessagePriority.MEDIUM,
        EventTypes.MARKER_DESELECTED
      );
    });

    return unsubscribe;
  }, [subscribe, queueMessage]);

  // Subscribe to viewport changes with significant movement detection
  useEffect(() => {
    const unsubscribe = subscribe<ViewportEvent>(EventTypes.VIEWPORT_CHANGED, (eventData) => {
      const { viewport } = eventData;

      // Only trigger a message if the map moved significantly
      if (prevViewport.current) {
        // Calculate how much the viewport has changed
        const latChange = Math.abs(
          (prevViewport.current.north + prevViewport.current.south) / 2 -
            (viewport.north + viewport.south) / 2
        );

        const lonChange = Math.abs(
          (prevViewport.current.east + prevViewport.current.west) / 2 -
            (viewport.east + viewport.west) / 2
        );

        // Only show message if moved enough (approximately 1km at equator)
        const SIGNIFICANT_CHANGE = 0.01; // ~1km
        if (latChange > SIGNIFICANT_CHANGE || lonChange > SIGNIFICANT_CHANGE) {
          queueMessage(
            "Looking for events in this new area...",
            MessagePriority.LOW,
            EventTypes.VIEWPORT_CHANGED
          );
          prevViewport.current = viewport;
        }
      } else {
        prevViewport.current = viewport;
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage]);

  // Subscribe to UI view events
  useEffect(() => {
    const viewMessageMap: Record<string, string> = {
      [EventTypes.OPEN_DETAILS]:
        "Here are the event details. You can get directions or share this event.",
      [EventTypes.OPEN_SHARE]: "Share this event with friends and family.",
      [EventTypes.OPEN_SEARCH]: "Search for events by name, location, or category.",
      [EventTypes.OPEN_SCAN]: "Scan event flyers or posters to add them to your list.",
      [EventTypes.CLOSE_VIEW]: "What would you like to explore next?",
    };

    // Create subscriptions for each view event
    const unsubscribes = Object.entries(viewMessageMap).map(([eventType, message]) => {
      return subscribe<BaseEvent>(eventType as EventTypes, (_eventData) => {
        queueMessage(message, MessagePriority.MEDIUM, eventType as EventTypes);
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [subscribe, queueMessage]);

  // Subscribe to navigation events
  useEffect(() => {
    const unsubscribeNext = subscribe<BaseEvent>(EventTypes.NEXT_EVENT, (_eventData) => {
      queueMessage("Showing the next event.", MessagePriority.LOW, EventTypes.NEXT_EVENT);
    });

    const unsubscribePrevious = subscribe<BaseEvent>(EventTypes.PREVIOUS_EVENT, (_eventData) => {
      queueMessage("Showing the previous event.", MessagePriority.LOW, EventTypes.PREVIOUS_EVENT);
    });

    return () => {
      unsubscribeNext();
      unsubscribePrevious();
    };
  }, [subscribe, queueMessage]);

  // Monitor streaming count changes to detect when messages complete
  useEffect(() => {
    console.log(`Stream count changed: ${streamCount}`);
  }, [streamCount]);

  return {
    currentStreamedText,
    isTyping,
  };
};
