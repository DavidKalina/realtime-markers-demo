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
import { BaseEvent, EventTypes, MapItemEvent } from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ActivityIndicator, Animated, Platform, Text, View } from "react-native";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

// Memoized UI components
const LoadingOverlay = React.memo(() => (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color="#4dabf7" />
    <Text style={styles.loadingText}>Getting your location...</Text>
  </View>
));

const UserLocationPoint = React.memo(({ userLocation }: { userLocation: [number, number] }) => (
  <MapboxGL.PointAnnotation id="userLocation" coordinate={userLocation} title="Your Location">
    <View style={styles.userLocationMarker}>
      <View style={styles.userLocationDot} />
    </View>
  </MapboxGL.PointAnnotation>
));

const GravitatingOverlay = React.memo(() => (
  <Animated.View
    style={[
      styles.pulseOverlay,
      {
        opacity: 0.15,
      },
    ]}
  />
));

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

  // Only run setup effect when needed
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
  }, [userLocation, getUserLocation]);

  // Memoize map press handler to prevent recreation on each render
  const handleMapPress = useCallback(() => {
    // Only proceed if we actually have a selected item
    if (selectedItem) {
      // First publish the MAP_ITEM_DESELECTED event before clearing the selection
      // Import the exact types from EventBroker.tsx to ensure type compatibility
      // We need to create the properly typed item for the MapItemEvent
      if (selectedItem.type === "marker") {
        // Create a MarkerItem compatible with EventBroker's definition
        const markerItem: import("@/services/EventBroker").MarkerItem = {
          id: selectedItem.id,
          type: "marker",
          coordinates: selectedItem.coordinates,
          markerData: selectedItem.data,
        };

        // Publish with correct typing
        publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
          timestamp: Date.now(),
          source: "MapPress",
          item: markerItem,
        });
      } else {
        // Create a ClusterItem compatible with EventBroker's definition
        const clusterItem: import("@/services/EventBroker").ClusterItem = {
          id: selectedItem.id,
          type: "cluster",
          coordinates: selectedItem.coordinates,
          count: selectedItem.count,
          childMarkers: selectedItem.childrenIds,
        };

        // Publish with correct typing
        publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
          timestamp: Date.now(),
          source: "MapPress",
          item: clusterItem,
        });
      }

      // Then clear the selection in the store
      selectMapItem(null);
    }
  }, [selectMapItem, selectedItem, publish]);

  // Memoize viewport change handler
  const handleMapViewportChange = useCallback(
    (feature: any) => {
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
    },
    [updateViewport, handleGravitationalViewportChange]
  );

  // Memoize user pan handler
  const handleUserPan = useCallback(() => {
    selectMapItem(null);

    publish<BaseEvent>(EventTypes.USER_PANNING_VIEWPORT, {
      timestamp: Date.now(),
      source: "MapPress",
    });
  }, [selectMapItem, publish]);

  // Memoize map ready handler
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);

    // Emit map ready event
    publish<BaseEvent>(EventTypes.MAP_READY, {
      timestamp: Date.now(),
      source: "HomeScreen",
    });
  }, [publish]);

  // Memoize region changing handler
  const handleRegionChanging = useCallback(
    (feature: any) => {
      handleMapViewportChange(feature);
      publish<BaseEvent>(EventTypes.VIEWPORT_CHANGING, { timestamp: Date.now() });
    },
    [handleMapViewportChange, publish]
  );

  // Memoize default camera settings
  const defaultCameraSettings = useMemo(
    () => ({
      // Default to Orem, UT if no user location
      centerCoordinate: userLocation!,
      zoomLevel: 14,
    }),
    [userLocation]
  );

  // Determine if we should render markers
  const shouldRenderMarkers = useMemo(
    () => isMapReady && !isLoadingLocation && currentViewport !== null,
    [isMapReady, isLoadingLocation, currentViewport]
  );

  // Determine if we should render UI elements
  const shouldRenderUI = useMemo(
    () => isMapReady && !isLoadingLocation,
    [isMapReady, isLoadingLocation]
  );

  return (
    <AuthWrapper>
      <View style={styles.container}>
        {isLoadingLocation && <LoadingOverlay />}

        <MapboxGL.MapView
          onTouchStart={handleUserPan}
          onPress={handleMapPress}
          scaleBarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          ref={mapRef}
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Light}
          logoEnabled={false}
          attributionEnabled={false}
          onDidFinishLoadingMap={handleMapReady}
          onRegionIsChanging={handleRegionChanging}
        >
          {/* Use our camera ref for more control */}
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={defaultCameraSettings}
            animationDuration={0}
          />

          {/* User location marker */}
          {userLocation && locationPermissionGranted && (
            <UserLocationPoint userLocation={userLocation} />
          )}

          {/* Custom Map Markers - Using our optimized component with unified selection */}
          {shouldRenderMarkers && (
            <ClusteredMapMarkers markers={markers} viewport={currentViewport!} />
          )}

          {/* Add user location layer for the blue dot */}
          {locationPermissionGranted && (
            <MapboxGL.UserLocation visible={true} showsUserHeadingIndicator={true} />
          )}
        </MapboxGL.MapView>

        {isGravitating && <GravitatingOverlay />}

        {shouldRenderUI && (
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

        {shouldRenderUI && (
          <View style={styles.assistantOverlay}>
            <EventAssistant />
          </View>
        )}
      </View>
    </AuthWrapper>
  );
}
