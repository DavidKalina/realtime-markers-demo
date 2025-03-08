import { AuthWrapper } from "@/components/AuthWrapper";
import { ConnectionIndicator } from "@/components/ConnectionIndicator/ConnectionIndicator";
import EventAssistant from "@/components/EventAssistant/EventAssistant";
import { styles } from "@/components/homeScreenStyles";
import { ClusteredMapMarkers } from "@/components/Markers/MarkerImplementation";
import QueueIndicator from "@/components/QueueIndicator/QueueIndicator";
import { useUserLocation } from "@/contexts/LocationContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useGravitationalCamera } from "@/hooks/useGravitationalCamera";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { BaseEvent, EventTypes } from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Text, View } from "react-native";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

export default function HomeScreen() {
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const { publish } = useEventBroker();

  // Use the selectMapItem from the updated store
  const { selectMapItem } = useLocationStore();

  // We can keep references to these for backward compatibility
  const selectedItem = useLocationStore((state) => state.selectedItem);

  const { userLocation, locationPermissionGranted, isLoadingLocation, getUserLocation } =
    useUserLocation();

  const mapWebSocketData = useMapWebSocket(process.env.EXPO_PUBLIC_WEB_SOCKET_URL!);
  const { markers, isConnected, updateViewport, currentViewport } = mapWebSocketData;

  const {
    cameraRef,
    isGravitating,
    handleViewportChange: handleGravitationalViewportChange,
  } = useGravitationalCamera(markers, {
    minMarkersForPull: 1,
    animationDuration: 500,
    cooldownPeriod: 2000, // Higher cooldown period
    gravityZoomLevel: 14,
    centeringThreshold: 0.003, // Slightly higher threshold
    velocitySampleSize: 3, // Reduced sample size
    velocityMeasurementWindow: 200, // Shorter measurement window
  });

  useEffect(() => {
    // Setup code for MapboxGL
    if (Platform.OS === "android") {
      MapboxGL.setTelemetryEnabled(false);
    }

    // Get user location if needed
    if (!userLocation) {
      getUserLocation();
    }

    // Return cleanup function
    return () => {
      // Clean up any MapboxGL resources
      if (mapRef.current) {
        // MapboxGL cleanup if needed
      }
      if (cameraRef.current) {
        // Camera cleanup if needed
      }
    };
  }, [userLocation]);

  // Clear selection when map is pressed (not on a marker)
  const handleMarkerPress = useCallback(() => {
    selectMapItem(null);
  }, [selectMapItem]);

  const handleMapViewportChange = (feature: any) => {
    try {
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
    } catch (error) {
      console.error("Error processing viewport change:", error);
      // Provide fallback behavior or recovery mechanism
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
              centerCoordinate: userLocation!,
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

          {/* Custom Map Markers - Using our simplified component with unified selection */}
          {isMapReady && !isLoadingLocation && currentViewport && (
            <ClusteredMapMarkers markers={markers} viewport={currentViewport} />
          )}

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
              showAnimation={!selectedItem}
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
