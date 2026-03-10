import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import MapboxGL from "@rnmapbox/maps";
import * as Haptics from "expo-haptics";
import Screen from "../Layout/Screen";
import {
  useColors,
  spacing,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  type Colors,
} from "@/theme";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useMapMountGate } from "@/hooks/useMapMountGate";

const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";

export interface TrailData {
  id: number;
  name: string;
  surface: string;
  lengthMeters: number;
  lit: boolean | null;
  geometry: [number, number][];
  center: [number, number];
}

interface TrailDetailsProps {
  trail: TrailData;
  onBack?: () => void;
}

/** Calculate bearing between two [lng, lat] points. */
function bearing(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180;
  const dLng = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const TrailDetails: React.FC<TrailDetailsProps> = ({ trail, onBack }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { mapStyle } = useMapStyle();
  const { isMapSafeToMount, onContainerLayout } = useMapMountGate("trail");

  // --- Fly-along state ---
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const overlayOpacity = useSharedValue(1);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const progressValue = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
    backgroundColor: GREEN_ACCENT,
  }));

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimeouts(), [clearTimeouts]);

  // Compute center + zoom from geometry bounding box
  const cameraSettings = useMemo(() => {
    if (trail.geometry.length === 0) {
      return { center: trail.center, zoom: 15 };
    }
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of trail.geometry) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
    const latDelta = maxLat - minLat;
    const lngDelta = maxLng - minLng;
    const maxDelta = Math.max(latDelta, lngDelta, 0.001);
    const zoom = Math.min(Math.max(Math.log2(360 / maxDelta) - 1, 10), 17);
    return { center, zoom };
  }, [trail.geometry, trail.center]);

  const handlePreview = useCallback(() => {
    if (trail.geometry.length < 2 || !cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(true);
    setHasPlayed(true);
    clearTimeouts();
    overlayOpacity.value = withTiming(0, { duration: 300 });
    progressValue.value = 0;

    // Cinematic drone flyover: smooth glide from start to end with gentle sway
    const start = trail.geometry[0];
    const end = trail.geometry[trail.geometry.length - 1];
    const baseHeading = bearing(start, end);
    const FLY_DURATION = 14000; // slow & cinematic

    progressValue.value = withTiming(1, {
      duration: FLY_DURATION + 1200,
      easing: Easing.linear,
    });

    // Fly-in to trail start
    cameraRef.current.setCamera({
      centerCoordinate: start,
      zoomLevel: 15.5,
      pitch: 68,
      heading: baseHeading,
      animationDuration: 1200,
      animationMode: "flyTo",
    });

    // Then glide with gentle heading + pitch sway via rAF
    const glideStart = setTimeout(() => {
      const t0 = performance.now();

      const animate = (now: number) => {
        if (!cameraRef.current) return;

        const elapsed = now - t0;
        const t = Math.min(elapsed / FLY_DURATION, 1);

        if (t >= 1) {
          // Done — zoom back out
          cameraRef.current.setCamera({
            centerCoordinate: cameraSettings.center,
            zoomLevel: cameraSettings.zoom,
            pitch: 0,
            heading: 0,
            animationDuration: 1500,
            animationMode: "flyTo",
          });

          const showOverlay = setTimeout(() => {
            overlayOpacity.value = withTiming(1, { duration: 400 });
            setIsPlaying(false);
            progressValue.value = withTiming(0, { duration: 300 });
          }, 2000);
          timeoutsRef.current.push(showOverlay);
          return;
        }

        // Ease in/out for a gentle start and stop
        const ease = t < 0.5
          ? 2 * t * t
          : 1 - Math.pow(-2 * t + 2, 2) / 2;

        // Lerp position
        const lng = start[0] + (end[0] - start[0]) * ease;
        const lat = start[1] + (end[1] - start[1]) * ease;

        // Gentle heading sway: ±12° with slow sine
        const headingSway = Math.sin(t * Math.PI * 3) * 12;
        // Subtle pitch bob: 65–70°
        const pitch = 66 + Math.sin(t * Math.PI * 2.5) * 4;
        // Subtle zoom breathe: 15.3–15.7
        const zoom = 15.5 + Math.sin(t * Math.PI * 2) * 0.2;

        cameraRef.current.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: zoom,
          pitch,
          heading: baseHeading + headingSway,
          animationDuration: 0,
        });

        frameRef.current = requestAnimationFrame(animate);
      };

      frameRef.current = requestAnimationFrame(animate);
    }, 1200);
    timeoutsRef.current.push(glideStart);
  }, [trail.geometry, cameraSettings, clearTimeouts]);

  const lengthLabel =
    trail.lengthMeters >= 1000
      ? `${(trail.lengthMeters / 1000).toFixed(1)} km`
      : `${trail.lengthMeters}m`;

  const milesLabel = `${(trail.lengthMeters / 1609.34).toFixed(1)} mi`;

  const handleOpenMaps = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const [lng, lat] = trail.center;
    const label = encodeURIComponent(trail.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    });
    if (url) Linking.openURL(url);
  }, [trail]);

  // Build GeoJSON for the trail line
  const trailGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: trail.geometry,
          },
          properties: {},
        },
      ],
    }),
    [trail.geometry],
  );

  return (
    <Screen
      bannerTitle="Trail"
      bannerEmoji="🛤️"
      showBackButton
      onBack={onBack}
      extendBannerToStatusBar
    >
      {/* Map preview with trail line + fly-along */}
      <View
        style={styles.mapContainer}
        onLayout={onContainerLayout}
      >
        {isMapSafeToMount && (
          <MapboxGL.MapView
            pitchEnabled={false}
            zoomEnabled={false}
            compassEnabled={false}
            scrollEnabled={false}
            rotateEnabled={false}
            scaleBarEnabled={false}
            style={styles.map}
            styleURL={mapStyle}
            logoEnabled={false}
            attributionEnabled={false}
          >
            <MapboxGL.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: cameraSettings.center,
                zoomLevel: cameraSettings.zoom,
              }}
            />
            <MapboxGL.ShapeSource id="trail-line" shape={trailGeoJSON}>
              <MapboxGL.LineLayer
                id="trail-line-layer"
                style={{
                  lineColor: GREEN_ACCENT,
                  lineWidth: 4,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </MapboxGL.ShapeSource>
          </MapboxGL.MapView>
        )}

        {/* Progress bar */}
        {isPlaying && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressBar, progressStyle]} />
            </View>
          </View>
        )}

        {/* Play / Replay overlay */}
        {trail.geometry.length >= 2 && (
          <Animated.View
            style={[styles.playOverlay, overlayStyle]}
            pointerEvents={isPlaying ? "none" : "auto"}
          >
            <Pressable
              style={({ pressed }) => [
                styles.playButton,
                pressed && styles.playButtonPressed,
              ]}
              onPress={handlePreview}
            >
              <Text style={styles.playIcon}>
                {hasPlayed ? "\u{1F504}" : "\u{25B6}\uFE0F"}
              </Text>
              <Text style={[styles.playText, { color: GREEN_ACCENT }]}>
                {hasPlayed ? "Replay" : "Preview Trail"}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Hero: title + label + stat chips */}
      <View style={styles.hero}>
        <Animated.View
          entering={FadeInDown.duration(300).delay(0).springify()}
        >
          <Text style={styles.trailTitle}>{trail.name}</Text>
          <View style={styles.heroLabelRow}>
            <View style={styles.heroLabelPill}>
              <Text style={styles.heroLabelText}>TRAIL</Text>
            </View>
            <Text style={styles.heroDot}> · </Text>
            <Text style={styles.heroSubtext}>{trail.surface}</Text>
          </View>
        </Animated.View>

        {/* Stat chips */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(100).springify()}
          style={styles.chipRow}
        >
          <View style={[styles.statChip, { borderColor: "rgba(134, 239, 172, 0.25)" }]}>
            <Text style={[styles.statChipValue, { color: GREEN_ACCENT }]}>
              {lengthLabel}
            </Text>
          </View>
          <View style={[styles.statChip, { borderColor: "rgba(147, 197, 253, 0.25)" }]}>
            <Text style={[styles.statChipValue, { color: "#93c5fd" }]}>
              {milesLabel}
            </Text>
          </View>
          <View style={[styles.statChip, { borderColor: "rgba(252, 211, 77, 0.25)" }]}>
            <Text style={[styles.statChipValue, { color: "#fcd34d" }]}>
              {trail.surface}
            </Text>
          </View>
          {trail.lit !== null && (
            <View style={[styles.statChip, { borderColor: "rgba(196, 181, 253, 0.25)" }]}>
              <Text style={[styles.statChipValue, { color: "#c4b5fd" }]}>
                {trail.lit ? "Lit" : "Unlit"}
              </Text>
            </View>
          )}
        </Animated.View>
      </View>

      {/* Divider */}
      <Animated.View
        entering={FadeIn.delay(200).duration(400)}
        style={styles.divider}
      />

      {/* Details section */}
      <View style={styles.detailsSection}>
        {/* About */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(200).springify()}
        >
          <Text style={styles.infoCardTitle}>About</Text>
          <Text style={styles.descriptionText}>
            {trail.name} is a {lengthLabel} ({milesLabel}){" "}
            {trail.surface} trail
            {trail.lit === true
              ? ", lit for night use"
              : trail.lit === false
                ? ". Not lit at night"
                : ""}
            . Great for walking, biking, or skating.
          </Text>
        </Animated.View>

        {/* Trail Info */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(280).springify()}
          style={styles.sectionDivider}
        >
          <Text style={styles.infoCardTitle}>Trail Info</Text>
          <View style={styles.infoRows}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Surface</Text>
              <Text style={styles.infoValue}>{trail.surface}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Length</Text>
              <Text style={styles.infoValue}>
                {lengthLabel} ({milesLabel})
              </Text>
            </View>
            {trail.lit !== null && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Lit at night</Text>
                <Text style={styles.infoValue}>
                  {trail.lit ? "Yes" : "No"}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Coordinates</Text>
              <Text style={styles.infoValue}>
                {trail.center[1].toFixed(4)}, {trail.center[0].toFixed(4)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Source */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(360).springify()}
          style={styles.sectionDivider}
        >
          <Text style={styles.infoCardTitle}>Source</Text>
          <Text style={styles.sourceText}>OpenStreetMap</Text>
        </Animated.View>

        {/* Open in Maps button */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(440).springify()}
          style={styles.actionSection}
        >
          <Pressable
            style={({ pressed }) => [
              styles.mapsButton,
              pressed && styles.mapsButtonPressed,
            ]}
            onPress={handleOpenMaps}
          >
            <Text style={styles.mapsButtonText}>Open in Maps</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Screen>
  );
};

export default TrailDetails;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    mapContainer: {
      height: 220,
      overflow: "hidden",
    },
    map: {
      flex: 1,
    },
    progressContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    progressTrack: {
      height: 3,
      backgroundColor: "rgba(255,255,255,0.1)",
      overflow: "hidden",
    },
    progressBar: {
      height: 3,
    },
    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    playButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 10,
      gap: 8,
    },
    playButtonPressed: {
      backgroundColor: "rgba(255,255,255,0.2)",
    },
    playIcon: {
      fontSize: 16,
    },
    playText: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },

    // Hero
    hero: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      gap: spacing.md,
    },
    trailTitle: {
      fontSize: 22,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
      lineHeight: 28,
    },
    heroLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 2,
    },
    heroLabelPill: {
      backgroundColor: GREEN_MUTED,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    heroLabelText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: GREEN_ACCENT,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    heroDot: {
      fontSize: 11,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
    },
    heroSubtext: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },

    // Stat chips
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statChip: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statChipValue: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },

    // Divider
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.lg,
      marginHorizontal: spacing.lg,
    },

    // Details
    detailsSection: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl * 3,
      gap: spacing.md,
    },
    infoCardTitle: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
    },
    sectionDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
      paddingTop: spacing.lg,
      marginTop: spacing.xs,
    },
    descriptionText: {
      fontSize: fontSize.md,
      color: colors.text.primary,
      lineHeight: lineHeight.loose,
      fontFamily: fontFamily.mono,
    },
    infoRows: {
      gap: spacing.sm,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    infoLabel: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    infoValue: {
      fontSize: fontSize.sm,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
    },
    sourceText: {
      fontSize: fontSize.sm,
      color: colors.text.detail,
      fontFamily: fontFamily.mono,
    },

    // Action button
    actionSection: {
      marginTop: spacing.md,
    },
    mapsButton: {
      backgroundColor: GREEN_MUTED,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    mapsButtonPressed: {
      backgroundColor: "rgba(134, 239, 172, 0.2)",
    },
    mapsButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: GREEN_ACCENT,
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
  });
