import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useUserLocation } from "@/contexts/LocationContext";
import {
  useColors,
  fontFamily,
  fontSize,
  spacing,
  radius,
  spring,
  type Colors,
} from "@/theme";
import {
  MARKER_HEIGHT,
  MARKER_WIDTH,
  MarkerSVG,
  SHADOW_OFFSET,
  ShadowSVG,
} from "@/components/Markers/MarkerSVGs";

/* ── Types ─────────────────────────────────────────────────── */

export interface MapPin {
  id: string;
  coordinates: [number, number]; // [lng, lat]
}

interface MapPickerContentProps {
  /** Called when pins change (parent tracks state for submission) */
  onPinsChange: (pins: MapPin[]) => void;
  /** Current pins (controlled) */
  pins: MapPin[];
  /** Max number of pins allowed */
  maxPins?: number;
  /** Called when user confirms their pin selection */
  onConfirm?: () => void;
}

/* ── Constants ─────────────────────────────────────────────── */

const MAX_PINS_DEFAULT = 3;
const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";
const MARKER_ANCHOR = { x: 0.5, y: 1 };

let pinCounter = 0;

/* ── Animated map pin (matches AnchorMarkers style) ────────── */

const PickerPin = React.memo(
  ({
    pin,
    index,
    onRemove,
  }: {
    pin: MapPin;
    index: number;
    onRemove: (id: string) => void;
  }) => {
    const colors = useColors();
    const scale = useSharedValue(0);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0);

    useEffect(() => {
      scale.value = withSpring(1, spring.bouncy);
      rippleOpacity.value = withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(0.6, { duration: 50 }),
        withTiming(0, { duration: 600 }),
      );
      rippleScale.value = withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(3, { duration: 650 }),
      );
      return () => {
        cancelAnimation(scale);
        cancelAnimation(rippleScale);
        cancelAnimation(rippleOpacity);
      };
    }, []);

    const markerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      opacity: rippleOpacity.value,
      transform: [{ scale: rippleScale.value }],
      borderColor: GREEN_ACCENT,
    }));

    const handleLongPress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      scale.value = withSequence(
        withTiming(0.85, { duration: 100 }),
        withSpring(0, spring.bouncy),
      );
      setTimeout(() => onRemove(pin.id), 250);
    }, [pin.id, onRemove, scale]);

    return (
      <MapboxGL.MarkerView coordinate={pin.coordinates} anchor={MARKER_ANCHOR}>
        <View style={pinStyles.container}>
          <View style={[pinStyles.shadowWrap, staticShadowStyle]}>
            <ShadowSVG />
          </View>
          <Pressable onLongPress={handleLongPress} delayLongPress={400}>
            <Animated.View style={[pinStyles.markerWrap, markerStyle]}>
              <MarkerSVG
                fill={colors.accent.primary}
                stroke={colors.accent.dark}
                strokeWidth="3"
                highlightStrokeWidth="2.5"
                circleRadius="12"
                circleStroke={colors.accent.dark}
                circleStrokeWidth="1"
              />
              <View style={pinStyles.numberWrap}>
                <Text style={pinStyles.numberText}>{index + 1}</Text>
              </View>
              <Animated.View style={[pinStyles.ripple, rippleStyle]} />
            </Animated.View>
          </Pressable>
        </View>
      </MapboxGL.MarkerView>
    );
  },
);

/* ── Component ─────────────────────────────────────────────── */

export default function MapPickerContent({
  onPinsChange,
  pins,
  maxPins = MAX_PINS_DEFAULT,
  onConfirm,
}: MapPickerContentProps) {
  const colors = useColors();
  const { mapStyle } = useMapStyle();
  const { userLocation } = useUserLocation();
  const cameraRef = useRef<MapboxGL.Camera>(null);

  const defaultCenter = useMemo(() => {
    if (userLocation) return [userLocation[0], userLocation[1]];
    return [-104.9903, 39.7392]; // Denver fallback
  }, [userLocation]);

  const handleLongPress = useCallback(
    (event: any) => {
      "worklet";
      if (event?.geometry?.coordinates) {
        const [lng, lat] = event.geometry.coordinates;
        if (typeof lat === "number" && typeof lng === "number") {
          scheduleOnRN(
            (coords: [number, number], currentPins: MapPin[], max: number) => {
              if (currentPins.length >= max) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
                return;
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              pinCounter++;
              const newPin: MapPin = {
                id: `pin-${pinCounter}`,
                coordinates: coords,
              };
              onPinsChange([...currentPins, newPin]);
            },
            [lng, lat] as [number, number],
            pins,
            maxPins,
          );
        }
      }
    },
    [pins, maxPins, onPinsChange],
  );

  const handleRemovePin = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPinsChange(pins.filter((p) => p.id !== id));
    },
    [pins, onPinsChange],
  );

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapboxGL.MapView
          style={styles.map}
          styleURL={mapStyle}
          onLongPress={handleLongPress}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          compassEnabled={false}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: defaultCenter,
              zoomLevel: 11,
            }}
            animationDuration={0}
          />

          {/* Animated marker pins */}
          {pins.map((pin, idx) => (
            <PickerPin
              key={pin.id}
              pin={pin}
              index={idx}
              onRemove={handleRemovePin}
            />
          ))}

          <MapboxGL.LocationPuck
            puckBearingEnabled={false}
            puckBearing="heading"
          />
        </MapboxGL.MapView>

        {/* Hint overlay */}
        {pins.length === 0 && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.hintOverlay}
            pointerEvents="none"
          >
            <Text style={styles.hintText}>Long-press to drop a pin</Text>
          </Animated.View>
        )}
      </View>

      {/* Horizontal chip bar */}
      {pins.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.chipBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {pins.map((pin, idx) => (
              <Animated.View
                key={pin.id}
                entering={FadeIn.duration(200)}
                style={styles.chip}
              >
                <View style={styles.chipBadge}>
                  <Text style={styles.chipBadgeText}>{idx + 1}</Text>
                </View>
                <Text style={styles.chipCoords} numberOfLines={1}>
                  {pin.coordinates[1].toFixed(4)},{" "}
                  {pin.coordinates[0].toFixed(4)}
                </Text>
                <Pressable
                  onPress={() => handleRemovePin(pin.id)}
                  hitSlop={6}
                  style={styles.chipRemove}
                >
                  <X size={10} color={colors.text.disabled} strokeWidth={3} />
                </Pressable>
              </Animated.View>
            ))}
          </ScrollView>

          <View style={styles.chipBarRight}>
            <Text style={styles.pinCount}>
              {pins.length}/{maxPins}
            </Text>
            {onConfirm && (
              <Pressable style={styles.confirmButton} onPress={onConfirm}>
                <Text style={styles.confirmText}>Let's go</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/* ── Pin marker styles ─────────────────────────────────────── */

const staticShadowStyle = {
  opacity: 0.3,
  transform: [{ translateX: SHADOW_OFFSET.x }, { translateY: SHADOW_OFFSET.y }],
};

const pinStyles = StyleSheet.create({
  container: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  shadowWrap: {
    position: "absolute",
    bottom: 0,
    zIndex: -1,
  },
  markerWrap: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  numberWrap: {
    position: "absolute",
    top: spacing._10,
    width: MARKER_WIDTH,
    height: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontSize: fontSize.sm,
    textAlign: "center",
    fontWeight: "800",
    color: "#FFFFFF",
  },
  ripple: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 2,
    bottom: 0,
  },
});

/* ── Layout styles ─────────────────────────────────────────── */

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: 8,
    },
    mapContainer: {
      flex: 1,
      borderRadius: radius.md,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border.subtle,
      minHeight: 180,
    },
    map: {
      flex: 1,
    },
    hintOverlay: {
      position: "absolute",
      bottom: 12,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    hintText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      backgroundColor: colors.bg.card,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: radius.full,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    chipBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    chipScroll: {
      gap: 6,
      paddingRight: 4,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.bg.card,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      paddingLeft: 3,
      paddingRight: 8,
      paddingVertical: 3,
    },
    chipBadge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: GREEN_ACCENT,
      alignItems: "center",
      justifyContent: "center",
    },
    chipBadgeText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#0a2618",
      fontFamily: fontFamily.mono,
    },
    chipCoords: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
    },
    chipRemove: {
      marginLeft: 2,
      padding: 2,
    },
    chipBarRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    },
    pinCount: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
      letterSpacing: 0.5,
    },
    confirmButton: {
      backgroundColor: GREEN_MUTED,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    confirmText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: "700",
      color: GREEN_ACCENT,
    },
  });
