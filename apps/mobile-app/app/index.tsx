import { AuthWrapper } from "@/components/AuthWrapper";
import EventAssistant from "@/components/EventAssistant/EventAssistant";
import { styles as homeScreenStyles } from "@/components/homeScreenStyles";
import { ClusteredMapMarkers } from "@/components/Markers/MarkerImplementation";
import DiscoveryIndicator from "@/components/DiscoveryIndicator/DiscoveryIndicator";
import { DEFAULT_CAMERA_SETTINGS, createCameraSettings } from "@/config/cameraConfig";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useGravitationalCamera } from "@/hooks/useGravitationalCamera";
import { useLocationCamera } from "@/hooks/useLocationCamera";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import {
  BaseEvent,
  EventTypes,
  MapItemEvent
} from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, View } from "react-native";
import StatusBar from "@/components/StatusBar/StatusBar";
import { LoadingOverlay } from "@/components/Loading/LoadingOverlay";

// Initialize MapboxGL only once, outside the component
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);
if (Platform.OS === "android") {
  MapboxGL.setTelemetryEnabled(false);
}

// Use the imported styles directly
const styles = homeScreenStyles;

// Memoized UI components
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
  const { mapStyle } = useMapStyle();

  // Initialize MapboxGL location manager with cleanup
  useEffect(() => {
    let isMounted = true;
    let locationManagerStarted = false;

    const initializeLocation = async () => {
      if (isMounted) {
        try {
          await MapboxGL.locationManager.start();
          MapboxGL.setWellKnownTileServer('mapbox');
          locationManagerStarted = true;
        } catch (error) {
          console.error('Error initializing location manager:', error);
        }
      }
    };

    initializeLocation();

    return () => {
      isMounted = false;
      if (locationManagerStarted) {
        MapboxGL.locationManager.stop();
      }
    };
  }, []);

  // Store references
  const { selectMapItem, setZoomLevel, zoomLevel } = useLocationStore();
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

  // Use the new location camera hook
  useLocationCamera({
    userLocation,
    isLoadingLocation,
    isMapReady,
    cameraRef,
    isUserInteracting: false,
  });

  // Get user location only when needed
  useEffect(() => {
    let isMounted = true;
    let updateTimeout: NodeJS.Timeout | null = null;

    const updateLocation = async () => {
      if (!userLocation && !isLoadingLocation && isMounted) {
        try {
          // Clear any pending updates
          if (updateTimeout) {
            clearTimeout(updateTimeout);
            updateTimeout = null;
          }

          // Add a small delay to prevent rapid updates
          updateTimeout = setTimeout(async () => {
            if (isMounted) {
              await getUserLocation();
            }
          }, 500);
        } catch (error) {
          console.error('Error getting user location:', error);
        }
      }
    };

    updateLocation();

    return () => {
      isMounted = false;
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    };
  }, [userLocation, isLoadingLocation, getUserLocation]);

  // Track if we've done initial centering
  const hasCenteredOnUserRef = useRef(false);

  // Update camera position only once when user location becomes available
  useEffect(() => {
    let isMounted = true;
    let cameraUpdateTimeout: NodeJS.Timeout | null = null;

    const updateCamera = () => {
      if (userLocation && !isLoadingLocation && isMapReady && cameraRef.current && !hasCenteredOnUserRef.current && isMounted) {
        // Clear any pending updates
        if (cameraUpdateTimeout) {
          clearTimeout(cameraUpdateTimeout);
          cameraUpdateTimeout = null;
        }

        // Add a small delay to prevent rapid updates
        cameraUpdateTimeout = setTimeout(() => {
          if (isMounted) {
            hasCenteredOnUserRef.current = true;
            cameraRef.current?.setCamera({
              ...DEFAULT_CAMERA_SETTINGS,
              centerCoordinate: userLocation,
            });
          }
        }, 500);
      }
    };

    updateCamera();

    return () => {
      isMounted = false;
      if (cameraUpdateTimeout) {
        clearTimeout(cameraUpdateTimeout);
      }
      hasCenteredOnUserRef.current = false;
    };
  }, [userLocation, isLoadingLocation, isMapReady]);

  // Create map item event utility
  const createMapItemEvent = useCallback((selectedItem: any): MapItemEvent['item'] => {
    return selectedItem.type === "marker"
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
  }, []);

  // Handle map item deselection
  const handleMapItemDeselection = useCallback((item: MapItemEvent['item']) => {
    publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
      timestamp: Date.now(),
      source: "MapPress",
      item,
    });
  }, [publish]);

  // Handle user interaction
  const handleUserInteraction = useCallback(() => {
    // Implementation of handleUserInteraction
  }, []);

  // Update the handleUserPan function
  const handleUserPan = useCallback(() => {
    handleUserInteraction();
    if (selectedItem) {
      selectMapItem(null);
    }
    publish<BaseEvent>(EventTypes.USER_PANNING_VIEWPORT, {
      timestamp: Date.now(),
      source: "MapPress",
    });
  }, [selectMapItem, publish, selectedItem, handleUserInteraction]);

  // Update the handleMapPress function
  const handleMapPress = useCallback(() => {
    handleUserInteraction();
    if (!selectedItem) return;

    try {
      const item = createMapItemEvent(selectedItem);
      handleMapItemDeselection(item);
      selectMapItem(null);
    } catch (error) {
      console.error("Error handling map press:", error);
      selectMapItem(null);
    }
  }, [selectMapItem, selectedItem, createMapItemEvent, handleMapItemDeselection, handleUserInteraction]);

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
    () => createCameraSettings(userLocation),
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
    return null; // Removed all indicators
  }, [shouldRenderUI]);

  const assistantOverlay = useMemo(() => {
    if (!shouldRenderUI) return null;
    return (
      <View style={styles.assistantOverlay}>
        <EventAssistant />
      </View>
    );
  }, [shouldRenderUI]);


  // Memoize markers component for better performance
  const markersComponent = useMemo(() => {
    if (!shouldRenderMarkers || !currentViewport) return null;
    return <ClusteredMapMarkers markers={markers} viewport={currentViewport} currentZoom={zoomLevel} />;
  }, [shouldRenderMarkers, markers, currentViewport, zoomLevel]);

  // Memoize user location layer
  const userLocationLayer = useMemo(() => {
    if (!locationPermissionGranted) return null;
    return <MapboxGL.UserLocation visible={true} showsUserHeadingIndicator={true} />;
  }, [locationPermissionGranted]);


  return (
    <AuthWrapper>
      <View style={styles.container}>
        {isLoadingLocation && <LoadingOverlay />}

        {!isLoadingLocation && (
          <>
            <StatusBar>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              </View>
            </StatusBar>
            <DiscoveryIndicator position="top-left" />
          </>
        )}

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
            minZoomLevel={5}
            ref={cameraRef}
            defaultSettings={defaultCameraSettings}
            animationDuration={0}
          />

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
