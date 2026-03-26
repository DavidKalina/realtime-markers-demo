/* eslint-disable prefer-const */
import { createStyles as createHomeScreenStyles } from "@/components/homeScreenStyles";
import { LoadingOverlay } from "@/components/Loading/LoadingOverlay";
import { MapRippleEffect } from "@/components/MapRippleEffect/MapRippleEffect";
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
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { useJobSheetStore } from "@/stores/useJobSheetStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { useColors, type Colors } from "@/theme";
import MapboxGL from "@rnmapbox/maps";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { ClipboardList, Navigation, Radar } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSimulateItinerary } from "@/hooks/useSimulateItinerary";
import { useRecentItineraries } from "@/hooks/useRecentItineraries";
import { useFabAnimations } from "@/hooks/useFabAnimations";
import { useScanAreaRipple } from "@/hooks/useScanAreaRipple";
import { useMapInteractions } from "@/hooks/useMapInteractions";
import { useDistrictMapData } from "@/hooks/useDistrictMapData";
import { useMapWebSocket } from "@/hooks/useMapWebSocket";
import { webSocketService } from "@/services/WebSocketService";
import { useDistrictFocus } from "@/hooks/useDistrictFocus";
import { DistrictZonesLayer } from "@/components/Districts/DistrictZonesLayer";
import { CommunityItineraryMarkers, type DistrictLookup } from "@/components/Districts/CommunityItineraryMarkers";
import { CommunityItineraryPreviewCard } from "@/components/Districts/CommunityItineraryPreviewCard";
import {
  EmojiMapImageGenerator,
  markerImageKey,
  type MarkerImageSpec,
} from "@/components/Districts/EmojiMapImageGenerator";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { getDistrictColor } from "@/utils/districtUtils";
import { Delaunay } from "d3-delaunay";
import type { BrowseItineraryPreview } from "@/services/api/modules/districts";

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
  const { handleRegionChanging, handleRegionDidChange, viewportRectangle } = useMapViewport({
    isPitched,
    paused: isOrbiting,
    pausedRef: isOrbitingRef,
  });

  // ── WebSocket — handles incoming streamed events + itineraries ─────
  const wsUrl = process.env.EXPO_PUBLIC_WEB_SOCKET_URL ?? "";
  useMapWebSocket(wsUrl);

  // Send viewport updates to WebSocket server directly (no state loop)
  useEffect(() => {
    if (viewportRectangle) {
      webSocketService.sendViewportUpdate(viewportRectangle, zoomLevel);
    }
  }, [viewportRectangle, zoomLevel]);

  // ── Map interactions ────────────────────────────────────────────────
  const { handleMapPress: baseMapPress } = useMapInteractions({
    selectedItineraryIndex: null,
    handleCarouselDismiss: () => {},
  });

  // ── District map data + focus ──────────────────────────────────────
  useDistrictMapData();
  useDistrictFocus();

  // ── Community itinerary selection ─────────────────────────────────
  const [selectedCommunityItinerary, setSelectedCommunityItinerary] =
    useState<{ itinerary: BrowseItineraryPreview; districtId: string } | null>(
      null,
    );
  const districts = useDistrictMapStore((s) => s.districts);
  const streamedItineraries = useDistrictMapStore(
    (s) => s.streamedItineraries,
  );

  // Shared Delaunay lookup — computed once, used by both markerImageSpecs
  // and CommunityItineraryMarkers for point → district mapping
  const districtLookup = useMemo((): DistrictLookup | null => {
    if (districts.length === 0) return null;
    const sorted = [...districts].sort((a, b) => a.id.localeCompare(b.id));
    const points: [number, number][] = sorted.map((d) => [
      d.centroidLng,
      d.centroidLat,
    ]);
    const delaunay = Delaunay.from(points);
    return { delaunay, sorted };
  }, [districts]);

  // Pre-rasterise emoji-in-circle images for GPU-rendered community markers
  const [emojiImages, setEmojiImages] = useState<
    Record<string, { uri: string }>
  >({});
  const markerImageSpecs = useMemo((): MarkerImageSpec[] => {
    if (!districtLookup || streamedItineraries.length === 0) return [];
    const seen = new Set<string>();
    const specs: MarkerImageSpec[] = [];
    for (const itin of streamedItineraries) {
      if (!itin.entryLatitude || !itin.entryLongitude) continue;
      const emoji = itin.items?.[0]?.emoji ?? "\u{1F4CD}";
      const idx = districtLookup.delaunay.find(itin.entryLongitude, itin.entryLatitude);
      const district = districtLookup.sorted[idx];
      const borderColor = district ? getDistrictColor(district) : "#86efac";
      const key = markerImageKey(emoji, borderColor);
      if (!seen.has(key)) {
        seen.add(key);
        specs.push({ emoji, borderColor });
      }
    }
    return specs;
  }, [districtLookup, streamedItineraries]);

  const handleDistrictPress = useCallback(
    (districtId: string) => {
      if (selectedCommunityItinerary) {
        setSelectedCommunityItinerary(null);
        handlePreviewStop(null);
        return;
      }
      router.push(`/browse/${districtId}`);
    },
    [router, selectedCommunityItinerary, handlePreviewStop],
  );

  const handleCommunityMarkerSelect = useCallback(
    (itinerary: BrowseItineraryPreview, districtId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedCommunityItinerary({ itinerary, districtId });

      // Fly camera to the itinerary's entry point with 3D orbit
      if (itinerary.entryLatitude && itinerary.entryLongitude) {
        handlePreviewStop({
          coordinate: [itinerary.entryLongitude, itinerary.entryLatitude],
          emoji: itinerary.items?.[0]?.emoji ?? "\u{1F4CD}",
          color: "#86efac",
          title: itinerary.title ?? "",
        });
      }
    },
    [handlePreviewStop],
  );

  const handleCommunityDismiss = useCallback(() => {
    setSelectedCommunityItinerary(null);
    handlePreviewStop(null); // Stop orbit, restore camera
  }, [handlePreviewStop]);

  const handleMapPress = useCallback(() => {
    if (selectedCommunityItinerary) {
      setSelectedCommunityItinerary(null);
      handlePreviewStop(null);
    }
    baseMapPress();
  }, [baseMapPress, selectedCommunityItinerary, handlePreviewStop]);

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

  const hasActiveQuest = !!activeItinerary;

  // District Voronoi zones (fog of war)
  const districtZonesComponent = useMemo(() => {
    if (isLoadingLocation) return null;
    return <DistrictZonesLayer dimmed={hasActiveQuest} />;
  }, [isLoadingLocation, hasActiveQuest]);

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
        <RAnimated.View style={fabStyle1}>
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
        {/* Hidden off-screen SVG renderer — captures emojis as PNG for Mapbox */}
        <EmojiMapImageGenerator
          specs={markerImageSpecs}
          onImagesReady={setEmojiImages}
        />

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
            {districtZonesComponent}
            <AnchorMarkers />
            <CommunityItineraryMarkers
              dimmed={false}
              hidden={!!activeItinerary}
              onSelect={handleCommunityMarkerSelect}
              selectedId={selectedCommunityItinerary?.itinerary.id ?? null}
              emojiImages={emojiImages}
              districtLookup={districtLookup}
            />
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

        {floatingButtonsSection}

        {selectedCommunityItinerary && !activeItinerary && (
          <CommunityItineraryPreviewCard
            itinerary={selectedCommunityItinerary.itinerary}
            districtName={
              districts.find(
                (d) => d.id === selectedCommunityItinerary.districtId,
              )?.name ?? ""
            }
            onDismiss={handleCommunityDismiss}
            style={planBannerStyles.dialogBox}
          />
        )}
        {!selectedItem && !activeItinerary && !selectedCommunityItinerary && (
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
