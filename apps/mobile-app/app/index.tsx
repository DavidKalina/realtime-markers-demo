/* eslint-disable prefer-const */
import { AuthWrapper } from "@/components/AuthWrapper";
import { styles as homeScreenStyles } from "@/components/homeScreenStyles";
import { LoadingOverlay } from "@/components/Loading/LoadingOverlay";
import { MapRippleEffect } from "@/components/MapRippleEffect/MapRippleEffect";
import { ClusteredMapMarkers } from "@/components/Markers/MarkerImplementation";
import StatusBar from "@/components/StatusBar/StatusBar";
import DateRangeIndicator from "@/components/StatusBar/DateRangeIndicator";
import PlusButton from "@/components/StatusBar/PlusButton";
import { ViewportRectangle } from "@/components/ViewportRectangle/ViewportRectangle";
import {
  DEFAULT_CAMERA_SETTINGS,
  createCameraSettings,
} from "@/config/cameraConfig";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useSplashScreen } from "@/contexts/SplashScreenContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useMapCamera } from "@/hooks/useMapCamera";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { BaseEvent, EventTypes, MapItemEvent } from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import { MapboxViewport } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapboxGL from "@rnmapbox/maps";
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

// Set access token at module scope (lightweight, required before MapView renders)
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

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
};

function HomeScreen() {
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const { publish } = useEventBroker();
  const { mapStyle, isPitched } = useMapStyle();
  const { registerLoadingState, unregisterLoadingState } = useSplashScreen();
  const insets = useSafeAreaInsets();

  // Defer heavy Mapbox native initialization to avoid blocking the main thread on cold start.
  // setAccessToken is set at module scope (lightweight); these heavier calls run after mount.
  useEffect(() => {
    if (Platform.OS === "android") {
      MapboxGL.setTelemetryEnabled(false);
    }
    MapboxGL.locationManager.start();

    return () => {
      MapboxGL.locationManager.stop();
    };
  }, []);

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
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true); // Add explicit map loading state

  // Register map loading state with splash screen context
  useEffect(() => {
    // Register map loading state immediately when component mounts
    registerLoadingState("map", isMapLoading);

    // Cleanup on unmount
    return () => {
      unregisterLoadingState("map");
    };
  }, [isMapLoading, registerLoadingState, unregisterLoadingState]);

  // Register location loading state with splash screen context
  useEffect(() => {
    if (isLoadingLocation) {
      registerLoadingState("location", true);
    } else {
      unregisterLoadingState("location");
    }

    // Cleanup on unmount
    return () => {
      unregisterLoadingState("location");
    };
  }, [isLoadingLocation, registerLoadingState, unregisterLoadingState]);

  // Update map loading state when map becomes ready
  useEffect(() => {
    if (isMapReady && isMapLoading) {
      const timer = setTimeout(() => {
        setIsMapLoading(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isMapReady, isMapLoading]);

  // Fallback: dismiss loading overlay after 5s even if onDidFinishLoadingMap
  // doesn't fire (known issue with @rnmapbox/maps on New Architecture/Fabric)
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!isMapReady) {
        console.warn("Map ready timeout — forcing dismiss of loading overlay");
        setIsMapReady(true);
      }
    }, 5000);
    return () => clearTimeout(fallback);
  }, []);

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
      currentViewport &&
      cameraRef.current &&
      !hasCenteredOnUserRef.current
    ) {
      hasCenteredOnUserRef.current = true;
      cameraRef.current.setCamera({
        ...DEFAULT_CAMERA_SETTINGS,
        centerCoordinate: userLocation,
      });
    }
  }, [userLocation, isLoadingLocation, currentViewport]);


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
          const rectangle = calculateViewportRectangle(viewport, isPitched);
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
    ],
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
    () => Boolean(currentViewport && !isLoadingLocation),
    [isLoadingLocation, currentViewport],
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
      <MapboxGL.LocationPuck puckBearingEnabled={true} puckBearing="heading" />
    );
  }, [locationPermissionGranted]);

  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
  const [showRipple, setShowRipple] = useState(false);

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
      }
    }
  }, []);

  const handleRippleComplete = useCallback(() => {
    setShowRipple(false);
  }, []);

  const floatingDateButtonStyle = useMemo(
    () => ({
      position: "absolute" as const,
      bottom: insets.bottom + 80, // Move higher up for better thumb placement
      right: 16,
      zIndex: 1000,
      gap: 12, // Add gap between buttons
    }),
    [insets.bottom],
  );

  // Memoize camera settings object
  const cameraSettings = useMemo(
    () => ({
      ...defaultCameraSettings,
      pitch: isPitched ? 52 : 0,
    }),
    [defaultCameraSettings, isPitched],
  );

  // Memoize static MapView props
  const mapViewProps = useMemo(
    () => ({
      scaleBarEnabled: false,
      rotateEnabled: false,
      pitchEnabled: false,
      style: styles.map,
      logoEnabled: false,
      attributionEnabled: false,
    }),
    [],
  );

  // Memoize static Camera props
  const cameraProps = useMemo(
    () => ({
      minZoomLevel: 5,
      animationDuration: 0,
    }),
    [],
  );

  // Memoize status bar section
  const statusBarSection = useMemo(() => {
    if (isLoadingLocation) return null;
    return (
      <>
        <StatusBar />
        <View style={styles.statusBarSpacer} />
      </>
    );
  }, [isLoadingLocation]);

  // Memoize floating buttons section
  const floatingButtonsSection = useMemo(
    () => (
      <View style={floatingDateButtonStyle}>
        <DateRangeIndicator />
        <PlusButton />
      </View>
    ),
    [floatingDateButtonStyle],
  );

  // Memoize ripple effect component
  const rippleEffectComponent = useMemo(() => {
    if (!showRipple) return null;
    return (
      <MapRippleEffect
        isVisible={showRipple}
        position={ripplePosition}
        onAnimationComplete={handleRippleComplete}
      />
    );
  }, [showRipple, ripplePosition, handleRippleComplete]);

  // Memoize viewport rectangle component
  const viewportRectangleComponent = useMemo(
    () => <ViewportRectangle viewport={viewportRectangle} />,
    [viewportRectangle],
  );

  return (
    <AuthWrapper>
      <View style={styles.container}>
        {/* Show loading overlay for both location loading and map loading */}
        {(isLoadingLocation || isMapLoading) && (
          <LoadingOverlay
            message={
              isMapLoading
                ? "Loading map..."
                : isLoadingLocation
                  ? "Finding your location..."
                  : "Loading..."
            }
            subMessage={
              isMapLoading
                ? "Preparing your view"
                : isLoadingLocation
                  ? "We'll show you events nearby"
                  : "Please wait"
            }
          />
        )}

        {statusBarSection}

        <View style={styles.mapContainer}>
          <MapboxGL.MapView
            onTouchStart={handleUserPan}
            onPress={handleMapPress}
            onLongPress={handleMapLongPress}
            ref={mapRef}
            styleURL={mapStyle}
            onDidFinishLoadingMap={handleMapReady}
            onRegionIsChanging={handleRegionChanging}
            {...mapViewProps}
          >
            <MapboxGL.Camera
              ref={cameraRef}
              defaultSettings={cameraSettings}
              {...cameraProps}
            />
            {markersComponent}
            {userLocationLayer}
            {viewportRectangleComponent}
          </MapboxGL.MapView>

          {rippleEffectComponent}

          {floatingButtonsSection}
        </View>
      </View>
    </AuthWrapper>
  );
}

export default React.memo(HomeScreen);
