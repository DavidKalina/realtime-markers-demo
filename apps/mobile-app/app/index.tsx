/* eslint-disable prefer-const */
import { createStyles as createHomeScreenStyles } from "@/components/homeScreenStyles";
import { LoadingOverlay } from "@/components/Loading/LoadingOverlay";
import MapFilterSheet from "@/components/MapFilterSheet";
import MapLegend from "@/components/MapLegend/MapLegend";
import { MapRippleEffect } from "@/components/MapRippleEffect/MapRippleEffect";
import { ClusteredMapMarkers } from "@/components/Markers/MarkerImplementation";
import { MarkerInfoHUD } from "@/components/Markers/MarkerInfoHUD";
import StatusBar from "@/components/StatusBar/StatusBar";
import { createCameraSettings } from "@/config/cameraConfig";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useAppActive } from "@/hooks/useAppActive";
import { useCameraFollowMode } from "@/hooks/useCameraFollowMode";
import { useCategoryPreferences } from "@/hooks/useCategoryPreferences";
import { useEventBroker } from "@/hooks/useEventBroker";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import { useMapCamera } from "@/hooks/useMapCamera";
import { useMapLoadingState } from "@/hooks/useMapLoadingState";
import { useMapMountGate } from "@/hooks/useMapMountGate";
import { useMapViewport } from "@/hooks/useMapViewport";
import { useMapWebSocket } from "@/hooks/useMapWebSocket";
import { apiClient } from "@/services/ApiClient";
import {
  BaseEvent,
  CameraAnimateToLocationEvent,
  EventTypes,
  MapItemEvent,
} from "@/services/EventBroker";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { useJobSheetStore } from "@/stores/useJobSheetStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { useColors, type Colors } from "@/theme";
import MapboxGL from "@rnmapbox/maps";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ClipboardList, Locate, Navigation } from "lucide-react-native";
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
import RAnimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

// Set access token at module scope (lightweight, required before MapView renders)
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

// Use the imported styles directly
const createHomeStyles = (colors: Colors) => ({
  ...createHomeScreenStyles(colors),
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
});

const resumeStyles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});


function HomeScreenContent() {
  const colors = useColors();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const router = useRouter();
  const { publish } = useEventBroker();
  const { mapStyle, isPitched } = useMapStyle();
  const { activeCount } = useJobProgressContext();
  const openJobSheet = useJobSheetStore((s) => s.open);
  const hasInFlight = activeCount > 0;
  const isAppActive = useAppActive();

  // Global mount gate — waits for the container's onLayout + a few RAF frames
  // so reanimated entering animations finish before MapView registers its
  // native component descriptor (avoids ComponentDescriptorRegistry deadlock).
  // See: https://github.com/facebook/react-native/issues/53128
  const { isMapSafeToMount, onContainerLayout } = useMapMountGate("home");

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
  const { handleRegionChanging } = useMapViewport({
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
      />
    );
  }, [shouldRenderMarkers, currentViewport, zoomLevel]);

  // Memoize user location layer
  const userLocationLayer = useMemo(() => {
    if (!locationPermissionGranted) return null;
    return (
      <MapboxGL.LocationPuck puckBearingEnabled={true} puckBearing="heading" />
    );
  }, [locationPermissionGranted]);


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

  // Slide-up animations for floating buttons (shared values, not layout animations,
  // to avoid ComponentDescriptorRegistry deadlock with MapView initialization).
  const fabSlide0 = useSharedValue(20);
  const fabOpacity0 = useSharedValue(0);
  const fabSlide1 = useSharedValue(20);
  const fabOpacity1 = useSharedValue(0);
  const fabSlide2 = useSharedValue(20);
  const fabOpacity2 = useSharedValue(0);
  const fabSlide3 = useSharedValue(20);
  const fabOpacity3 = useSharedValue(0);
  useEffect(() => {
    const springCfg = { damping: 14, stiffness: 160 };
    fabSlide0.value = withSpring(0, springCfg);
    fabOpacity0.value = withSpring(1, springCfg);
    fabSlide1.value = withDelay(50, withSpring(0, springCfg));
    fabOpacity1.value = withDelay(50, withSpring(1, springCfg));
    fabSlide2.value = withDelay(100, withSpring(0, springCfg));
    fabOpacity2.value = withDelay(100, withSpring(1, springCfg));
    fabSlide3.value = withDelay(150, withSpring(0, springCfg));
    fabOpacity3.value = withDelay(150, withSpring(1, springCfg));
  }, []);
  const fabStyle0 = useAnimatedStyle(() => ({
    opacity: fabOpacity0.value,
    transform: [{ translateY: fabSlide0.value }],
  }));
  const fabStyle1 = useAnimatedStyle(() => ({
    opacity: fabOpacity1.value,
    transform: [{ translateY: fabSlide1.value }],
  }));
  const fabStyle2 = useAnimatedStyle(() => ({
    opacity: fabOpacity2.value,
    transform: [{ translateY: fabSlide2.value }],
  }));
  const fabStyle3 = useAnimatedStyle(() => ({
    opacity: fabOpacity3.value,
    transform: [{ translateY: fabSlide3.value }],
  }));

  // Subtle pulse on jobs FAB when work is in-flight
  const jobPulse = useSharedValue(1);
  useEffect(() => {
    if (hasInFlight) {
      jobPulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    } else {
      jobPulse.value = withTiming(1, { duration: 300 });
    }
  }, [hasInFlight, jobPulse]);
  const jobPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: jobPulse.value }],
  }));

  // Memoize floating buttons section
  const floatingButtonsSection = useMemo(
    () => (
      <View style={floatingDateButtonStyle}>
        <RAnimated.View
          style={[fabStyle0, { opacity: isFollowing ? 0 : 1 }]}
          pointerEvents={isFollowing ? "none" : "auto"}
        >
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={recenter}
            activeOpacity={0.7}
          >
            <Navigation size={22} color={colors.action.save} />
          </TouchableOpacity>
        </RAnimated.View>
        <RAnimated.View style={fabStyle1}>
          <MapFilterSheet
            categories={filterCategories}
            includedCategoryIds={includedCategoryIds}
            excludedCategoryIds={excludedCategoryIds}
            onCategoryFilterChange={handleCategoryFilterChange}
            onClearAll={clearAllFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </RAnimated.View>
        <RAnimated.View style={fabStyle2}>
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={handleFlyToNearest}
            activeOpacity={0.7}
          >
            <Locate size={22} color={colors.action.map} />
          </TouchableOpacity>
        </RAnimated.View>
        <RAnimated.View style={[fabStyle3, hasInFlight ? jobPulseStyle : undefined]}>
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={openJobSheet}
            activeOpacity={0.7}
          >
            <ClipboardList size={22} color={colors.accent.primary} />
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
      hasInFlight,
      openJobSheet,
      fabStyle0,
      fabStyle1,
      fabStyle2,
      fabStyle3,
      jobPulseStyle,
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

      <View style={styles.mapContainer} onLayout={onContainerLayout}>
        {isMapSafeToMount && isAppActive && (
          <MapboxGL.MapView
            onTouchMove={handleUserPan}
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
          </MapboxGL.MapView>
        )}

        {/* Blur overlay while MapView is remounting after backgrounding */}
        {isMapSafeToMount && !isAppActive && (
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

      </View>
    </>
  );
}

function HomeScreen() {
  const colors = useColors();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <HomeScreenContent />
    </View>
  );
}

export default React.memo(HomeScreen);
