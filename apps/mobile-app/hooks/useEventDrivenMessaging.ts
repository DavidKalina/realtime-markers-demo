// hooks/useEventDrivenMessaging.ts
import { useState, useEffect, useRef } from "react";
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";
import { MapboxViewport } from "@/components/RefactoredAssistant/types";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";

// Define a flexible marker interface that matches the WebSocket response structure
interface WebSocketMarker {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  data: {
    title: string;
    emoji: string;
    color: string;
    description?: string;
    location?: string;
    distance?: string;
    time?: string;
    categories?: string[];
    isVerified?: boolean;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
  };
}

// Message priority levels
enum MessagePriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
}

interface QueuedMessage {
  text: string;
  priority: MessagePriority;
  timestamp: number;
}

export const useEventDrivenMessaging = ({
  markers = [],
  isConnected = false,
  currentViewport = null,
}: {
  markers?: WebSocketMarker[];
  isConnected?: boolean;
  currentViewport?: MapboxViewport | null;
}) => {
  const { currentStreamedText, isTyping, simulateTextStreaming } = useTextStreamingStore();
  const { currentEvent, activeView } = useEventAssistantStore();

  // Track previous state to detect changes
  const [prevMarkerCount, setPrevMarkerCount] = useState(0);
  const [prevConnected, setPrevConnected] = useState(false);
  const [prevViewport, setPrevViewport] = useState<MapboxViewport | null>(null);
  const [prevEventId, setPrevEventId] = useState<string | undefined>(currentEvent?.id);
  const [prevActiveView, setPrevActiveView] = useState<string | null>(null);

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

  // Handle connection events
  useEffect(() => {
    console.log(`Connection change detected: ${isConnected}, prev: ${prevConnected}`);

    if (isConnected && !prevConnected) {
      queueMessage(
        "Connected to event service! Looking for events near you...",
        MessagePriority.HIGH
      );
      setPrevConnected(true);
    } else if (!isConnected && prevConnected) {
      queueMessage("Connection lost. Reconnecting to event service...", MessagePriority.HIGH);
      setPrevConnected(false);
    }
  }, [isConnected, prevConnected]);

  // Handle marker updates - enhanced with improved logging and handling
  useEffect(() => {
    console.log(
      `Marker update in useEventDrivenMessaging: count=${markers.length}, prevCount=${prevMarkerCount}`
    );

    // Skip initial 0 markers state
    if (markers.length === 0 && prevMarkerCount === 0) {
      return;
    }

    // Handle first marker or markers appearing after none
    if (markers.length > 0 && prevMarkerCount === 0) {
      queueMessage(
        `Found ${markers.length} event${
          markers.length > 1 ? "s" : ""
        } in this area! Swipe through to explore them.`,
        MessagePriority.HIGH
      );
      setPrevMarkerCount(markers.length);
      return;
    }

    // Handle new markers appearing
    if (markers.length > prevMarkerCount) {
      const newCount = markers.length - prevMarkerCount;
      queueMessage(
        `Found ${newCount} new event${newCount > 1 ? "s" : ""} in this area!`,
        MessagePriority.MEDIUM
      );
      setPrevMarkerCount(markers.length);
      return;
    }

    // Handle markers disappearing
    if (markers.length < prevMarkerCount) {
      if (markers.length === 0 && prevMarkerCount > 0) {
        queueMessage(
          "No events found in this area. Try moving the map to explore more locations.",
          MessagePriority.MEDIUM
        );
      } else if (prevMarkerCount > 0) {
        queueMessage("Some events are no longer available in this area.", MessagePriority.LOW);
      }
      setPrevMarkerCount(markers.length);
      return;
    }
  }, [markers.length, prevMarkerCount]);

  // Handle viewport changes (throttled)
  useEffect(() => {
    if (!currentViewport || !prevViewport) {
      setPrevViewport(currentViewport);
      return;
    }

    // Calculate if the viewport changed significantly (moved to a new area)
    const latChange =
      Math.abs(currentViewport.north - prevViewport.north) +
      Math.abs(currentViewport.south - prevViewport.south);
    const lngChange =
      Math.abs(currentViewport.east - prevViewport.east) +
      Math.abs(currentViewport.west - prevViewport.west);

    console.log(`Viewport change: lat=${latChange.toFixed(4)}, lng=${lngChange.toFixed(4)}`);

    // Only trigger a message if the map moved significantly
    if (latChange > 0.05 || lngChange > 0.05) {
      queueMessage("Looking for events in this new area...", MessagePriority.LOW);
      setPrevViewport(currentViewport);
    }
  }, [currentViewport]);

  // Handle current event changes
  useEffect(() => {
    console.log(`Current event change: ${currentEvent?.id}, prev: ${prevEventId}`);

    if (currentEvent?.id && currentEvent.id !== prevEventId) {
      // Generate a random supportive message about the event
      const messages = [
        `${currentEvent.emoji} ${currentEvent.title} looks interesting! It's ${currentEvent.distance} from you.`,
        `Check out ${currentEvent.emoji} ${currentEvent.title}! Happening ${currentEvent.time}.`,
        `How about ${currentEvent.emoji} ${currentEvent.title}? It's ${currentEvent.distance} away.`,
        `${currentEvent.emoji} ${currentEvent.title} might be fun! ${currentEvent.time}.`,
      ];

      const randomIndex = Math.floor(Math.random() * messages.length);
      queueMessage(messages[randomIndex], MessagePriority.HIGH);

      setPrevEventId(currentEvent.id);
    }
  }, [currentEvent?.id, prevEventId]);

  // Handle active view changes
  useEffect(() => {
    console.log(`Active view change: ${activeView}, prev: ${prevActiveView}`);

    if (activeView !== prevActiveView) {
      if (activeView === "details") {
        queueMessage(
          "Here are the event details. You can get directions or share this event.",
          MessagePriority.MEDIUM
        );
      } else if (activeView === "search") {
        queueMessage("Search for events by name, location, or category.", MessagePriority.MEDIUM);
      } else if (activeView === "camera") {
        queueMessage(
          "Scan event flyers or posters to add them to your list.",
          MessagePriority.MEDIUM
        );
      } else if (activeView === "share") {
        queueMessage("Share this event with friends and family.", MessagePriority.MEDIUM);
      } else if (activeView === "map") {
        queueMessage(
          "Explore events on the map. Tap any marker to see details.",
          MessagePriority.MEDIUM
        );
      } else if (activeView === "none" && prevActiveView !== null) {
        queueMessage("What would you like to explore next?", MessagePriority.LOW);
      }

      setPrevActiveView(activeView);
    }
  }, [activeView, prevActiveView]);

  return {
    currentStreamedText,
    isTyping,
  };
};
