import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";
import React, { useEffect, useRef, useState } from "react";
import { View, LogBox } from "react-native";
import EventAssistantWithStores from "./AnimatedAssistant";
import ConnectionIndicator from "./ConnectionIndicator";
import { EventType } from "./types";

// This is your WebSocket URL - you'll need to provide the actual URL
const WEBSOCKET_URL = process.env.EXPO_PUBLIC_WEB_SOCKET_URL || "ws://localhost:8081";

// Ignore potential timer warnings
LogBox.ignoreLogs(["Setting a timer"]);

// Convert a Mapbox marker to the EventType format used by the assistant
const markerToEvent = (marker: any): EventType => {
  // Ensure marker and its properties are valid
  if (!marker || typeof marker !== "object" || !Array.isArray(marker.coordinates)) {
    console.warn("Invalid marker object:", marker);
    // Return a default event if marker is invalid
    return {
      emoji: "❓",
      title: "Unknown Event",
      description: "No event details available",
      location: "Unknown location",
      time: new Date().toLocaleString(),
      distance: "Unknown distance",
      categories: ["Unknown"],
    };
  }

  // Get coordinates from the marker (Mapbox format is [longitude, latitude])
  const [longitude, latitude] = marker.coordinates;

  // Safely get data properties with defaults
  const data = marker.data || {};

  // Safely format coordinates
  const formattedCoords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

  // Generate a safe ID substring
  const idSubstring =
    typeof marker.id === "string"
      ? marker.id.substring(0, Math.min(marker.id.length, 8))
      : "unknown";

  // Parse created_at date safely
  let timeString;
  try {
    timeString = data.created_at
      ? new Date(data.created_at).toLocaleString()
      : new Date().toLocaleString();
  } catch (e) {
    timeString = new Date().toLocaleString();
  }

  // Build the event object
  return {
    emoji: data.emoji || "📍",
    title: data.title || "Unnamed Event",
    description:
      data.description || `Join us for a great time! Located at coordinates [${formattedCoords}]`,
    location: data.location || `Location ${idSubstring}`,
    time: data.time || timeString,
    distance: data.distance || "Distance unknown",
    categories: Array.isArray(data.categories)
      ? data.categories
      : data.color
      ? [data.color]
      : ["Event"],
  };
};

const WebSocketEventAssistant: React.FC = () => {
  // Connect to WebSocket and get markers
  const { markers, isConnected, currentViewport } = useMapWebSocket(WEBSOCKET_URL);

  // Get store actions
  const {
    setCurrentEvent,
    setEventList,
    setMessageIndex,
    setShowActions,
    showActions,
    messageIndex,
    transitionMessage,
    activeView,
  } = useEventAssistantStore();

  // Get text streaming functionality
  const { simulateTextStreaming, isTyping, currentStreamedText } = useTextStreamingStore();

  // Track previous marker count to detect changes
  const prevMarkersCountRef = useRef<number>(0);

  // Track if we've notified about a particular region
  const [notifiedRegions, setNotifiedRegions] = useState<Set<string>>(new Set());

  // Track if we're currently in message streaming mode
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Track last notification time to prevent spam
  const lastNotificationTimeRef = useRef<number>(0);

  // Track if first load completed
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  // Generate a region key based on viewport bounds
  const getRegionKey = (viewport: any) => {
    if (!viewport) return "";
    // Round to 2 decimal places for a reasonable geofence size
    const lat = Math.round(((viewport.north + viewport.south) / 2) * 100) / 100;
    const lng = Math.round(((viewport.east + viewport.west) / 2) * 100) / 100;
    return `${lat},${lng}`;
  };

  // Debug logging of store state
  useEffect(() => {
    console.log("Assistant state:", {
      showActions,
      messageIndex,
      isTyping,
      transitionMessage,
      activeView,
      streamingText: currentStreamedText,
    });
  }, [showActions, messageIndex, isTyping, transitionMessage, activeView, currentStreamedText]);

  // Initialize with welcome message on first connection
  useEffect(() => {
    if (isConnected && !firstLoadDone) {
      console.log("Sending initial welcome message");

      // Reset state
      setMessageIndex(0);
      setShowActions(false);
      setIsStreaming(true);

      // Stream welcome message
      simulateTextStreaming(
        "Hello! I'm your event assistant. I'll help you discover events as you explore the map!"
      )
        .then(() => {
          console.log("Welcome message complete, showing actions");
          setTimeout(() => {
            setShowActions(true);
            setIsStreaming(false);
            setFirstLoadDone(true);
          }, 1000);
        })
        .catch((err) => {
          console.error("Error streaming welcome message:", err);
        });
    }
  }, [isConnected, firstLoadDone]);

  // When markers change, update the event assistant store
  useEffect(() => {
    try {
      if (markers && Array.isArray(markers) && markers.length > 0) {
        // Log marker data to help with debugging
        console.log(`Received ${markers.length} markers from WebSocket`);

        // Convert all markers to events with error handling for each marker
        const events = markers.map((marker) => {
          try {
            return markerToEvent(marker);
          } catch (err) {
            console.error("Error converting marker to event:", err);
            // Return a fallback event
            return {
              emoji: "⚠️",
              title: "Error Processing Event",
              description: "There was an error processing this event data",
              location: "Unknown location",
              time: new Date().toLocaleString(),
              distance: "Unknown",
              categories: ["Error"],
            };
          }
        });

        // Update the event list in the store
        setEventList(events);

        // Set the current event to the first marker if available
        if (events.length > 0) {
          setCurrentEvent(events[0]);
        }

        console.log(`Updated event assistant with ${events.length} events from WebSocket`);

        // Don't process notifications until welcome is complete
        if (!firstLoadDone) {
          return;
        }

        // Check if we should notify the user about new events in this area
        const currentRegionKey = getRegionKey(currentViewport);
        const currentTime = Date.now();
        const markerCountChanged = prevMarkersCountRef.current !== markers.length;
        const notNotifiedYet = !notifiedRegions.has(currentRegionKey);
        const timeThresholdPassed = currentTime - lastNotificationTimeRef.current > 10000; // 10 seconds

        console.log("Notification check:", {
          markerCountChanged,
          notNotifiedYet,
          timeThresholdPassed,
          isStreaming,
          activeView,
          currentRegionKey,
        });

        // Only show notification when:
        // 1. We have markers
        // 2. We're not already streaming
        // 3. We have viewport info
        // 4. No active modal view is showing
        // 5. Either the marker count changed and cooldown passed, or we've never notified about this region
        if (
          markers.length > 0 &&
          !isStreaming &&
          currentViewport &&
          !activeView &&
          ((markerCountChanged && timeThresholdPassed) || notNotifiedYet)
        ) {
          console.log("Triggering notification for new events in area");

          // Don't notify again for this region
          setNotifiedRegions((prev) => {
            const updated = new Set(prev);
            updated.add(currentRegionKey);
            return updated;
          });

          // Update timestamp
          lastNotificationTimeRef.current = currentTime;

          // Prepare assistant
          setIsStreaming(true);
          setMessageIndex(0);
          setShowActions(false);

          // Create appropriate message
          let message = "";
          if (markers.length === 1) {
            message = `I found an event in this area! Check it out.`;
          } else {
            message = `I found ${markers.length} events in this area! Let me show you.`;
          }

          // Add delay to make flow feel more natural
          setTimeout(() => {
            // Stream the message
            console.log("Streaming message:", message);
            simulateTextStreaming(message)
              .then(() => {
                // After message is complete, show the actions
                console.log("Message streaming complete, showing actions");
                setTimeout(() => {
                  setShowActions(true);
                  setIsStreaming(false);
                }, 1000);
              })
              .catch((err) => {
                console.error("Error streaming message:", err);
                setIsStreaming(false);
              });
          }, 500);
        }

        // Update our reference
        prevMarkersCountRef.current = markers.length;
      } else {
        console.log("No valid markers received from WebSocket");
      }
    } catch (error) {
      console.error("Error updating events from markers:", error);
      setIsStreaming(false);
    }
  }, [markers, currentViewport, firstLoadDone]);

  // Reset notified regions when connection status changes
  useEffect(() => {
    if (!isConnected) {
      setNotifiedRegions(new Set());
      setFirstLoadDone(false);
    }
  }, [isConnected]);

  // Manual testing function - call to simulate a message
  const testMessage = () => {
    console.log("MANUAL TEST: Sending test message");
    setMessageIndex(0);
    setShowActions(false);
    setIsStreaming(true);

    simulateTextStreaming("This is a test message from the WebSocket assistant!").then(() => {
      setTimeout(() => {
        setShowActions(true);
        setIsStreaming(false);
      }, 1000);
    });
  };

  // Uncomment to test messaging manually (remove for production)
  // useEffect(() => {
  //   // Wait 5 seconds then test message flow
  //   const timer = setTimeout(() => {
  //     testMessage();
  //   }, 5000);
  //   return () => clearTimeout(timer);
  // }, []);

  return (
    <View style={{ flex: 1 }}>
      <ConnectionIndicator isConnected={isConnected} eventsCount={markers.length} />
      <EventAssistantWithStores />
    </View>
  );
};

export default WebSocketEventAssistant;
