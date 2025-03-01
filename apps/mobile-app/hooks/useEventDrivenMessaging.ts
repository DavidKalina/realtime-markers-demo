// hooks/useEventDrivenMessaging.ts - With improved marker handling and emoji support
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
  CRITICAL = 3, // Added even higher priority for marker selection
}

// Queue message interface updated to include an optional emoji
interface QueuedMessage {
  text: string;
  priority: MessagePriority;
  timestamp: number;
  eventType?: EventTypes;
  id: string;
  emoji?: string;
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
  const { currentStreamedText, isTyping, simulateTextStreaming, streamCount, setCurrentEmoji } =
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

  // Updated queueMessage to accept an optional emoji parameter
  const queueMessage = useCallback(
    (
      text: string,
      priority: MessagePriority = MessagePriority.MEDIUM,
      eventType?: EventTypes,
      emoji?: string
    ) => {
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

      // Skip "No events" messages
      if (text.includes("No events") || text.includes("no events")) {
        console.log(`Skipping "no events" message: "${text}"`);
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

      // Add to queue with unique ID and emoji
      messageQueue.current.push({
        text,
        priority,
        timestamp: Date.now(),
        eventType,
        id: messageId,
        emoji,
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

  // Process the next message in the queue, now prepending the emoji if provided
  const processNextMessage = useCallback(async () => {
    if (messageQueue.current.length === 0) {
      isProcessingQueue.current = false;
      return;
    }

    isProcessingQueue.current = true;
    const nextMessage = messageQueue.current.shift();

    if (nextMessage) {
      // Update the store with the emoji from the queued message
      setCurrentEmoji(nextMessage.emoji || "");

      const messageText = nextMessage.emoji ? `${nextMessage.text}` : nextMessage.text;
      console.log(`Processing message: "${messageText}"`);

      await simulateTextStreaming(messageText);
      console.log("Message streaming complete");

      // Small delay between messages
      setTimeout(processNextMessage, 300);
    } else {
      isProcessingQueue.current = false;
    }
  }, [simulateTextStreaming, setCurrentEmoji]);

  // Clear all messages except the currently processing one
  const clearMessageQueue = useCallback(() => {
    // Get the current message being processed (if any)
    const currentMessage = messageQueue.current.length > 0 ? messageQueue.current[0] : null;

    // Clear the queue
    messageQueue.current = [];

    // If there was a message being processed, put it back
    if (currentMessage) {
      messageQueue.current.push(currentMessage);
    }

    console.log("Message queue cleared");
  }, []);

  // Initialize with a welcome message, but only once during the entire app lifecycle
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);

      if (!welcomeMessageShown.current) {
        console.log("useEventDrivenMessaging initialized - showing welcome message");
        queueMessage(
          "Hello! I'm your event assistant. I can help you discover events nearby.",
          MessagePriority.HIGH,
          undefined,
          "👋" // Welcome emoji
        );
        welcomeMessageShown.current = true;
      }
    }
  }, [queueMessage, isInitialized]);

  // Subscribe to markers update events
  useEffect(() => {
    const unsubscribe = subscribe<MarkersEvent>(EventTypes.MARKERS_UPDATED, (eventData) => {
      const { count, markers } = eventData;

      // Always clear the queued messages (which may include the "searching" message)
      clearMessageQueue();

      if (!markers || markers.length === 0) {
        queueMessage(
          `No markers found in this area.`,
          MessagePriority.HIGH,
          EventTypes.MARKERS_UPDATED,
          "😔" // Emoji for no markers
        );
        // Reset last marker count so that future updates always trigger a message
        lastMarkerCount.current = 0;
        return;
      }

      // If coming from a fresh viewport (i.e. last count was 0), always announce the new count.
      if (
        lastMarkerCount.current === 0 ||
        Math.abs(count - lastMarkerCount.current) >= MIN_COUNT_CHANGE
      ) {
        queueMessage(
          `Found ${count} event${
            count > 1 ? "s" : ""
          } in this area! Swipe through to explore them.`,
          MessagePriority.CRITICAL,
          EventTypes.MARKERS_UPDATED,
          "📍" // Marker update emoji
        );
        lastMarkerCount.current = count;
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage, clearMessageQueue]);

  // Subscribe to marker selection events
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
        // For new marker selections, clear any pending messages to prioritize this
        clearMessageQueue();

        // Generate a random supportive message about the selected marker
        const messages = [
          `${markerData.data.title} looks interesting! ${
            markerData.data.distance ? `It's ${markerData.data.distance} from you.` : ""
          }`,
          `Check out ${markerData.data.title}! ${
            markerData.data.time ? `Happening ${markerData.data.time}.` : ""
          }`,
          `How about ${markerData.data.title}? ${
            markerData.data.distance ? `It's ${markerData.data.distance} away.` : ""
          }`,
          `${markerData.data.title} might be fun! ${markerData.data.time || ""}`,
        ];

        const randomIndex = Math.floor(Math.random() * messages.length);
        queueMessage(
          messages[randomIndex],
          MessagePriority.CRITICAL, // Even higher priority for marker selection
          EventTypes.MARKER_SELECTED,
          markerData.data.emoji // Use the emoji from marker data
        );

        // Trigger haptic feedback for marker selection
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage, clearMessageQueue]);

  useEffect(() => {
    const unsubscribe = subscribe<BaseEvent>(EventTypes.VIEWPORT_CHANGING, (_eventData) => {
      clearMessageQueue();
      queueMessage(
        "Scanning area...",
        MessagePriority.CRITICAL, // Even higher priority for marker selection
        EventTypes.MARKER_SELECTED,
        "🔍"
      );
    });

    return unsubscribe;
  }, [subscribe, queueMessage]);

  useEffect(() => {
    const unsubscribe = subscribe<BaseEvent>(EventTypes.MARKER_DESELECTED, (_eventData) => {
      // Reset the last selected marker ID
      lastSelectedMarkerId.current = null;

      // Just log but don't show a message to the user
      console.log("Marker deselected - remaining silent");
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to viewport changes
  useEffect(() => {
    const unsubscribe = subscribe<ViewportEvent & { searching?: boolean }>(
      EventTypes.VIEWPORT_CHANGED,
      (eventData) => {
        const { viewport, markers, searching } = eventData;

        if (markers.length > 0) {
          return;
        }

        if (searching) {
          if (prevViewport.current) {
            const latChange = Math.abs(
              (prevViewport.current.north + prevViewport.current.south) / 2 -
                (viewport.north + viewport.south) / 2
            );
            const lonChange = Math.abs(
              (prevViewport.current.east + prevViewport.current.west) / 2 -
                (viewport.east + viewport.west) / 2
            );
            const SIGNIFICANT_CHANGE = 0.01; // ~1km

            if (latChange > SIGNIFICANT_CHANGE || lonChange > SIGNIFICANT_CHANGE) {
              // Only queue if markers are not already present.
              if (!markers || markers.length === 0) {
                queueMessage(
                  "Looking for events in this new area...",
                  MessagePriority.LOW,
                  EventTypes.VIEWPORT_CHANGED,
                  "🔍" // Emoji for searching a new area
                );
              }
              prevViewport.current = viewport;
            }
          } else {
            prevViewport.current = viewport;
          }
        }
      }
    );
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

    // Mapping of event types to corresponding emojis
    const viewEmojiMap: Record<string, string> = {
      [EventTypes.OPEN_DETAILS]: "📖",
      [EventTypes.OPEN_SHARE]: "🔗",
      [EventTypes.OPEN_SEARCH]: "🔍",
      [EventTypes.OPEN_SCAN]: "📸",
      [EventTypes.CLOSE_VIEW]: "👋",
    };

    // Create subscriptions for each view event
    const unsubscribes = Object.entries(viewMessageMap).map(([eventType, message]) => {
      return subscribe<BaseEvent>(eventType as EventTypes, (_eventData) => {
        queueMessage(
          message,
          MessagePriority.MEDIUM,
          eventType as EventTypes,
          viewEmojiMap[eventType] || "💬"
        );
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [subscribe, queueMessage]);

  // Subscribe to navigation events
  useEffect(() => {
    const unsubscribeNext = subscribe<BaseEvent>(EventTypes.NEXT_EVENT, (_eventData) => {
      queueMessage(
        "Showing the next event.",
        MessagePriority.LOW,
        EventTypes.NEXT_EVENT,
        "➡️" // Emoji for next event
      );
    });

    const unsubscribePrevious = subscribe<BaseEvent>(EventTypes.PREVIOUS_EVENT, (_eventData) => {
      queueMessage(
        "Showing the previous event.",
        MessagePriority.LOW,
        EventTypes.PREVIOUS_EVENT,
        "⬅️" // Emoji for previous event
      );
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
