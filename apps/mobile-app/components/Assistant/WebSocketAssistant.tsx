import React, { useEffect } from "react";
import { View } from "react-native";
import EventAssistantWithStores from "./AnimatedAssistant";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { useMarkerStore } from "@/stores/markerStore";
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";
import { EventType } from "./types";
import ConnectionIndicator from "./ConnectionIndicator";

// This is your WebSocket URL - you'll need to provide the actual URL
const WEBSOCKET_URL = `wss://20b3-69-162-231-94.ngrok-free.app`;

// Convert a marker to the EventType format used by the assistant
const markerToEvent = (marker: any): EventType => {
  // Ensure marker and its properties are valid
  if (!marker || typeof marker !== "object") {
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

  // Safely get data properties with defaults
  const data = marker.data || {};
  const coordinates =
    Array.isArray(marker.coordinates) && marker.coordinates.length >= 2
      ? marker.coordinates
      : [0, 0];

  // Safely format coordinates
  const formattedCoords = coordinates
    .map((coord: any) => (typeof coord === "number" ? coord.toFixed(4) : "0.0000"))
    .join(", ");

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

  return {
    emoji: data.emoji || "📍", // Use marker emoji or default
    title: data.title || "Unnamed Event",
    description: `Event spotted at coordinates [${formattedCoords}]`,
    location: data.location || `Location ${idSubstring}`,
    time: timeString,
    distance: data.distance || "Distance unknown", // Would need user location to calculate
    categories: Array.isArray(data.categories) ? data.categories : [data.color || "Event"], // Use categories array or color as category
  };
};

const WebSocketEventAssistant: React.FC = () => {
  // Connect to WebSocket and get markers
  const { markers, isConnected } = useMapWebSocket(WEBSOCKET_URL);

  // Get store actions
  const { setCurrentEvent, setEventList } = useEventAssistantStore();

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

        // Set the current event to the first marker if not already set
        if (events.length > 0) {
          setCurrentEvent(events[0]);
        }

        console.log(`Updated event assistant with ${events.length} events from WebSocket`);
      } else {
        console.log("No valid markers received from WebSocket");
      }
    } catch (error) {
      console.error("Error updating events from markers:", error);
    }
  }, [markers, setCurrentEvent, setEventList]);

  return (
    <View style={{ flex: 1 }}>
      <ConnectionIndicator isConnected={isConnected} eventsCount={markers.length} />
      <EventAssistantWithStores />
    </View>
  );
};

export default WebSocketEventAssistant;
