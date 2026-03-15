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
import { useRouter } from "expo-router";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useAppActive } from "@/hooks/useAppActive";
import { useCameraFollowMode } from "@/hooks/useCameraFollowMode";
import { useCategoryPreferences } from "@/hooks/useCategoryPreferences";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import { useMapCamera } from "@/hooks/useMapCamera";
import { useMapLoadingState } from "@/hooks/useMapLoadingState";
import { useMapMountGate } from "@/hooks/useMapMountGate";
import { useMapViewport } from "@/hooks/useMapViewport";
import { useMapWebSocket } from "@/hooks/useMapWebSocket";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { useJobSheetStore } from "@/stores/useJobSheetStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { useColors, type Colors } from "@/theme";
import MapboxGL from "@rnmapbox/maps";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { ClipboardList, Navigation, Radar } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import RAnimated from "react-native-reanimated";
import AnchorMarkers from "@/components/Markers/AnchorMarkers";
import ItineraryDialogBox from "@/components/Itinerary/ItineraryDialogBox";
import ItineraryRouteLayer from "@/components/Itinerary/ItineraryRouteLayer";
import ItineraryWaypoints from "@/components/Itinerary/ItineraryWaypoints";
import AdventureHUD from "@/components/Itinerary/AdventureHUD";
import ItineraryCarousel from "@/components/Itinerary/ItineraryCarousel";
import ItineraryMapMarkers from "@/components/Itinerary/ItineraryMapMarkers";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useItineraryReveal } from "@/hooks/useItineraryReveal";
import { useItineraryPreviewOrbit } from "@/hooks/useItineraryPreviewOrbit";
import { useSimulateItinerary } from "@/hooks/useSimulateItinerary";
import { useRecentItineraries } from "@/hooks/useRecentItineraries";
import { useFabAnimations } from "@/hooks/useFabAnimations";
import { useScanAreaRipple } from "@/hooks/useScanAreaRipple";
import { useAnchorPlanning } from "@/hooks/useAnchorPlanning";
import { useItineraryBrowsing } from "@/hooks/useItineraryBrowsing";
import { useMapInteractions } from "@/hooks/useMapInteractions";
import { useEventBroker } from "@/hooks/useEventBroker";

// Set access token at module scope (lightweight, required before MapView renders)
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

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
    height: 105,
  },
});

const resumeStyles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

const floatingDateButtonStyle = {
  position: "absolute" as const,
  bottom: 140,
  right: 16,
  zIndex: 1000,
  gap: 12,
};

const staticCameraProps = { animationDuration: 0 };

const planBannerStyles = StyleSheet.create({
  dialogBox: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  carousel: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    zIndex: 1001,
  },
});

function HomeScreenContent() {
  const colors = useColors();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const router = useRouter();
  const { publish } = useEventBroker();
  const activeItinerary = useActiveItineraryStore((s) => s.itinerary);
  const { mapStyle, isPitched } = useMapStyle();
  const { activeCount } = useJobProgressContext();
  const openJobSheet = useJobSheetStore((s) => s.open);
  const hasInFlight = activeCount > 0;
  const isAppActive = useAppActive();

  // ── Mount gate ──────────────────────────────────────────────────────
  const { isMapSafeToMount, onContainerLayout } = useMapMountGate("home");

  useEffect(() => {
    if (Platform.OS === "android") {
      MapboxGL.setTelemetryEnabled(false);
    }
    MapboxGL.locationManager.start();
    return () => {
      MapboxGL.locationManager.stop();
    };
  }, []);

  // ── Location ────────────────────────────────────────────────────────
  const zoomLevel = useLocationStore((s) => s.zoomLevel);
  const selectedItem = useLocationStore((state) => state.selectedItem);

  const {
    userLocation,
    locationPermissionGranted,
    isLoadingLocation,
    getUserLocation,
    startLocationTracking,
  } = useUserLocation();

  useEffect(() => {
    startLocationTracking();
  }, [startLocationTracking]);

  // ── Category filters ────────────────────────────────────────────────
  const {
    categories: filterCategories,
    includedCategoryIds,
    excludedCategoryIds,
    hasActiveFilters,
    handleCategoryFilterChange,
    clearAllFilters,
  } = useCategoryPreferences();

  // ── WebSocket & camera ──────────────────────────────────────────────
  const { updateViewport, currentViewport } = useMapWebSocket(
    process.env.EXPO_PUBLIC_WEB_SOCKET_URL!,
  );

  useMapCamera({ cameraRef });

  const { isMapLoading, handleMapReady } = useMapLoadingState({
    isLoadingLocation,
  });

  useInitialLocation({
    userLocation,
    isLoadingLocation,
    getUserLocation,
    cameraRef,
  });

  const { isFollowing, recenter } = useCameraFollowMode({
    cameraRef,
    userLocation,
  });

  // ── Itinerary layers ────────────────────────────────────────────────
  const { revealedStopCount, layersSafe: itineraryLayersSafe } =
    useItineraryReveal({ cameraRef });

  const { handlePreviewStop, isOrbiting, isOrbitingRef } =
    useItineraryPreviewOrbit({ cameraRef, isPitched });

  // ── Recent itineraries + browsing ───────────────────────────────────
  const { itineraries: recentItineraries } = useRecentItineraries();

  const {
    selectedItineraryIndex,
    handleItineraryMarkerSelect,
    handleCarouselIndexChange,
    handleCarouselDismiss,
  } = useItineraryBrowsing({
    itineraries: recentItineraries,
    handlePreviewStop,
  });

  // ── DEV: simulate itinerary check-ins ───────────────────────────────
  const { startSimulation, stopSimulation } = useSimulateItinerary(
    userLocation ?? null,
  );
  const handleSimTrigger = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (activeItinerary) {
      stopSimulation();
    } else {
      startSimulation();
    }
  }, [activeItinerary, startSimulation, stopSimulation]);

  // ── Viewport ────────────────────────────────────────────────────────
  const { handleRegionChanging } = useMapViewport({
    updateViewport,
    isPitched,
    paused: isOrbiting,
    pausedRef: isOrbitingRef,
  });

  // ── Map interactions ────────────────────────────────────────────────
  const { handleMapPress, handleUserPan } = useMapInteractions({
    selectedItineraryIndex,
    handleCarouselDismiss,
  });

  // ── Anchor planning ─────────────────────────────────────────────────
  const {
    anchorAnchors,
    anchorCity,
    nearbyPlacesInput,
    handleMapLongPress,
    handleNearbySelect,
    handleNearbyKeepPin,
    handleNearbyDismiss,
    handleAnchorEdit,
    handleAnchorRemove,
    handleItineraryResult,
    handleAnchorDismiss,
    handleSearchFlyTo,
    handleSearchPlaceAnchor,
  } = useAnchorPlanning({
    cameraRef,
    zoomLevel,
    activeItinerary,
    publish,
  });

  // ── Scan area + ripple ──────────────────────────────────────────────
  const {
    scanAreaRef,
    showRipple,
    ripplePosition,
    handleScanArea,
    handleRippleComplete,
  } = useScanAreaRipple({ mapRef, userLocation, zoomLevel, router });

  // ── FAB animations ──────────────────────────────────────────────────
  const { fabStyle0, fabStyle1, fabStyle2, fabStyle3, jobPulseStyle } =
    useFabAnimations(hasInFlight);

  // ── Memoized values ─────────────────────────────────────────────────
  const defaultCameraSettings = useMemo(
    () => createCameraSettings(userLocation),
    [userLocation],
  );

  const shouldRenderMarkers = useMemo(
    () => Boolean(currentViewport && !isLoadingLocation),
    [isLoadingLocation, currentViewport],
  );

  const hasActiveQuest = !!activeItinerary;
  const markersComponent = useMemo(() => {
    if (!shouldRenderMarkers || !currentViewport) return null;
    return (
      <ClusteredMapMarkers
        viewport={currentViewport}
        currentZoom={zoomLevel}
        dimmed={hasActiveQuest}
      />
    );
  }, [shouldRenderMarkers, currentViewport, zoomLevel, hasActiveQuest]);

  const userLocationLayer = useMemo(() => {
    if (!locationPermissionGranted) return null;
    return (
      <MapboxGL.LocationPuck puckBearingEnabled={true} puckBearing="heading" />
    );
  }, [locationPermissionGranted]);

  const aboveActionBar = 0;

  const cameraSettings = useMemo(
    () => ({
      ...defaultCameraSettings,
      pitch: isPitched ? 52 : 0,
    }),
    [defaultCameraSettings, isPitched],
  );

  const mapViewProps = useMemo(
    () => ({
      scaleBarEnabled: false,
      rotateEnabled: true,
      pitchEnabled: true,
      style: styles.map,
      logoEnabled: false,
      attributionEnabled: false,
    }),
    [styles.map],
  );


  const statusBarSection = useMemo(() => {
    if (isLoadingLocation) return null;
    return (
      <>
        <StatusBar />
        <View style={styles.statusBarSpacer} />
      </>
    );
  }, [isLoadingLocation]);

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
            ref={scanAreaRef}
            style={styles.recenterButton}
            onPress={handleScanArea}
            activeOpacity={0.7}
          >
            <Radar size={22} color={colors.action.map} />
          </TouchableOpacity>
        </RAnimated.View>
        <RAnimated.View
          style={[fabStyle3, hasInFlight ? jobPulseStyle : undefined]}
        >
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={openJobSheet}
            onLongPress={handleSimTrigger}
            activeOpacity={0.7}
          >
            <ClipboardList size={22} color={colors.accent.primary} />
          </TouchableOpacity>
        </RAnimated.View>
      </View>
    ),
    [
      isFollowing,
      recenter,
      handleScanArea,
      filterCategories,
      includedCategoryIds,
      excludedCategoryIds,
      hasActiveFilters,
      handleCategoryFilterChange,
      clearAllFilters,
      hasInFlight,
      openJobSheet,
      handleSimTrigger,
      fabStyle0,
      fabStyle1,
      fabStyle2,
      fabStyle3,
      jobPulseStyle,
    ],
  );

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

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <>
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
              {...staticCameraProps}
            />
            {markersComponent}
            <AnchorMarkers />
            {!activeItinerary && (
              <ItineraryMapMarkers
                itineraries={recentItineraries}
                selectedIndex={selectedItineraryIndex}
                onSelect={handleItineraryMarkerSelect}
              />
            )}
            {itineraryLayersSafe && (
              <ItineraryRouteLayer revealedStopCount={revealedStopCount} />
            )}
            {itineraryLayersSafe && (
              <ItineraryWaypoints revealedStopCount={revealedStopCount} />
            )}
            {userLocationLayer}
          </MapboxGL.MapView>
        )}

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

        {!selectedItem && !activeItinerary && (
          <>
            <ItineraryDialogBox
              city={anchorCity ?? undefined}
              anchorStops={anchorAnchors.length > 0 ? anchorAnchors : undefined}
              onDismiss={handleAnchorDismiss}
              onItineraryResult={handleItineraryResult}
              nearbyPlaces={nearbyPlacesInput}
              onNearbySelect={handleNearbySelect}
              onNearbyKeepPin={handleNearbyKeepPin}
              onNearbyDismiss={handleNearbyDismiss}
              onFlyTo={handleSearchFlyTo}
              onSearchPlaceAnchor={handleSearchPlaceAnchor}
              onAnchorEdit={handleAnchorEdit}
              onAnchorRemove={handleAnchorRemove}
              style={planBannerStyles.dialogBox}
            />
            {selectedItineraryIndex != null && anchorAnchors.length === 0 && (
              <ItineraryCarousel
                style={planBannerStyles.carousel}
                itineraries={recentItineraries}
                activeIndex={selectedItineraryIndex}
                onIndexChange={handleCarouselIndexChange}
                onPreviewStop={handlePreviewStop}
                onBack={handleCarouselDismiss}
                isOrbiting={isOrbiting}
              />
            )}
          </>
        )}
        {activeItinerary && (
          <AdventureHUD style={planBannerStyles.dialogBox} />
        )}
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
