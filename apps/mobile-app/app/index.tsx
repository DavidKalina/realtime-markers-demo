// screens/HomeScreen.tsx
import { SimpleMapMarkers } from "@/components/MarkerImplementation";
import EventAssistant from "@/components/RefactoredAssistant/EventAssistant";
import ConnectionIndicator from "@/components/RefactoredAssistant/ConnectionIndicator";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { BaseEvent, EventTypes } from "@/services/EventBroker";
import MapboxGL from "@rnmapbox/maps";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useLocationStore } from "@/stores/useLocationStore";
import QueueIndicator from "@/components/RefactoredAssistant/QueueIndicator";
import { useUserLocationStore } from "@/stores/useUserLocationStore";

// Set Mapbox access token
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

export default function HomeScreen() {
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const { publish } = useEventBroker();

  // Get everything from the location store
  const {
    selectedMarkerId,
    userLocation,
    setUserLocation,
    locationPermissionGranted,
    setLocationPermissionGranted,
    isLoadingLocation,
    setIsLoadingLocation,
  } = useUserLocationStore();

  // Use a single WebSocket connection for the entire app
  const mapWebSocketData = useMapWebSocket(process.env.EXPO_PUBLIC_WEB_SOCKET_URL!);
  const { markers, isConnected, updateViewport } = mapWebSocketData;

  useEffect(() => {
    // Initialize Mapbox configuration
    if (Platform.OS === "android") {
      MapboxGL.setTelemetryEnabled(false);
    }

    // Only fetch location if we don't already have it
    if (!userLocation) {
      getUserLocation();
    }
  }, [userLocation, publish]);

  // Get user location permission and coordinates
  const getUserLocation = async () => {
    try {
      setIsLoadingLocation(true);

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();

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
      const userCoords: [number, number] = [location.coords.longitude, location.coords.latitude];
      setUserLocation(userCoords);

      // Emit user location updated event
      publish<BaseEvent & { coordinates: [number, number] }>(EventTypes.USER_LOCATION_UPDATED, {
        timestamp: Date.now(),
        source: "HomeScreen",
        coordinates: userCoords,
      });
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert(
        "Location Error",
        "Couldn't determine your location. Using default location instead.",
        [{ text: "OK" }]
      );

      // Emit error event
      publish<BaseEvent & { error: string }>(EventTypes.ERROR_OCCURRED, {
        timestamp: Date.now(),
        source: "HomeScreen",
        error: "Failed to get user location",
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

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
        rotateEnabled={false}
        pitchEnabled={false}
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Light}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => {
          setIsMapReady(true);

          // Emit map ready event
          publish<BaseEvent>(EventTypes.MAP_READY, {
            timestamp: Date.now(),
            source: "HomeScreen",
          });
        }}
        onRegionIsChanging={(feature) => {
          handleMapViewportChange(feature);
          publish<BaseEvent>(EventTypes.VIEWPORT_CHANGING, { timestamp: Date.now() });
        }}
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
        {isMapReady && !isLoadingLocation && <SimpleMapMarkers markers={markers} />}

        {/* Add user location layer for the blue dot */}
        {locationPermissionGranted && (
          <MapboxGL.UserLocation visible={true} showsUserHeadingIndicator={true} />
        )}
      </MapboxGL.MapView>

      {/* Always visible ConnectionIndicator */}
      {isMapReady && !isLoadingLocation && (
        <>
          <ConnectionIndicator
            eventsCount={markers.length}
            initialConnectionState={isConnected}
            position="top-right"
            showAnimation={!selectedMarkerId}
          />
          <QueueIndicator position="top-left" />
        </>
      )}

      {/* Only show Assistant when a marker is selected */}
      {isMapReady && !isLoadingLocation && (
        <View style={styles.assistantOverlay}>
          <EventAssistant />
        </View>
      )}
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
    bottom: 0,
    left: 0,
    right: 0,
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
