import { SimpleMapMarkers } from "@/components/MarkerImplementation";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import MapboxGL from "@rnmapbox/maps";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { eventSuggestions } from "@/components/RefactoredAssistant/data";
import { useEventAssistantStore } from "@/stores/useEventAssistantStore";
import EventDrivenAssistant from "@/components/RefactoredAssistant/Assistant";

// Set Mapbox access token
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

export default function HomeScreen() {
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const mapRef = useRef<MapboxGL.MapView>(null);

  // Get the setEventList function from the store to initialize with static data
  const { setCurrentEvent } = useEventAssistantStore();

  // Use a single WebSocket connection for the entire app
  const mapWebSocketData = useMapWebSocket(process.env.EXPO_PUBLIC_WEB_SOCKET_URL!);

  const { markers, isConnected, updateViewport, currentViewport } = mapWebSocketData;

  // Log marker updates for debugging
  useEffect(() => {
    console.log(`HomeScreen: WebSocket markers updated, count=${markers.length}`);
  }, [markers.length]);

  // Initialize the event assistant store with static data
  useEffect(() => {
    // Set the current event to the first one
    if (eventSuggestions.length > 0) {
      setCurrentEvent(eventSuggestions[0]);
    }
  }, []);

  useEffect(() => {
    // Initialize Mapbox configuration
    if (Platform.OS === "android") {
      MapboxGL.setTelemetryEnabled(false);
    }

    // Get user location permission and coordinates
    const getUserLocation = async () => {
      try {
        setIsLoadingLocation(true);
        console.log("Starting location acquisition process");

        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log("Location permission status:", status);

        if (status !== "granted") {
          setLocationPermissionGranted(false);
          Alert.alert(
            "Permission Denied",
            "Allow location access to center the map on your position.",
            [{ text: "OK" }]
          );
          setIsLoadingLocation(false);
          return;
        }

        setLocationPermissionGranted(true);

        // Disable caching and request high accuracy for testing
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        // Update state with user coordinates in [longitude, latitude] format for Mapbox
        setUserLocation([location.coords.longitude, location.coords.latitude]);
      } catch (error) {
        console.error("Error getting location:", error);
        Alert.alert(
          "Location Error",
          "Couldn't determine your location. Using default location instead.",
          [{ text: "OK" }]
        );
      } finally {
        setIsLoadingLocation(false);
      }
    };

    getUserLocation();
  }, []);

  // Handle map viewport changes
  const handleMapViewportChange = (feature: any) => {
    // Safely access the bounds properties with proper checks
    if (
      feature?.properties?.visibleBounds &&
      Array.isArray(feature.properties.visibleBounds) &&
      feature.properties.visibleBounds.length === 2 &&
      Array.isArray(feature.properties.visibleBounds[0]) &&
      Array.isArray(feature.properties.visibleBounds[1])
    ) {
      // Mapbox GL native visibleBounds format is [[west, north], [east, south]]
      const [[west, north], [east, south]] = feature.properties.visibleBounds;

      // For longitude values (east/west), ensure west <= east for RBush spatial indexing
      const adjustedWest = Math.min(west, east);
      const adjustedEast = Math.max(west, east);

      // Send adjusted coordinates to match RBush requirements
      updateViewport({
        north,
        south,
        east: adjustedEast,
        west: adjustedWest,
      });
    } else {
      console.warn("Invalid viewport bounds received:", feature?.properties?.visibleBounds);
    }
  };

  return (
    <View style={styles.container}>
      {/* Loading indicator while getting location */}
      {isLoadingLocation && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4dabf7" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      )}

      {/* Mapbox Map as background */}
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Light}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => {
          console.log("Map finished loading");
          setIsMapReady(true);
        }}
        onRegionDidChange={handleMapViewportChange}
      >
        {userLocation ? (
          <MapboxGL.Camera
            centerCoordinate={userLocation}
            zoomLevel={14}
            animationDuration={1000}
          />
        ) : (
          <MapboxGL.Camera
            defaultSettings={{
              // Default to Orem, UT
              centerCoordinate: [-111.694, 40.298],
              zoomLevel: 14,
            }}
            animationDuration={0}
          />
        )}

        {/* User location marker */}
        {userLocation && locationPermissionGranted && (
          <MapboxGL.PointAnnotation
            id="userLocation"
            coordinate={userLocation}
            title="Your Location"
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* Custom Map Markers - Using our simplified component */}
        {isMapReady && <SimpleMapMarkers markers={markers} />}

        {/* Add user location layer for the blue dot */}
        {locationPermissionGranted && (
          <MapboxGL.UserLocation visible={true} showsUserHeadingIndicator={true} />
        )}
      </MapboxGL.MapView>

      {/* Pass WebSocket data as props to EventDrivenAssistant */}
      <View style={styles.assistantOverlay}>
        {isMapReady && (
          <EventDrivenAssistant
            markers={markers}
            isConnected={isConnected}
            currentViewport={currentViewport}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
    pointerEvents: "box-none", // Allow touch events to pass through to map
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingText: {
    color: "#f8f9fa",
    fontSize: 16,
    marginTop: 12,
    fontFamily: "SpaceMono",
  },
  userLocationMarker: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#4dabf7",
    borderWidth: 3,
    borderColor: "#fff",
  },
});
