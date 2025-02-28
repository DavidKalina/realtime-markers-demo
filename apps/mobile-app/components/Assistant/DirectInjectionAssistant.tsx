// Updated DirectInjectionAssistant.tsx
import React, { useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import EventAssistantWithStores from "./AnimatedAssistant";
import ConnectionIndicator from "./ConnectionIndicator";
import { useMarkerNotifications } from "@/hooks/useMarkerNotifications";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { Bug, Search, MapPin } from "lucide-react-native";
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";

/**
 * A wrapper component that injects event notifications into the existing assistant
 */
const DirectInjectionAssistant: React.FC = () => {
  // Get WebSocket data
  const { markers, isConnected } = useMapWebSocket(process.env.EXPO_PUBLIC_WEB_SOCKET_URL!);

  // Use our notification hook
  const { markerCount, triggerNotification, currentRegion } = useMarkerNotifications();

  // Get the event store for direct manipulation
  const { setEventList, setCurrentEvent } = useEventAssistantStore();

  // Effect to update the event list whenever markers change
  useEffect(() => {
    if (markers && Array.isArray(markers) && markers.length > 0) {
      // Convert markers to event format
      const events = markers.map((marker) => ({
        emoji: marker.data?.emoji || "📍",
        title: marker.data?.title || "Unnamed Event",
        description: marker.data?.description || "Join us for this exciting event!",
        location: marker.data?.location || "See map for location",
        time: marker.data?.time || new Date().toLocaleString(),
        distance: marker.data?.distance || "See map for location",
        categories: Array.isArray(marker.data?.categories)
          ? marker.data.categories
          : [marker.data?.color || "Event"],
      }));

      // Update the event list in the store
      if (typeof setEventList === "function") {
        setEventList(events);
      }

      // Set the current event to the first one if we don't have one yet
      if (typeof setCurrentEvent === "function" && events.length > 0) {
        setCurrentEvent(events[0]);
      }
    }
  }, [markers, setEventList, setCurrentEvent]);

  // Debug purposes - manually trigger notification
  const handleDebugPress = () => {
    console.log("🐞 Manual notification triggered");
    triggerNotification();
  };

  return (
    <View style={{ flex: 1 }}>
      <ConnectionIndicator isConnected={isConnected} eventsCount={markers?.length || 0} />
      <EventAssistantWithStores />

      {/* Debug button to manually trigger notification */}
      <TouchableOpacity style={styles.debugButton} onPress={handleDebugPress}>
        {markerCount > 0 ? <Bug size={20} color="#fff" /> : <Search size={20} color="#fff" />}
        <Text style={styles.debugCounter}>{markerCount}</Text>
      </TouchableOpacity>

      {/* Location indicator */}
      {currentRegion && (
        <TouchableOpacity style={styles.locationButton}>
          <MapPin size={18} color="#fff" />
          <Text style={styles.locationText}>{currentRegion}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  debugButton: {
    position: "absolute",
    top: 120,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  debugCounter: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "red",
    color: "white",
    fontSize: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    lineHeight: 20,
  },
  locationButton: {
    position: "absolute",
    top: 170,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
  },
  locationText: {
    color: "white",
    fontSize: 12,
    marginLeft: 4,
  },
});

export default DirectInjectionAssistant;
