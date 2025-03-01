// hooks/useEventDrivenMessaging.ts - Enhanced message coordination
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
  BACKGROUND = 0, // For non-critical background information
  LOW = 1, // For supplementary information
  MEDIUM = 2, // For standard notifications
  HIGH = 3, // For important events (new markers found)
  CRITICAL = 4, // For user-initiated actions (marker selection)
  IMMEDIATE = 5, // Forces immediate display, interrupts other messages
}

// Queue message interface updated to include an optional emoji
interface QueuedMessage {
  text: string;
  priority: MessagePriority;
  timestamp: number;
  eventType?: EventTypes;
  id: string;
  emoji?: string;
  // Add a flag to mark messages that shouldn't be cleared by certain events
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
  const { currentStreamedText, isTyping, simulateTextStreaming, streamCount, setCurrentEmoji } =
    useTextStreamingStore();

  // Message queue
  const messageQueue = useRef<QueuedMessage[]>([]);
  const isProcessingQueue = useRef(false);

  // Tracking message state
  const lastMessageTimestamp = useRef<number>(0);
  const isInSearchingState = useRef<boolean>(false);

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

  // Updated queueMessage to accept an optional preserveOnMarkerSelect parameter
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

      // Skip connection-related messages
      if (
        text.includes("Connection") ||
        text.includes("Connected") ||
        text.includes("connecting")
      ) {
        return;
      }

      // Skip "No events" messages
      if (text.includes("No events") || text.includes("no events")) {
        return;
      }

      // Generate a unique ID for this message
      const messageId = generateMessageId(text, eventType);

      // Check if this is a duplicate message already in the queue
      if (messageQueue.current.some((m) => m.text === text)) {
        return;
      }

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
      if (text.includes("Scanning area") || text.includes("Looking for events")) {
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

  // Process the next message in the queue, now prepending the emoji if provided
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

  // Improved clearMessageQueue with selective clearing
  const clearMessageQueue = useCallback(
    (preserveHighPriority = false, preserveOnMarkerSelect = false) => {
      // Keep track of what we're currently processing
      const currentProcessing = isProcessingQueue.current ? messageQueue.current.shift() : null;

      // Filter the queue based on parameters
      if (preserveHighPriority && preserveOnMarkerSelect) {
        messageQueue.current = messageQueue.current.filter(
          (msg) => msg.priority >= MessagePriority.HIGH || msg.preserveOnMarkerSelect
        );
      } else if (preserveHighPriority) {
        messageQueue.current = messageQueue.current.filter(
          (msg) => msg.priority >= MessagePriority.HIGH
        );
      } else if (preserveOnMarkerSelect) {
        messageQueue.current = messageQueue.current.filter((msg) => msg.preserveOnMarkerSelect);
      } else {
        messageQueue.current = [];
      }

      // Put the currently processing message back at the front if it exists
      if (currentProcessing) {
        messageQueue.current.unshift(currentProcessing);
      }

      // Re-sort the queue if there are still messages
      if (messageQueue.current.length > 0) {
        messageQueue.current.sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority;
          return a.timestamp - b.timestamp;
        });
      }
    },
    []
  );

  // Initialize with a welcome message, but only once during the entire app lifecycle
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);

      if (!welcomeMessageShown.current) {
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

  // Subscribe to markers update events - enhanced to handle sequence better
  useEffect(() => {
    const unsubscribe = subscribe<MarkersEvent>(EventTypes.MARKERS_UPDATED, (eventData) => {
      const { count, markers } = eventData;

      // If we're still in searching state and we get results, clear only low-priority messages
      if (isInSearchingState.current) {
        clearMessageQueue(true, true); // preserve high priority and marker-select-preserved messages
        isInSearchingState.current = false;
      } else {
        // For other updates, clear all pending messages to show the new marker count
        clearMessageQueue(false, true); // preserve only marker-select-preserved messages
      }

      if (!markers || markers.length === 0) {
        queueMessage(
          `No events found in this area.`,
          MessagePriority.HIGH,
          EventTypes.MARKERS_UPDATED,
          "😔", // Emoji for no markers
          true // Preserve this message when marker is selected
        );
        // Reset last marker count so that future updates always trigger a message
        lastMarkerCount.current = 0;
        return;
      }

      // If coming from a fresh viewport (i.e. last count was 0), always announce the new count.
      // Also announce if there's a significant change in marker count
      if (
        lastMarkerCount.current === 0 ||
        Math.abs(count - lastMarkerCount.current) >= MIN_COUNT_CHANGE
      ) {
        queueMessage(
          `Found ${count} event${
            count > 1 ? "s" : ""
          } in this area! Swipe through to explore them.`,
          MessagePriority.HIGH,
          EventTypes.MARKERS_UPDATED,
          "📍", // Marker update emoji
          true // Preserve this message when marker is selected
        );
        lastMarkerCount.current = count;
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage, clearMessageQueue]);

  // Enhanced marker selection handler to improve coordination
  useEffect(() => {
    const unsubscribe = subscribe<MarkerEvent>(EventTypes.MARKER_SELECTED, (eventData) => {
      const { markerData, markerId } = eventData;

      // Only skip if it's the exact same marker being reselected
      if (markerId === lastSelectedMarkerId.current) {
        return;
      }

      // Update the last selected marker ID
      lastSelectedMarkerId.current = markerId;

      if (markerData) {
        // Clear messages but preserve those marked to survive marker selection
        clearMessageQueue(false, true);

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
          MessagePriority.IMMEDIATE, // Use the highest priority to interrupt current message
          EventTypes.MARKER_SELECTED,
          markerData.data.emoji // Use the emoji from marker data
        );

        // Trigger haptic feedback for marker selection
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage, clearMessageQueue]);

  // Enhanced viewport changing handler
  useEffect(() => {
    const unsubscribe = subscribe<BaseEvent>(EventTypes.VIEWPORT_CHANGING, (_eventData) => {
      // Only display "Scanning area" if we haven't shown it recently (within 3 seconds)
      const now = Date.now();
      const SCANNING_MESSAGE_DEBOUNCE = 3000; // 3 seconds

      if (now - lastMessageTimestamp.current > SCANNING_MESSAGE_DEBOUNCE) {
        // Clear the queue but preserve high priority messages
        clearMessageQueue(true, true);

        // Show the scanning message with high priority
        queueMessage("Scanning area...", MessagePriority.HIGH, EventTypes.VIEWPORT_CHANGING, "🔍");

        // Set the searching state flag
        isInSearchingState.current = true;
      }
    });

    return unsubscribe;
  }, [subscribe, queueMessage, clearMessageQueue]);

  useEffect(() => {
    const unsubscribe = subscribe<BaseEvent>(EventTypes.MARKER_DESELECTED, (_eventData) => {
      // Reset the last selected marker ID
      lastSelectedMarkerId.current = null;
    });

    return unsubscribe;
  }, [subscribe]);

  // Enhanced viewport changed handler with better debounce logic
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

            // Only queue if markers are not already present and there's been significant movement
            if (
              (latChange > SIGNIFICANT_CHANGE || lonChange > SIGNIFICANT_CHANGE) &&
              (!markers || markers.length === 0)
            ) {
              // Debounce logic - only show message if we haven't recently shown a searching message
              const now = Date.now();
              const SEARCHING_MESSAGE_DEBOUNCE = 5000; // 5 seconds

              if (
                now - lastMessageTimestamp.current > SEARCHING_MESSAGE_DEBOUNCE &&
                !isInSearchingState.current
              ) {
                queueMessage(
                  "Looking for events in this new area...",
                  MessagePriority.MEDIUM,
                  EventTypes.VIEWPORT_CHANGED,
                  "🔍", // Emoji for searching a new area
                  true // Preserve when marker selected
                );

                // Set the searching state flag
                isInSearchingState.current = true;
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

  // Subscribe to UI view events with priority adjustments
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

    // Mapping of event types to priorities
    const viewPriorityMap: Record<string, MessagePriority> = {
      [EventTypes.OPEN_DETAILS]: MessagePriority.CRITICAL,
      [EventTypes.OPEN_SHARE]: MessagePriority.CRITICAL,
      [EventTypes.OPEN_SEARCH]: MessagePriority.CRITICAL,
      [EventTypes.OPEN_SCAN]: MessagePriority.CRITICAL,
      [EventTypes.CLOSE_VIEW]: MessagePriority.MEDIUM,
    };

    // Create subscriptions for each view event
    const unsubscribes = Object.entries(viewMessageMap).map(([eventType, message]) => {
      return subscribe<BaseEvent>(eventType as EventTypes, (_eventData) => {
        // Clear the queue for view changes, but preserve high-priority messages
        clearMessageQueue(true, false);

        queueMessage(
          message,
          viewPriorityMap[eventType] || MessagePriority.MEDIUM,
          eventType as EventTypes,
          viewEmojiMap[eventType] || "💬"
        );
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [subscribe, queueMessage, clearMessageQueue]);

  // Subscribe to navigation events with lower priority
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
