import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import AssistantScreen from "./assistant";
import MapboxGL from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { eventSuggestions } from "@/components/Assistant/data";
import Mapbox from "@rnmapbox/maps";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

// In a real application, you should set your Mapbox access token in a secure way
// MapboxGL.setAccessToken('your_mapbox_access_token');

// Mock coordinates for the event locations
const eventCoordinates = [
  [-73.9857, 40.7484], // Example: Times Square
  [-73.9762, 40.7614], // Example: Central Park
  [-74.006, 40.7128], // Example: Downtown
  [-73.9632, 40.7799], // Example: Upper East Side
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Initialize Mapbox configuration if needed
    if (Platform.OS === "android") {
      MapboxGL.setTelemetryEnabled(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Mapbox Map as background */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark} // Dark theme to match the assistant UI
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          defaultSettings={{
            centerCoordinate: [-73.9857, 40.7484], // Central NYC area
            zoomLevel: 13,
          }}
          animationDuration={0}
        />

        {/* Map annotations for each event */}
        {eventSuggestions.map((event, index) => (
          <MapboxGL.PointAnnotation
            key={`event-${index}`}
            id={`event-${index}`}
            coordinate={eventCoordinates[index % eventCoordinates.length]}
            title={event.title}
          >
            {/* Custom marker content - Emoji */}
            <View style={styles.markerContainer}>
              <View style={styles.markerTextContainer}>
                <Text style={styles.markerText}>{event.emoji}</Text>
              </View>
            </View>
          </MapboxGL.PointAnnotation>
        ))}
      </MapboxGL.MapView>

      {/* Original AssistantScreen component positioned on top */}
      <View style={styles.assistantOverlay}>
        <AssistantScreen />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // Black background to avoid flash of white
  },
  map: {
    flex: 1,
  },
  assistantOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    pointerEvents: "box-none", // Allow touch events to pass through to map except when hitting assistant components
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
  },
  markerTextContainer: {
    backgroundColor: "#3a3a3a",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#4a4a4a",
  },
  markerText: {
    fontSize: 20,
  },
});
