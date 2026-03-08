import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useMapStyle } from "@/contexts/MapStyleContext";
import {
  useColors,
  fontFamily,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import type { ItineraryItemResponse } from "@/services/api/modules/itineraries";

// Well-known city centers for fallback (avoids geocoding API call)
const CITY_COORDS: Record<string, [number, number]> = {
  denver: [-104.9903, 39.7392],
  "new york": [-73.9857, 40.7484],
  "los angeles": [-118.2437, 34.0522],
  chicago: [-87.6298, 41.8781],
  austin: [-97.7431, 30.2672],
  miami: [-80.1918, 25.7617],
  "san francisco": [-122.4194, 37.7749],
  seattle: [-122.3321, 47.6062],
  portland: [-122.6765, 45.5152],
  nashville: [-86.7816, 36.1627],
  "new orleans": [-90.0715, 29.9511],
  atlanta: [-84.388, 33.749],
  boston: [-71.0589, 42.3601],
  philadelphia: [-75.1652, 39.9526],
  "washington dc": [-77.0369, 38.9072],
  london: [-0.1278, 51.5074],
  paris: [2.3522, 48.8566],
  tokyo: [139.6917, 35.6895],
};

// Accent colors matching the timeline
const STOP_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
  "#f9a8d4",
  "#fdba74",
  "#67e8f9",
];

interface ItineraryMapPreviewProps {
  items: ItineraryItemResponse[];
  city: string;
}

// --- Animated marker that pops in when the camera arrives ---

const StopMarker = React.memo(
  ({
    item,
    index,
    isRevealed,
  }: {
    item: ItineraryItemResponse;
    index: number;
    isRevealed: boolean;
  }) => {
    const color = STOP_COLORS[index % STOP_COLORS.length];
    const scale = useSharedValue(0);

    useEffect(() => {
      if (isRevealed) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSpring(1, { damping: 8, stiffness: 200, mass: 0.6 });
      } else {
        scale.value = 0;
      }
    }, [isRevealed]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: scale.value,
    }));

    if (!item.latitude || !item.longitude) return null;

    return (
      <MapboxGL.MarkerView
        coordinate={[Number(item.longitude), Number(item.latitude)]}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <Animated.View style={[styles.marker, animStyle]}>
          <View style={[styles.markerDot, { backgroundColor: color }]}>
            <Text style={styles.markerEmoji}>{item.emoji || "\u{1F4CD}"}</Text>
          </View>
          <View style={[styles.markerPulse, { borderColor: color }]} />
        </Animated.View>
      </MapboxGL.MarkerView>
    );
  },
);

// --- Progress bar ---

const ProgressBar = ({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(progress, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
    backgroundColor: color,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressBar, barStyle]} />
    </View>
  );
};

// --- Main preview component ---

export default function ItineraryMapPreview({
  items,
  city,
}: ItineraryMapPreviewProps) {
  const colors = useColors();
  const s = useMemo(() => createComponentStyles(colors), [colors]);
  const { mapStyle } = useMapStyle();

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(-1);
  const [revealedStops, setRevealedStops] = useState<Set<number>>(new Set());
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Filter to items that have coordinates
  const geoItems = useMemo(
    () =>
      [...items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((item) => item.latitude && item.longitude),
    [items],
  );

  // Overlay fade for the play button
  const overlayOpacity = useSharedValue(1);
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  // Current stop label
  const labelOpacity = useSharedValue(0);
  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  // Resolve city center for fallback (fuzzy: "Denver, CO" → "denver")
  const cityCenter = useMemo(() => {
    const normalized = city.toLowerCase().trim();
    if (CITY_COORDS[normalized]) return CITY_COORDS[normalized];
    for (const [key, coords] of Object.entries(CITY_COORDS)) {
      if (normalized.startsWith(key) || key.startsWith(normalized))
        return coords;
    }
    return null;
  }, [city]);

  const hasGeoStops = geoItems.length > 0;

  // Compute the bounding box for initial camera
  const bounds = useMemo(() => {
    if (geoItems.length === 0) return null;
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const item of geoItems) {
      const lng = Number(item.longitude!);
      const lat = Number(item.latitude!);
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    // Add padding
    const lngPad = (maxLng - minLng) * 0.15 || 0.005;
    const latPad = (maxLat - minLat) * 0.15 || 0.005;
    return {
      sw: [minLng - lngPad, minLat - latPad] as [number, number],
      ne: [maxLng + lngPad, maxLat + latPad] as [number, number],
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [
        number,
        number,
      ],
    };
  }, [geoItems]);

  // Camera center: use bounds center if available, otherwise city center
  const cameraCenter = bounds?.center || cityCenter;

  const handlePlay = useCallback(() => {
    if (geoItems.length === 0 || !cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(true);
    setRevealedStops(new Set());
    setCurrentStopIndex(-1);

    // Hide play overlay
    overlayOpacity.value = withTiming(0, { duration: 300 });

    // Scripted camera sequence
    const DWELL_MS = 2200; // time spent at each stop
    const FLY_MS = 1800; // camera fly duration

    geoItems.forEach((item, idx) => {
      const startDelay = idx * (DWELL_MS + FLY_MS);

      // Fly camera to this stop
      const flyTimeout = setTimeout(() => {
        const lng = Number(item.longitude!);
        const lat = Number(item.latitude!);

        cameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: 15.5,
          pitch: 50,
          animationDuration: idx === 0 ? 1200 : FLY_MS,
          animationMode: "flyTo",
        });

        // Show the stop label
        setCurrentStopIndex(idx);
        labelOpacity.value = withTiming(1, { duration: 300 });
      }, startDelay);
      timeoutsRef.current.push(flyTimeout);

      // Pop in the marker after camera arrives
      const markerDelay = idx === 0 ? 800 : FLY_MS * 0.7;
      const markerTimeout = setTimeout(() => {
        setRevealedStops((prev) => new Set(prev).add(idx));
      }, startDelay + markerDelay);
      timeoutsRef.current.push(markerTimeout);

      // Fade label before next fly
      if (idx < geoItems.length - 1) {
        const fadeTimeout = setTimeout(
          () => {
            labelOpacity.value = withTiming(0, { duration: 200 });
          },
          startDelay + DWELL_MS + FLY_MS - 400,
        );
        timeoutsRef.current.push(fadeTimeout);
      }
    });

    // End: zoom out to show all stops
    const totalDuration = geoItems.length * (DWELL_MS + FLY_MS);
    const endTimeout = setTimeout(() => {
      if (bounds) {
        cameraRef.current?.fitBounds(bounds.sw, bounds.ne, 50, 1500);
      }
      labelOpacity.value = withDelay(500, withTiming(0, { duration: 300 }));

      // Show replay overlay
      const replayTimeout = setTimeout(() => {
        overlayOpacity.value = withTiming(1, { duration: 400 });
        setIsPlaying(false);
        setCurrentStopIndex(-1);
      }, 2000);
      timeoutsRef.current.push(replayTimeout);
    }, totalDuration);
    timeoutsRef.current.push(endTimeout);
  }, [geoItems, bounds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeouts();
  }, []);

  // Need at least a city center or geocoded stops to show anything
  if (!cameraCenter) {
    console.warn(
      "[ItineraryMapPreview] No camera center resolved for city:",
      city,
      "| geoItems:",
      geoItems.length,
    );
    return null;
  }

  const currentItem = currentStopIndex >= 0 ? geoItems[currentStopIndex] : null;
  const currentColor =
    currentStopIndex >= 0
      ? STOP_COLORS[currentStopIndex % STOP_COLORS.length]
      : "#86efac";

  return (
    <View style={s.container}>
      <MapboxGL.MapView
        styleURL={mapStyle}
        style={s.map}
        pitchEnabled={false}
        zoomEnabled={false}
        scrollEnabled={false}
        rotateEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: cameraCenter,
            zoomLevel: hasGeoStops ? 12 : 11,
          }}
        />

        {/* Markers */}
        {geoItems.map((item, idx) => (
          <StopMarker
            key={item.id}
            item={item}
            index={idx}
            isRevealed={revealedStops.has(idx)}
          />
        ))}
      </MapboxGL.MapView>

      {/* Current stop label overlay */}
      {currentItem && (
        <Animated.View style={[s.stopLabelContainer, labelStyle]}>
          <View style={[s.stopLabel, { borderColor: currentColor + "40" }]}>
            <Text style={s.stopLabelEmoji}>
              {currentItem.emoji || "\u{1F4CD}"}
            </Text>
            <View style={s.stopLabelTextCol}>
              <Text style={s.stopLabelTitle} numberOfLines={1}>
                {currentItem.title}
              </Text>
              {currentItem.venueName && (
                <Text style={s.stopLabelVenue} numberOfLines={1}>
                  {currentItem.venueName}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Progress bar */}
      {isPlaying && geoItems.length > 1 && (
        <View style={s.progressContainer}>
          <ProgressBar
            progress={(currentStopIndex + 1) / geoItems.length}
            color={currentColor}
          />
        </View>
      )}

      {/* Play / Replay overlay */}
      <Animated.View
        style={[s.playOverlay, overlayStyle]}
        pointerEvents={isPlaying ? "none" : "auto"}
      >
        {hasGeoStops ? (
          <Pressable
            style={({ pressed }) => [
              s.playButton,
              pressed && s.playButtonPressed,
            ]}
            onPress={handlePlay}
          >
            <Text style={s.playIcon}>
              {revealedStops.size > 0 ? "\u{1F504}" : "\u{25B6}\uFE0F"}
            </Text>
            <Text style={s.playText}>
              {revealedStops.size > 0 ? "Replay" : "Preview Route"}
            </Text>
          </Pressable>
        ) : (
          <View style={s.cityLabel}>
            <Text style={s.cityLabelText}>{city}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// --- Static styles (non-themed) ---
const styles = StyleSheet.create({
  marker: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  markerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  markerEmoji: {
    fontSize: 16,
  },
  markerPulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    opacity: 0.3,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 1.5,
    overflow: "hidden",
  },
  progressBar: {
    height: 3,
    borderRadius: 1.5,
  },
});

// --- Themed styles ---
const createComponentStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      height: 220,
      borderRadius: radius.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    map: {
      flex: 1,
    },

    // Stop label
    stopLabelContainer: {
      position: "absolute",
      bottom: 12,
      left: 12,
      right: 12,
    },
    stopLabel: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg.card + "EE",
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
    },
    stopLabelEmoji: {
      fontSize: 20,
    },
    stopLabelTextCol: {
      flex: 1,
      gap: 1,
    },
    stopLabelTitle: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    stopLabelVenue: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },

    // Progress
    progressContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 0,
    },

    // Play overlay
    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    playButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(134, 239, 172, 0.15)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.35)",
      borderRadius: radius.full,
      paddingHorizontal: 20,
      paddingVertical: 10,
      gap: 8,
    },
    playButtonPressed: {
      backgroundColor: "rgba(134, 239, 172, 0.25)",
    },
    playIcon: {
      fontSize: 16,
    },
    playText: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#86efac",
      textTransform: "uppercase",
      letterSpacing: 1,
    },

    // City label (when no geocoded stops)
    cityLabel: {
      backgroundColor: "rgba(0,0,0,0.3)",
      borderRadius: radius.full,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    cityLabelText: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
  });
