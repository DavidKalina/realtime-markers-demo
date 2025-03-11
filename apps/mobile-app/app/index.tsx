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
import {
  BaseEvent,
  EventTypes,
  MapItemEvent,
  MarkerItem,
  ClusterItem,
} from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ActivityIndicator, Animated, Platform, Text, View } from "react-native";

// Initialize MapboxGL only once, outside the component
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);
if (Platform.OS === "android") {
  MapboxGL.setTelemetryEnabled(false);
}

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

// Configuration constants
const GRAVITATIONAL_CAMERA_CONFIG = {
  minMarkersForPull: 1,
  animationDuration: 500,
  cooldownPeriod: 2000,
  gravityZoomLevel: 14,
  centeringThreshold: 0.003,
  velocitySampleSize: 3,
  velocityMeasurementWindow: 200,
};

function HomeScreen() {
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const { publish } = useEventBroker();

  // Store references
  const { selectMapItem } = useLocationStore();
  const selectedItem = useLocationStore((state) => state.selectedItem);

  // User location hooks
  const { userLocation, locationPermissionGranted, isLoadingLocation, getUserLocation } =
    useUserLocation();

  // WebSocket and map data
  const { markers, isConnected, updateViewport, currentViewport } = useMapWebSocket(
    process.env.EXPO_PUBLIC_WEB_SOCKET_URL!
  );

  // Gravitational camera hook with memoized config
  const {
    cameraRef,
    isGravitating,
    handleViewportChange: handleGravitationalViewportChange,
  } = useGravitationalCamera(markers, GRAVITATIONAL_CAMERA_CONFIG);

  // Get user location only when needed
  useEffect(() => {
    if (!userLocation) {
      getUserLocation();
    }

    // Return cleanup function - empty since we moved MapboxGL setup outside component
    return () => {};
  }, [userLocation, getUserLocation]);

  // Memoize map press handler to avoid recreation on each render
  const handleMapPress = useCallback(() => {
    if (!selectedItem) return;

    // Create appropriate item type based on selection
    if (selectedItem.type === "marker") {
      const markerItem: MarkerItem = {
        id: selectedItem.id,
        type: "marker",
        coordinates: selectedItem.coordinates,
        markerData: selectedItem.data,
      };

      publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
        timestamp: Date.now(),
        source: "MapPress",
        item: markerItem,
      });
    } else {
      const clusterItem: ClusterItem = {
        id: selectedItem.id,
        type: "cluster",
        coordinates: selectedItem.coordinates,
        count: selectedItem.count,
        childMarkers: selectedItem.childrenIds,
      };

      publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
        timestamp: Date.now(),
        source: "MapPress",
        item: clusterItem,
      });
    }

    // Clear selection in store
    selectMapItem(null);
  }, [selectMapItem, selectedItem, publish]);

  // Extracted viewport processing to a separate function for clarity
  const processViewportBounds = useCallback((bounds: any) => {
    if (
      !bounds ||
      !Array.isArray(bounds) ||
      bounds.length !== 2 ||
      !Array.isArray(bounds[0]) ||
      !Array.isArray(bounds[1])
    ) {
      return null;
    }

    const [[west, north], [east, south]] = bounds;
    return {
      north,
      south,
      east: Math.max(west, east),
      west: Math.min(west, east),
    };
  }, []);

  // Memoize viewport change handler with error handling
  const handleMapViewportChange = useCallback(
    (feature: any) => {
      try {
        const viewport = processViewportBounds(feature?.properties?.visibleBounds);
        if (viewport) {
          updateViewport(viewport);
          handleGravitationalViewportChange(feature);
        }
      } catch (error) {
        console.error("Error processing viewport change:", error);
      }
    },
    [updateViewport, handleGravitationalViewportChange, processViewportBounds]
  );

  // Memoize user pan handler
  const handleUserPan = useCallback(() => {
    if (selectedItem) {
      selectMapItem(null);
    }

    publish<BaseEvent>(EventTypes.USER_PANNING_VIEWPORT, {
      timestamp: Date.now(),
      source: "MapPress",
    });
  }, [selectMapItem, publish, selectedItem]);

  // Memoize map ready handler
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    publish<BaseEvent>(EventTypes.MAP_READY, {
      timestamp: Date.now(),
      source: "HomeScreen",
    });
  }, [publish]);

  // Memoize region changing handler
  const handleRegionChanging = useCallback(
    (feature: any) => {
      handleMapViewportChange(feature);
      publish<BaseEvent>(EventTypes.VIEWPORT_CHANGING, {
        timestamp: Date.now(),
        source: "HomeScreen",
      });
    },
    [handleMapViewportChange, publish]
  );

  // Memoize default camera settings
  const defaultCameraSettings = useMemo(
    () => ({
      centerCoordinate: userLocation!,
      zoomLevel: 14,
    }),
    [userLocation]
  );

  // Memoize rendering conditions
  const shouldRenderMarkers = useMemo(
    () => isMapReady && !isLoadingLocation && currentViewport !== null,
    [isMapReady, isLoadingLocation, currentViewport]
  );

  const shouldRenderUI = useMemo(
    () => isMapReady && !isLoadingLocation,
    [isMapReady, isLoadingLocation]
  );

  // Memoize UI elements to prevent unnecessary rerenders
  const mapOverlays = useMemo(() => {
    if (!shouldRenderUI) return null;

    return (
      <>
        <ConnectionIndicator
          eventsCount={markers.length}
          initialConnectionState={isConnected}
          position="top-right"
          showAnimation={!selectedItem}
        />
        <QueueIndicator position="top-left" />
      </>
    );
  }, [shouldRenderUI, markers.length, isConnected, selectedItem]);

  const assistantOverlay = useMemo(() => {
    if (!shouldRenderUI) return null;

    return (
      <View style={styles.assistantOverlay}>
        <EventAssistant />
      </View>
    );
  }, [shouldRenderUI]);

  // Memoize the user location element
  const userLocationElement = useMemo(() => {
    if (!userLocation || !locationPermissionGranted) return null;

    return <UserLocationPoint userLocation={userLocation} />;
  }, [userLocation, locationPermissionGranted]);

  // Memoize markers component for better performance
  const markersComponent = useMemo(() => {
    if (!shouldRenderMarkers) return null;

    return <ClusteredMapMarkers markers={markers} viewport={currentViewport!} />;
  }, [shouldRenderMarkers, markers, currentViewport]);

  // Memoize user location layer
  const userLocationLayer = useMemo(() => {
    if (!locationPermissionGranted) return null;

    return <MapboxGL.UserLocation visible={true} showsUserHeadingIndicator={true} />;
  }, [locationPermissionGranted]);

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
          {/* Camera with ref for control */}
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={defaultCameraSettings}
            animationDuration={0}
          />

          {/* User location marker */}
          {userLocationElement}

          {/* Map Markers */}
          {markersComponent}

          {/* User location layer */}
          {userLocationLayer}
        </MapboxGL.MapView>

        {isGravitating && <GravitatingOverlay />}

        {mapOverlays}
        {assistantOverlay}
      </View>
    </AuthWrapper>
  );
}

export default React.memo(HomeScreen);
