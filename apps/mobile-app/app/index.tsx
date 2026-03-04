/* eslint-disable prefer-const */
import { styles as homeScreenStyles } from "@/components/homeScreenStyles";
import { LoadingOverlay } from "@/components/Loading/LoadingOverlay";
import { MapRippleEffect } from "@/components/MapRippleEffect/MapRippleEffect";
import { ClusteredMapMarkers } from "@/components/Markers/MarkerImplementation";
import { MarkerInfoHUD } from "@/components/Markers/MarkerInfoHUD";
import StatusBar from "@/components/StatusBar/StatusBar";
import { ViewportRectangle } from "@/components/ViewportRectangle/ViewportRectangle";
import { createCameraSettings, MIN_ZOOM_LEVEL } from "@/config/cameraConfig";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useCameraFollowMode } from "@/hooks/useCameraFollowMode";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import { useMapCamera } from "@/hooks/useMapCamera";
import { useMapLoadingState } from "@/hooks/useMapLoadingState";
import { useMapViewport } from "@/hooks/useMapViewport";
import { useMapWebSocket } from "@/hooks/useMapWebSocket";
import { useCategoryPreferences } from "@/hooks/useCategoryPreferences";
import MapFilterSheet from "@/components/MapFilterSheet";
import MapLegend from "@/components/MapLegend/MapLegend";
import { DialogBox } from "@/components/AreaScan/AreaScanComponents";
import { useScanInsight } from "@/components/ScanProgress/useScanInsight";
import {
  BaseEvent,
  CameraAnimateToLocationEvent,
  EventTypes,
  MapItemEvent,
} from "@/services/EventBroker";
import { useAppActive } from "@/hooks/useAppActive";
import { useLocationStore } from "@/stores/useLocationStore";
import { apiClient } from "@/services/ApiClient";
import { colors } from "@/theme";
import { BlurView } from "expo-blur";
import MapboxGL from "@rnmapbox/maps";
import { useNavigation, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import RAnimated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Locate, Navigation } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { scheduleOnRN } from "react-native-worklets";

// Set access token at module scope (lightweight, required before MapView renders)
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

// Use the imported styles directly
const styles = {
  ...homeScreenStyles,
  container: {
    flex: 1,
    backgroundColor: colors.fixed.black,
  },
  mapContainer: {
    flex: 1,
  },
  statusBarSpacer: {
    height: 105, // Match the height of the StatusBar component (includes XP bar)
  },
};

const resumeStyles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

const scanDialogStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});

function HomeScreenContent() {
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const router = useRouter();
  const { publish } = useEventBroker();
  const { mapStyle, isPitched } = useMapStyle();
  const insets = useSafeAreaInsets();
  const isAppActive = useAppActive();

  // Defer MapView mount by one frame so its native component descriptor
  // registration doesn't contend with reanimated entering layout animations
  // that fire in the first commit (same ComponentDescriptorRegistry mutex).
  // See: https://github.com/facebook/react-native/issues/53128
  const [isMapMounted, setIsMapMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setIsMapMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Defer heavy Mapbox native initialization to avoid blocking the main thread on cold start.
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
  const { selectMapItem, zoomLevel } = useLocationStore();
  const selectedItem = useLocationStore((state) => state.selectedItem);

  // User location hooks
  const {
    userLocation,
    locationPermissionGranted,
    isLoadingLocation,
    getUserLocation,
    startLocationTracking,
  } = useUserLocation();

  // Category filter preferences
  const {
    categories: filterCategories,
    includedCategoryIds,
    excludedCategoryIds,
    hasActiveFilters,
    handleCategoryFilterChange,
    clearAllFilters,
  } = useCategoryPreferences();

  // WebSocket and map data
  const { updateViewport, currentViewport } = useMapWebSocket(
    process.env.EXPO_PUBLIC_WEB_SOCKET_URL!,
  );

  // Map camera hook
  useMapCamera({ cameraRef });

  // Loading state management (splash screen, map ready, fallback timeout)
  const { isMapLoading, handleMapReady } = useMapLoadingState({
    isLoadingLocation,
  });

  // Initial location request and camera centering
  useInitialLocation({
    userLocation,
    isLoadingLocation,
    getUserLocation,
    cameraRef,
  });

  // Camera follow mode — auto-tracks user location, breaks on pan
  const { isFollowing, recenter } = useCameraFollowMode({
    cameraRef,
    userLocation,
  });

  // Start continuous location tracking for follow mode
  useEffect(() => {
    startLocationTracking();
  }, [startLocationTracking]);

  // Viewport processing and region change tracking
  const { viewportRectangle, handleRegionChanging, isCameraMoving } =
    useMapViewport({
      updateViewport,
      isPitched,
    });

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

  // Handle user pan — only publish the panning event.
  // Deselection is handled by handleMapPress (which doesn't fire for marker taps).
  const handleUserPan = useCallback(() => {
    publish<BaseEvent>(EventTypes.USER_PANNING_VIEWPORT, {
      timestamp: Date.now(),
      source: "MapPress",
    });
  }, [publish]);

  // Handle map press
  const handleMapPress = useCallback(() => {
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
  ]);

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
      <ClusteredMapMarkers
        viewport={currentViewport}
        currentZoom={zoomLevel}
        isCameraMoving={isCameraMoving}
      />
    );
  }, [shouldRenderMarkers, currentViewport, zoomLevel, isCameraMoving]);

  // Memoize user location layer
  const userLocationLayer = useMemo(() => {
    if (!locationPermissionGranted) return null;
    return (
      <MapboxGL.LocationPuck puckBearingEnabled={true} puckBearing="heading" />
    );
  }, [locationPermissionGranted]);

  const scanFlyToRef = useRef<[number, number] | undefined>(undefined);
  const handleScanDismiss = useCallback(() => {
    if (scanFlyToRef.current) {
      publish<CameraAnimateToLocationEvent>(
        EventTypes.CAMERA_ANIMATE_TO_LOCATION,
        {
          coordinates: scanFlyToRef.current,
          timestamp: Date.now(),
          source: "scan_dialog_box",
          zoomLevel: 16,
          allowZoomChange: true,
        },
      );
    }
  }, [publish]);
  const scanInsight = useScanInsight(handleScanDismiss);
  scanFlyToRef.current = scanInsight.flyToCoordinates;

  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
  const [showRipple, setShowRipple] = useState(false);
  const [areaScanCoords, setAreaScanCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const areaScanCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Sync state to ref so handleRippleComplete can read it synchronously
  useEffect(() => {
    areaScanCoordsRef.current = areaScanCoords;
  }, [areaScanCoords]);

  // Long press handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapLongPress = useCallback((event: any) => {
    "worklet";
    if (event?.properties) {
      const { screenPointX, screenPointY } = event.properties;

      if (
        typeof screenPointX === "number" &&
        typeof screenPointY === "number"
      ) {
        scheduleOnRN(setRipplePosition, { x: screenPointX, y: screenPointY });
        scheduleOnRN(setShowRipple, true);
      }
    }
    // Capture geo-coordinates for area scan
    if (event?.geometry?.coordinates) {
      const [lng, lat] = event.geometry.coordinates;
      if (typeof lat === "number" && typeof lng === "number") {
        scheduleOnRN(setAreaScanCoords, { lat, lng });
      }
    }
  }, []);

  const handleRippleComplete = useCallback(() => {
    setShowRipple(false);
    const coords = areaScanCoordsRef.current;
    if (coords) {
      areaScanCoordsRef.current = null;
      setAreaScanCoords(null);
      router.push({
        pathname: "/area-scan",
        params: {
          lat: String(coords.lat),
          lng: String(coords.lng),
          zoom: String(zoomLevel),
        },
      });
    }
  }, [router, zoomLevel]);

  // Screens render full-screen behind the ActionBar, so overlays must
  // clear the ActionBar (base height 60) plus the home-indicator safe area.
  const aboveActionBar = 0;
  const floatingDateButtonStyle = useMemo(
    () => ({
      position: "absolute" as const,
      bottom: aboveActionBar + 140,
      right: 16,
      zIndex: 1000,
      gap: 12,
    }),
    [aboveActionBar],
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
      minZoomLevel: MIN_ZOOM_LEVEL,
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

  // Fly to the nearest event via the backend initial-viewport endpoint
  const flyThrottleRef = useRef(false);
  const handleFlyToNearest = useCallback(async () => {
    if (!userLocation || flyThrottleRef.current) return;
    flyThrottleRef.current = true;
    setTimeout(() => {
      flyThrottleRef.current = false;
    }, 2000);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { center } = await apiClient.events.getInitialViewport(
        userLocation[1], // lat
        userLocation[0], // lng
      );
      cameraRef.current?.setCamera({
        centerCoordinate: center,
        zoomLevel: 15,
        animationDuration: 1500,
        animationMode: "flyTo",
      });
    } catch (err) {
      console.error("Failed to fly to nearest event:", err);
    }
  }, [userLocation, cameraRef]);

  // Memoize floating buttons section
  const floatingButtonsSection = useMemo(
    () => (
      <View style={floatingDateButtonStyle}>
        <RAnimated.View
          entering={FadeInDown.springify().delay(0)}
          style={{ opacity: isFollowing ? 0 : 1 }}
          pointerEvents={isFollowing ? "none" : "auto"}
        >
          <TouchableOpacity
            style={homeScreenStyles.recenterButton}
            onPress={recenter}
            activeOpacity={0.7}
          >
            <Navigation size={22} color={colors.action.save} />
          </TouchableOpacity>
        </RAnimated.View>
        <RAnimated.View entering={FadeInDown.springify().delay(50)}>
          <MapFilterSheet
            categories={filterCategories}
            includedCategoryIds={includedCategoryIds}
            excludedCategoryIds={excludedCategoryIds}
            onCategoryFilterChange={handleCategoryFilterChange}
            onClearAll={clearAllFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </RAnimated.View>
        <RAnimated.View entering={FadeInDown.springify().delay(100)}>
          <TouchableOpacity
            style={homeScreenStyles.recenterButton}
            onPress={handleFlyToNearest}
            activeOpacity={0.7}
          >
            <Locate size={22} color={colors.action.map} />
          </TouchableOpacity>
        </RAnimated.View>
      </View>
    ),
    [
      floatingDateButtonStyle,
      isFollowing,
      recenter,
      handleFlyToNearest,
      filterCategories,
      includedCategoryIds,
      excludedCategoryIds,
      hasActiveFilters,
      handleCategoryFilterChange,
      clearAllFilters,
    ],
  );

  // Memoize ripple effect component
  const rippleEffectComponent = useMemo(() => {
    if (!showRipple) return null;
    return (
      <MapRippleEffect
        isVisible={showRipple}
        position={ripplePosition}
        onAnimationComplete={handleRippleComplete}
        zoomLevel={zoomLevel}
      />
    );
  }, [showRipple, ripplePosition, handleRippleComplete, zoomLevel]);

  // Memoize viewport rectangle component
  const viewportRectangleComponent = useMemo(
    () =>
      __DEV__ ? <ViewportRectangle viewport={viewportRectangle} debug /> : null,
    [viewportRectangle],
  );

  return (
    <>
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
        {isMapMounted && isAppActive && (
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
        )}

        {/* Blur overlay while MapView is remounting after backgrounding */}
        {isMapMounted && !isAppActive && (
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={resumeStyles.center}>
              <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
          </BlurView>
        )}

        {rippleEffectComponent}

        <MarkerInfoHUD safeAreaBottom={aboveActionBar} />

        <MapLegend />

        {floatingButtonsSection}

        {scanInsight.visible && (
          <View style={scanDialogStyles.container}>
            <DialogBox
              key={scanInsight.jobKey}
              isLoading={scanInsight.isLoading}
              error={scanInsight.error}
              displayText={scanInsight.dialog.displayText}
              showContinue={scanInsight.dialog.showContinue}
              showDone={false}
              blinkAnim={scanInsight.dialog.blinkAnim}
              onTap={scanInsight.dialog.handleTap}
              onRestart={scanInsight.dialog.restart}
              onExpandComplete={scanInsight.feedPending}
              loadingText={scanInsight.loadingText}
              style={{ height: 100, marginBottom: 0 }}
            />
          </View>
        )}
      </View>
    </>
  );
}

function HomeScreen() {
  const [isReady, setIsReady] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    // Wait for the screen transition animation to complete before mounting
    // heavy content. Mounting Mapbox's MapView during a reanimated transition
    // causes a deadlock on the ComponentDescriptorRegistry mutex.
    // See: https://github.com/facebook/react-native/issues/53128
    let ready = false;
    const markReady = () => {
      if (!ready) {
        ready = true;
        setIsReady(true);
      }
    };

    const unsubscribe = navigation.addListener("transitionEnd", markReady);
    // Fallback for the initial screen if no transition animation fires
    const fallbackId = setTimeout(markReady, 300);

    return () => {
      unsubscribe();
      clearTimeout(fallbackId);
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      {isReady ? (
        <HomeScreenContent />
      ) : (
        <LoadingOverlay
          message="Loading map..."
          subMessage="Preparing your view"
        />
      )}
    </View>
  );
}

export default React.memo(HomeScreen);
