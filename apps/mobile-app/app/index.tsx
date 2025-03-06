import { AuthWrapper } from "@/components/AuthWrapper";
import { ConnectionIndicator } from "@/components/ConnectionIndicator/ConnectionIndicator";
import EventAssistant from "@/components/EventAssistant/EventAssistant";
import { styles } from "@/components/homeScreenStyles";
import { SimpleMapMarkers } from "@/components/Markers/MarkerImplementation";
import QueueIndicator from "@/components/QueueIndicator/QueueIndicator";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useGravitationalCamera } from "@/hooks/useGravitationalCamera";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import {
  BaseEvent,
  CameraAnimateToLocationEvent,
  EventTypes,
  UserLocationEvent,
} from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserLocationStore } from "@/stores/useUserLocationStore";
import MapboxGL from "@rnmapbox/maps";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Platform, Text, View } from "react-native";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

export default function HomeScreen() {
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const { publish } = useEventBroker();

  const { selectMarker } = useLocationStore();

  const {
    selectedMarkerId,
    userLocation,
    setUserLocation,
    locationPermissionGranted,
    setLocationPermissionGranted,
    isLoadingLocation,
    setIsLoadingLocation,
  } = useUserLocationStore();

  const mapWebSocketData = useMapWebSocket(process.env.EXPO_PUBLIC_WEB_SOCKET_URL!);
  const { markers, isConnected, updateViewport } = mapWebSocketData;

  const {
    cameraRef,
    isGravitating,
    handleViewportChange: handleGravitationalViewportChange,
  } = useGravitationalCamera(markers, {
    minMarkersForPull: 1,
    animationDuration: 500,
    cooldownPeriod: 100,
    gravityZoomLevel: 14,
    centeringThreshold: 0.002,
  });

  useEffect(() => {
    if (Platform.OS === "android") {
      MapboxGL.setTelemetryEnabled(false);
    }

    if (!userLocation) {
      getUserLocation();
    }
  }, []);

  const handleMarkerPress = useCallback(() => {
    selectMarker(null);
  }, []);

  const getUserLocation = async () => {
    try {
      setIsLoadingLocation(true);

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

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userCoords: [number, number] = [location.coords.longitude, location.coords.latitude];
      setUserLocation(userCoords);

      publish<UserLocationEvent>(EventTypes.USER_LOCATION_UPDATED, {
        timestamp: Date.now(),
        source: "HomeScreen",
        coordinates: userCoords,
      });

      if (userCoords) {
        // Emit an event to animate to the user's location after obtaining it
        publish<CameraAnimateToLocationEvent>(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
          timestamp: Date.now(),
          source: "HomeScreen",
          coordinates: userCoords,
          duration: 1000,
          zoomLevel: 14,
        });
      }
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

  const handleMapViewportChange = (feature: any) => {
    if (
      feature?.properties?.visibleBounds &&
      Array.isArray(feature.properties.visibleBounds) &&
      feature.properties.visibleBounds.length === 2 &&
      Array.isArray(feature.properties.visibleBounds[0]) &&
      Array.isArray(feature.properties.visibleBounds[1])
    ) {
      const [[west, north], [east, south]] = feature.properties.visibleBounds;

      const adjustedWest = Math.min(west, east);
      const adjustedEast = Math.max(west, east);

      updateViewport({
        north,
        south,
        east: adjustedEast,
        west: adjustedWest,
      });

      handleGravitationalViewportChange(feature);
    } else {
      console.warn("Invalid viewport bounds received:", feature?.properties?.visibleBounds);
    }
  };

  return (
    <AuthWrapper>
      <View style={styles.container}>
        {isLoadingLocation && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4dabf7" />
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        )}

        <MapboxGL.MapView
          onPress={handleMarkerPress}
          scaleBarEnabled={false}
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
          {/* Use our camera ref for more control */}
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              // Default to Orem, UT if no user location
              centerCoordinate: userLocation || [-111.694, 40.298],
              zoomLevel: 14,
            }}
            animationDuration={0}
          />

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

        {isGravitating && (
          <Animated.View
            style={[
              styles.pulseOverlay,
              {
                opacity: 0.15,
              },
            ]}
          />
        )}

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

        {isMapReady && !isLoadingLocation && (
          <View style={styles.assistantOverlay}>
            <EventAssistant />
          </View>
        )}
      </View>
    </AuthWrapper>
  );
}
