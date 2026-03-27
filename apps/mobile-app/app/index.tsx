/* eslint-disable prefer-const */
import { createStyles as createHomeScreenStyles } from "@/components/homeScreenStyles";
import { LoadingOverlay } from "@/components/Loading/LoadingOverlay";
import StatusBar from "@/components/StatusBar/StatusBar";
import { createCameraSettings } from "@/config/cameraConfig";
import { useRouter } from "expo-router";
import { useUserLocation } from "@/contexts/LocationContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useAppActive } from "@/hooks/useAppActive";
import { useCameraFollowMode } from "@/hooks/useCameraFollowMode";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import { useMapCamera } from "@/hooks/useMapCamera";
import { useMapLoadingState } from "@/hooks/useMapLoadingState";
import { useMapMountGate } from "@/hooks/useMapMountGate";
import { useMapViewport } from "@/hooks/useMapViewport";
import { useLocationStore } from "@/stores/useLocationStore";
import { useColors, type Colors } from "@/theme";
import MapboxGL from "@rnmapbox/maps";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Navigation } from "lucide-react-native";
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
import QuestDialogBox from "@/components/Quest/QuestDialogBox";
import ItineraryRouteLayer from "@/components/Itinerary/ItineraryRouteLayer";
import ItineraryWaypoints from "@/components/Itinerary/ItineraryWaypoints";
import AdventureHUD from "@/components/Itinerary/AdventureHUD";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useItineraryReveal } from "@/hooks/useItineraryReveal";
import { useItineraryPreviewOrbit } from "@/hooks/useItineraryPreviewOrbit";
// useSimulateItinerary removed (event system deleted)
import { useRecentItineraries } from "@/hooks/useRecentItineraries";
import { useFabAnimations } from "@/hooks/useFabAnimations";
import { useMapInteractions } from "@/hooks/useMapInteractions";

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
  const activeItinerary = useActiveItineraryStore((s) => s.itinerary);
  const { mapStyle, isPitched, currentStyle } = useMapStyle();
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

  // ── Camera ─────────────────────────────────────────────────────────
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

  // ── Recent itineraries ─────────────────────────────────────────────
  const { itineraries: recentItineraries } = useRecentItineraries();

  // DEV simulation removed (event system deleted)

  // ── Viewport ────────────────────────────────────────────────────────
  const { handleRegionChanging, handleRegionDidChange } = useMapViewport({
    isPitched,
    paused: isOrbiting,
    pausedRef: isOrbitingRef,
  });

  // ── Map interactions ────────────────────────────────────────────────
  const { handleMapPress: baseMapPress } = useMapInteractions({
    selectedItineraryIndex: null,
    handleCarouselDismiss: () => {},
  });

  const handleMapPress = useCallback(() => {
    baseMapPress();
  }, [baseMapPress]);

  // ── FAB animations ──────────────────────────────────────────────────
  const { fabStyle0 } = useFabAnimations(false);

  // ── Memoized values ─────────────────────────────────────────────────
  const defaultCameraSettings = useMemo(
    () => createCameraSettings(userLocation),
    [userLocation],
  );

  const userLocationLayer = useMemo(() => {
    if (!locationPermissionGranted) return null;
    return (
      <MapboxGL.LocationPuck puckBearingEnabled={true} puckBearing="heading" />
    );
  }, [locationPermissionGranted]);



  const cameraSettings = useMemo(
    () => ({
      ...defaultCameraSettings,
      pitch: isPitched ? 58 : 0,
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
      </View>
    ),
    [isFollowing, recenter, fabStyle0],
  );

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
            onPress={handleMapPress}
            ref={mapRef}
            styleURL={mapStyle}
            onDidFinishLoadingMap={handleMapReady}
            onRegionIsChanging={handleRegionChanging}
            onRegionDidChange={handleRegionDidChange}
            {...mapViewProps}
          >
            <MapboxGL.Camera
              ref={cameraRef}
              defaultSettings={cameraSettings}
              {...staticCameraProps}
            />
            {/* Terrain: 3D elevation from Mapbox DEM tiles */}
            <MapboxGL.RasterDemSource
              id="mapbox-dem"
              url="mapbox://mapbox.mapbox-terrain-dem-v1"
              tileSize={514}
              maxZoomLevel={14}
            >
              <MapboxGL.Terrain style={{ exaggeration: 1.5 }} />
            </MapboxGL.RasterDemSource>
            {/* Atmosphere: distance fog for diorama depth */}
            <MapboxGL.Atmosphere
              style={{
                color: currentStyle === "dark" ? "#2a2a4a" : "#c9d6df",
                highColor: currentStyle === "dark" ? "#141428" : "#87CEEB",
                horizonBlend: 0.12,
                starIntensity: currentStyle === "dark" ? 0.2 : 0,
                range: [0.2, 2],
                spaceColor: currentStyle === "dark" ? "#0a0a1e" : "#dce6f0",
              }}
            />
            {/* Sky: atmospheric scattering dome */}
            <MapboxGL.SkyLayer
              id="sky-diorama"
              style={{
                skyType: "atmosphere",
                skyAtmosphereSun: [280, 70],
                skyAtmosphereSunIntensity: currentStyle === "dark" ? 2 : 8,
                skyAtmosphereColor: currentStyle === "dark" ? "#1a1a2e" : "#87CEEB",
                skyAtmosphereHaloColor: currentStyle === "dark" ? "#2a1a3e" : "#f0e68c",
              }}
            />
            <AnchorMarkers />
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

        {floatingButtonsSection}

        {!selectedItem && !activeItinerary && (
          <QuestDialogBox style={planBannerStyles.dialogBox} />
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
