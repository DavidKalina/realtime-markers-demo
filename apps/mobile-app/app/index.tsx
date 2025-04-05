import { AuthWrapper } from "@/components/AuthWrapper";
import { ConnectionIndicator } from "@/components/ConnectionIndicator/ConnectionIndicator";
import EventAssistant from "@/components/EventAssistant/EventAssistant";
import FilterIndicator from "@/components/FilterIndicator/FilterIndicator";
import { styles } from "@/components/homeScreenStyles";
import { ClusteredMapMarkers } from "@/components/Markers/MarkerImplementation";
import QueueIndicator from "@/components/QueueIndicator/QueueIndicator";
import RightIndicatorsContainer from "@/components/RightIndicatorsContainer";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useGravitationalCamera } from "@/hooks/useGravitationalCamera";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import {
  BaseEvent,
  EventTypes,
  MapItemEvent
} from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Text, View } from "react-native";

// Initialize MapboxGL only once, outside the component
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);
if (Platform.OS === "android") {
  MapboxGL.setTelemetryEnabled(false);
}

// Initialize location module
MapboxGL.locationManager.start();
MapboxGL.setWellKnownTileServer('Mapbox');

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

// Default camera settings
const DEFAULT_CAMERA_SETTINGS = {
  zoomLevel: 14,
  animationDuration: 1000,
  animationMode: "easeTo" as const,
};

function HomeScreen() {
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const { publish } = useEventBroker();
  const { mapStyle } = useMapStyle();

  // Store references
  const { selectMapItem, setZoomLevel } = useLocationStore();
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
    if (!userLocation && !isLoadingLocation) {
      getUserLocation();
    }
  }, [userLocation, isLoadingLocation, getUserLocation]);

  // Track if we've done initial centering
  const hasCenteredOnUserRef = useRef(false);

  // Update camera position only once when user location becomes available
  useEffect(() => {
    if (userLocation && !isLoadingLocation && isMapReady && cameraRef.current && !hasCenteredOnUserRef.current) {
      hasCenteredOnUserRef.current = true;
      cameraRef.current.setCamera({
        ...DEFAULT_CAMERA_SETTINGS,
        centerCoordinate: userLocation,
      });
    }
  }, [userLocation, isLoadingLocation, isMapReady]);

  // Memoize map press handler to avoid recreation on each render
  const handleMapPress = useCallback(() => {
    if (!selectedItem) return;

    try {
      // Create appropriate item type based on selection
      const item: MapItemEvent['item'] = selectedItem.type === "marker"
        ? {
          id: selectedItem.id,
          type: "marker",
          coordinates: selectedItem.coordinates,
          markerData: selectedItem.data,
        }
        : {
          id: selectedItem.id,
          type: "cluster",
          coordinates: selectedItem.coordinates,
          count: selectedItem.count,
          childMarkers: selectedItem.childrenIds,
        };

      publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
        timestamp: Date.now(),
        source: "MapPress",
        item,
      });

      // Clear selection in store
      selectMapItem(null);
    } catch (error) {
      console.error("Error handling map press:", error);
      // Ensure selection is cleared even if there's an error
      selectMapItem(null);
    }
  }, [selectMapItem, selectedItem, publish]);

  // Extracted viewport processing to a separate function for clarity
  const processViewportBounds = useCallback((bounds: unknown): { north: number; south: number; east: number; west: number; } | null => {
    if (!bounds || !Array.isArray(bounds) || bounds.length !== 2) return null;

    const [northWest, southEast] = bounds;
    if (!Array.isArray(northWest) || !Array.isArray(southEast)) return null;

    const [west, north] = northWest;
    const [east, south] = southEast;

    if (typeof west !== 'number' || typeof north !== 'number' ||
      typeof east !== 'number' || typeof south !== 'number') return null;

    return {
      north,
      south,
      east: Math.max(west, east),
      west: Math.min(west, east),
    };
  }, []);

  // Memoize viewport change handler with error handling
  const handleMapViewportChange = useCallback(
    (feature: unknown) => {
      try {
        if (!feature || typeof feature !== 'object') return;

        const properties = (feature as any).properties;
        if (!properties) return;

        const viewport = processViewportBounds(properties.visibleBounds);
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
    (feature: unknown) => {
      try {
        if (!feature || typeof feature !== 'object') return;

        const properties = (feature as any).properties;
        if (!properties) return;

        const zoomLevel = properties.zoomLevel;
        if (typeof zoomLevel === "number") {
          setZoomLevel(zoomLevel);
        }

        handleMapViewportChange(feature);
        publish<BaseEvent>(EventTypes.VIEWPORT_CHANGING, {
          timestamp: Date.now(),
          source: "HomeScreen",
        });
      } catch (error) {
        console.error("Error handling region change:", error);
      }
    },
    [handleMapViewportChange, publish, setZoomLevel]
  );

  // Memoize default camera settings with null check
  const defaultCameraSettings = useMemo(
    () => ({
      ...DEFAULT_CAMERA_SETTINGS,
      centerCoordinate: userLocation || [0, 0], // Fallback to [0,0] if userLocation is null
    }),
    [userLocation]
  );

  // Memoize rendering conditions
  const shouldRenderMarkers = useMemo(
    () => Boolean(isMapReady && !isLoadingLocation && currentViewport),
    [isMapReady, isLoadingLocation, currentViewport]
  );

  const shouldRenderUI = useMemo(
    () => Boolean(isMapReady && !isLoadingLocation),
    [isMapReady, isLoadingLocation]
  );

  // Memoize UI elements to prevent unnecessary rerenders
  const mapOverlays = useMemo(() => {
    if (!shouldRenderUI) return null;

    return (
      <>
        <ConnectionIndicator
          initialConnectionState={isConnected}
          position="top-left"
          showAnimation={!selectedItem}
        />
        <QueueIndicator position="top-left" />
        <FilterIndicator position="top-left" />
        <RightIndicatorsContainer />
      </>
    );
  }, [shouldRenderUI, isConnected, selectedItem]);

  const assistantOverlay = useMemo(() => {
    if (!shouldRenderUI) return null;
    return (
      <View style={styles.assistantOverlay}>
        <EventAssistant />
      </View>
    );
  }, [shouldRenderUI]);

  // Memoize the user location element with null check
  const userLocationElement = useMemo(() => {
    if (!userLocation || !locationPermissionGranted) return null;
    return <UserLocationPoint userLocation={userLocation} />;
  }, [userLocation, locationPermissionGranted]);

  // Memoize markers component for better performance
  const markersComponent = useMemo(() => {
    if (!shouldRenderMarkers || !currentViewport) return null;
    return <ClusteredMapMarkers markers={markers} viewport={currentViewport} />;
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
          styleURL={mapStyle}
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
