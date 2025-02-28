// hooks/useEventDrivenMessaging.ts - New event-based implementation
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
import { useEffect, useRef } from "react";

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
}

export const useEventDrivenMessaging = () => {
  const { subscribe } = useEventBroker();
  const { currentStreamedText, isTyping, simulateTextStreaming } = useTextStreamingStore();

  // Message queue
  const messageQueue = useRef<QueuedMessage[]>([]);
  const isProcessingQueue = useRef(false);

  // Add a message to the queue
  const queueMessage = (text: string, priority: MessagePriority = MessagePriority.MEDIUM) => {
    // If this exact message is already in the queue, don't add it again
    if (messageQueue.current.some((m) => m.text === text)) {
      console.log(`Skipping duplicate message: "${text}"`);
      return;
    }

    console.log(`Queuing message (priority ${priority}): "${text}"`);

    messageQueue.current.push({
      text,
      priority,
      timestamp: Date.now(),
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
  };

  // Process the next message in the queue
  const processNextMessage = async () => {
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
      setTimeout(processNextMessage, 500);
    } else {
      isProcessingQueue.current = false;
    }
  };

  // Initialize with a welcome message
  useEffect(() => {
    console.log("useEventDrivenMessaging initialized");
    queueMessage(
      "Hello! I'm your event assistant. I can help you discover events nearby.",
      MessagePriority.HIGH
    );
  }, []);

  // Subscribe to WebSocket connection events
  useEffect(() => {
    const unsubscribeConnected = subscribe<BaseEvent>(
      EventTypes.WEBSOCKET_CONNECTED,
      (_eventData) => {
        queueMessage(
          "Connected to event service! Looking for events near you...",
          MessagePriority.HIGH
        );
      }
    );

    const unsubscribeDisconnected = subscribe<BaseEvent>(
      EventTypes.WEBSOCKET_DISCONNECTED,
      (_eventData) => {
        queueMessage("Connection lost. Reconnecting to event service...", MessagePriority.HIGH);
      }
    );

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
  }, [subscribe]);

  // Subscribe to marker updates
  useEffect(() => {
    const unsubscribe = subscribe<MarkersEvent>(EventTypes.MARKERS_UPDATED, (eventData) => {
      const { count, markers } = eventData;

      // Skip if there's no data
      if (!markers || markers.length === 0) {
        queueMessage(
          "No events found in this area. Try moving the map to explore more locations.",
          MessagePriority.MEDIUM
        );
        return;
      }

      // Use count to determine if this is the first batch or new markers
      queueMessage(
        `Found ${count} event${count > 1 ? "s" : ""} in this area! Swipe through to explore them.`,
        MessagePriority.HIGH
      );
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to marker selection
  useEffect(() => {
    const unsubscribe = subscribe<MarkerEvent>(EventTypes.MARKER_SELECTED, (eventData) => {
      const { markerData } = eventData;

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
        queueMessage(messages[randomIndex], MessagePriority.HIGH);

        // Trigger haptic feedback for marker selection
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to viewport changes
  useEffect(() => {
    const unsubscribe = subscribe<ViewportEvent>(EventTypes.VIEWPORT_CHANGED, (eventData) => {
      const { viewport } = eventData;

      // Only trigger a message if the map moved significantly
      // This is usually determined by comparing to previous viewport
      // but for simplicity here we'll just show a message
      queueMessage("Looking for events in this new area...", MessagePriority.LOW);
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to UI view events
  useEffect(() => {
    const viewMessageMap: Record<EventTypes, string> = {
      [EventTypes.OPEN_DETAILS]:
        "Here are the event details. You can get directions or share this event.",
      [EventTypes.OPEN_SHARE]: "Share this event with friends and family.",
      [EventTypes.OPEN_SEARCH]: "Search for events by name, location, or category.",
      [EventTypes.OPEN_SCAN]: "Scan event flyers or posters to add them to your list.",
      [EventTypes.CLOSE_VIEW]: "What would you like to explore next?",
    } as unknown as any;

    // Create subscriptions for each view event
    const unsubscribes = Object.entries(viewMessageMap).map(([eventType, message]) => {
      return subscribe<BaseEvent>(eventType as EventTypes, (_eventData) => {
        queueMessage(message, MessagePriority.MEDIUM);
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [subscribe]);

  // Subscribe to navigation events
  useEffect(() => {
    const unsubscribeNext = subscribe<BaseEvent>(EventTypes.NEXT_EVENT, (_eventData) => {
      queueMessage("Showing the next event.", MessagePriority.LOW);
    });

    const unsubscribePrevious = subscribe<BaseEvent>(EventTypes.PREVIOUS_EVENT, (_eventData) => {
      queueMessage("Showing the previous event.", MessagePriority.LOW);
    });

    return () => {
      unsubscribeNext();
      unsubscribePrevious();
    };
  }, [subscribe]);

  return {
    currentStreamedText,
    isTyping,
  };
};
