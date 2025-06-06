/* eslint-disable prefer-const */
import { AuthWrapper } from "@/components/AuthWrapper";
import { styles as homeScreenStyles } from "@/components/homeScreenStyles";
import { LoadingOverlay } from "@/components/Loading/LoadingOverlay";
import { MapRippleEffect } from "@/components/MapRippleEffect/MapRippleEffect";
import { ClusteredMapMarkers } from "@/components/Markers/MarkerImplementation";
import StatusBar from "@/components/StatusBar/StatusBar";
import DateRangeIndicator from "@/components/StatusBar/DateRangeIndicator";
import { ViewportRectangle } from "@/components/ViewportRectangle/ViewportRectangle";
import {
  DEFAULT_CAMERA_SETTINGS,
  createCameraSettings,
} from "@/config/cameraConfig";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useMapCamera } from "@/hooks/useMapCamera";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { useSimulatedNotifications } from "@/hooks/useSimulatedNotifications";
import { BaseEvent, EventTypes, MapItemEvent } from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import { MapboxViewport } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapboxGL from "@rnmapbox/maps";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, View } from "react-native";
import { runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/components/Layout/ScreenLayout";

// Initialize MapboxGL only once, outside the component
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);
if (Platform.OS === "android") {
  MapboxGL.setTelemetryEnabled(false);
}

// Initialize location module
MapboxGL.locationManager.start();
MapboxGL.setWellKnownTileServer("mapbox");

// Use the imported styles directly
const styles = {
  ...homeScreenStyles,
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  mapContainer: {
    flex: 1,
  },
  statusBarSpacer: {
    height: 80, // Match the height of the StatusBar component
  },
  floatingDateButton: {
    position: "absolute" as const,
    top: 100, // Position below the status bar
    right: 16,
    zIndex: 1000,
    backgroundColor: "rgba(26, 26, 26, 0.9)",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
};

function HomeScreen() {
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const { publish } = useEventBroker();
  const { mapStyle, isPitched } = useMapStyle();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Store references
  const { selectMapItem, setZoomLevel, zoomLevel } = useLocationStore();
  const selectedItem = useLocationStore((state) => state.selectedItem);

  // User location hooks
  const {
    userLocation,
    locationPermissionGranted,
    isLoadingLocation,
    getUserLocation,
  } = useUserLocation();

  // WebSocket and map data
  const { markers, updateViewport, currentViewport } = useMapWebSocket(
    process.env.EXPO_PUBLIC_WEB_SOCKET_URL!,
  );

  // Use the new map camera hook
  useMapCamera({ cameraRef });

  // Track if we've done initial centering
  const hasCenteredOnUserRef = useRef(false);
  const [hasRequestedInitialLocation, setHasRequestedInitialLocation] =
    useState(false);

  // Load initial location request state
  useEffect(() => {
    const loadInitialLocationState = async () => {
      try {
        const hasRequested = await AsyncStorage.getItem(
          "hasRequestedInitialLocation",
        );
        if (hasRequested === "true") {
          setHasRequestedInitialLocation(true);
        }
      } catch (error) {
        console.error(
          "[HomeScreen] Error loading initial location state:",
          error,
        );
      }
    };
    loadInitialLocationState();
  }, []);

  // Get user location only when needed
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkLocation = async () => {
      if (!userLocation && !isLoadingLocation && !hasRequestedInitialLocation) {
        // Only request location if we don't have a valid cached location
        if (!userLocation) {
          setHasRequestedInitialLocation(true);
          await AsyncStorage.setItem("hasRequestedInitialLocation", "true");
          getUserLocation();
        } else {
          console.log("[HomeScreen] Using existing location:", userLocation);
        }
      }
    };

    // Debounce the effect to prevent multiple rapid triggers
    timeoutId = setTimeout(checkLocation, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    userLocation,
    isLoadingLocation,
    getUserLocation,
    hasRequestedInitialLocation,
  ]);

  // Update camera position only once when user location becomes available
  useEffect(() => {
    if (
      userLocation &&
      !isLoadingLocation &&
      isMapReady &&
      cameraRef.current &&
      !hasCenteredOnUserRef.current
    ) {
      hasCenteredOnUserRef.current = true;
      cameraRef.current.setCamera({
        ...DEFAULT_CAMERA_SETTINGS,
        centerCoordinate: userLocation,
      });
    }
  }, [userLocation, isLoadingLocation, isMapReady]);

  // Cleanup Mapbox location manager on unmount
  useEffect(() => {
    return () => {
      MapboxGL.locationManager.stop();
    };
  }, []);

  // Create map item event utility
  const createMapItemEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selectedItem: any): MapItemEvent["item"] => {
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
    },
    [],
  );

  // Handle map item deselection
  const handleMapItemDeselection = useCallback(
    (item: MapItemEvent["item"]) => {
      publish<MapItemEvent>(EventTypes.MAP_ITEM_DESELECTED, {
        timestamp: Date.now(),
        source: "MapPress",
        item,
      });
    },
    [publish],
  );

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
  }, [
    selectMapItem,
    selectedItem,
    createMapItemEvent,
    handleMapItemDeselection,
    handleUserInteraction,
  ]);

  // Extracted viewport processing to a separate function for clarity
  const processViewportBounds = useCallback(
    (
      bounds: unknown,
    ): { north: number; south: number; east: number; west: number } | null => {
      if (!bounds || !Array.isArray(bounds) || bounds.length !== 2) return null;

      const [northWest, southEast] = bounds;
      if (!Array.isArray(northWest) || !Array.isArray(southEast)) return null;

      const [west, north] = northWest;
      const [east, south] = southEast;

      if (
        typeof west !== "number" ||
        typeof north !== "number" ||
        typeof east !== "number" ||
        typeof south !== "number"
      )
        return null;

      return {
        north,
        south,
        east: Math.max(west, east),
        west: Math.min(west, east),
      };
    },
    [],
  );

  const [viewportRectangle, setViewportRectangle] =
    useState<MapboxViewport | null>(null);

  // Inside your HomeScreen component in index.tsx

  // Inside your HomeScreen component in index.tsx

  // Inside your HomeScreen component in index.tsx

  const calculateViewportRectangle = useCallback(
    (viewport: MapboxViewport, isPitched: boolean): MapboxViewport => {
      const geoWidth = viewport.east - viewport.west;
      const geoHeight = viewport.north - viewport.south;

      let scaleFactor = 1.25;
      let verticalOffsetFactor = -0;

      if (isPitched) {
        // Reduce this value slightly to make the rectangle a bit smaller
        scaleFactor = 1.35; // PREVIOUSLY 0.6, try a value like 0.55

        verticalOffsetFactor = -0; // Keep this or adjust if positioning also needs a tweak
      }

      const newWidth = geoWidth * scaleFactor;
      const newHeight = geoHeight * scaleFactor;

      const centerX = (viewport.east + viewport.west) / 2;
      let centerY = (viewport.north + viewport.south) / 2;

      const verticalOffset = newHeight * verticalOffsetFactor;
      centerY += verticalOffset;

      return {
        north: centerY + newHeight / 2,
        south: centerY - newHeight / 2,
        east: centerX + newWidth / 2,
        west: centerX - newWidth / 2,
      };
    },
    [],
  );

  // Inside your HomeScreen component in index.tsx
  // Ensure isPitched is in scope, e.g., from:
  // const { mapStyle, isPitched } = useMapStyle();

  const handleMapViewportChange = useCallback(
    (feature: unknown) => {
      try {
        if (!feature || typeof feature !== "object") return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const properties = (feature as any).properties;
        if (!properties) return;

        const viewport = processViewportBounds(properties.visibleBounds);
        if (viewport) {
          // Pass the current isPitched state to the calculation function
          const rectangle = calculateViewportRectangle(viewport, isPitched); // MODIFIED LINE
          setViewportRectangle(rectangle);

          // Use the adjusted rectangle for updates
          updateViewport(rectangle);
        }
      } catch (error) {
        console.error("Error processing viewport change:", error);
      }
    },
    [
      updateViewport,
      processViewportBounds,
      calculateViewportRectangle,
      isPitched,
    ], // MODIFIED LINE: Added isPitched
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
        if (!feature || typeof feature !== "object") return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    [handleMapViewportChange, publish, setZoomLevel],
  );

  // Memoize default camera settings with null check
  const defaultCameraSettings = useMemo(
    () => createCameraSettings(userLocation),
    [userLocation],
  );

  // Memoize rendering conditions
  const shouldRenderMarkers = useMemo(
    () => Boolean(isMapReady && !isLoadingLocation && currentViewport),
    [isMapReady, isLoadingLocation, currentViewport],
  );

  // Memoize markers component for better performance
  const markersComponent = useMemo(() => {
    if (!shouldRenderMarkers || !currentViewport) return null;
    return (
      <ClusteredMapMarkers viewport={currentViewport} currentZoom={zoomLevel} />
    );
  }, [shouldRenderMarkers, markers, currentViewport, zoomLevel]);

  // Memoize user location layer
  const userLocationLayer = useMemo(() => {
    if (!locationPermissionGranted) return null;
    return (
      <MapboxGL.UserLocation visible={true} showsUserHeadingIndicator={true} />
    );
  }, [locationPermissionGranted]);

  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
  const [showRipple, setShowRipple] = useState(false);
  const [longPressCoordinates, setLongPressCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Add long press handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapLongPress = useCallback((event: any) => {
    "worklet";
    if (event?.properties) {
      const { screenPointX, screenPointY } = event.properties;
      const coordinates = event.geometry?.coordinates;

      if (
        typeof screenPointX === "number" &&
        typeof screenPointY === "number"
      ) {
        runOnJS(setRipplePosition)({ x: screenPointX, y: screenPointY });
        runOnJS(setShowRipple)(true);

        // Store coordinates for later use
        if (
          coordinates &&
          Array.isArray(coordinates) &&
          coordinates.length === 2
        ) {
          runOnJS(setLongPressCoordinates)({
            latitude: coordinates[1],
            longitude: coordinates[0],
          });
        }
      }
    }
  }, []);

  const handleRippleComplete = useCallback(() => {
    console.log("Ripple animation completed");
    setShowRipple(false);

    if (longPressCoordinates) {
      router.push({
        pathname: "/create-private-event",
        params: {
          latitude: longPressCoordinates.latitude.toString(),
          longitude: longPressCoordinates.longitude.toString(),
        },
      });
      setLongPressCoordinates(null);
    }
  }, [router, longPressCoordinates]);

  // Use the simulated notifications hook (disabled by default)
  useSimulatedNotifications({ enabled: false });

  const floatingDateButtonStyle = useMemo(
    () => ({
      position: "absolute" as const,
      top: insets.top, // StatusBar height (40) + padding (20)
      right: 8,
      zIndex: 1000,
      backgroundColor: COLORS.cardBackgroundAlt,
      borderRadius: 20,
      padding: 8,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    }),
    [insets.top],
  );

  return (
    <AuthWrapper>
      <View style={styles.container}>
        {isLoadingLocation && <LoadingOverlay />}

        {!isLoadingLocation && (
          <>
            <StatusBar />
            <View style={styles.statusBarSpacer} />
          </>
        )}

        <View style={styles.mapContainer}>
          <MapboxGL.MapView
            onTouchStart={handleUserPan}
            onPress={handleMapPress}
            onLongPress={handleMapLongPress}
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
              defaultSettings={{
                ...defaultCameraSettings,
                pitch: isPitched ? 52 : 0,
              }}
              animationDuration={0}
            />

            {/* Map Markers */}
            {markersComponent}

            {/* User location layer */}
            {userLocationLayer}

            {/* Viewport Rectangle */}
            <ViewportRectangle viewport={viewportRectangle} />
          </MapboxGL.MapView>

          {showRipple && (
            <MapRippleEffect
              isVisible={showRipple}
              position={ripplePosition}
              onAnimationComplete={handleRippleComplete}
            />
          )}

          <View style={floatingDateButtonStyle}>
            <DateRangeIndicator />
          </View>
        </View>
      </View>
    </AuthWrapper>
  );
}

export default React.memo(HomeScreen);
