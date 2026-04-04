import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import {
  CHECKIN_RADIUS_M,
  ALMOST_THERE_RADIUS_M,
  haversineDistance,
  bearing as calculateBearing,
} from "@realtime-markers/shared";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import type { ObjectiveResponse } from "@/services/api/modules/sidequests";
import {
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

/* ── Constants ──────────────────────────────────────────────── */

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const RING_SIZE = 280;
const RING_BORDER = 2;
const NEEDLE_SIZE = 72;
const DISMISS_THRESHOLD = 150;
const DISMISS_VELOCITY = 500;

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/* ── Needle SVG ─────────────────────────────────────────────── */

const NeedleArrow: React.FC<{ color: string }> = React.memo(({ color }) => (
  <Svg width={NEEDLE_SIZE} height={NEEDLE_SIZE} viewBox="0 0 72 72">
    <Polygon
      points="36,6 46,58 36,50 26,58"
      fill={color}
      stroke={color}
      strokeWidth={1}
      strokeLinejoin="round"
    />
  </Svg>
));

NeedleArrow.displayName = "NeedleArrow";

/* ── Tick marks ring ────────────────────────────────────────── */

const TICK_COUNT = 36;
const TICKS = Array.from({ length: TICK_COUNT }, (_, i) => i);
const TICK_INSET = 8; // distance from ring edge inward

const TickMarks: React.FC<{ color: string }> = React.memo(({ color }) => (
  <>
    {TICKS.map((i) => {
      const deg = (360 / TICK_COUNT) * i;
      const isMajor = i % 9 === 0;
      const tickH = isMajor ? 12 : 6;
      const tickW = isMajor ? 2 : 1;
      const r = RING_SIZE / 2 - TICK_INSET - tickH / 2;
      const rad = (deg * Math.PI) / 180;
      const cx = RING_SIZE / 2 + r * Math.sin(rad);
      const cy = RING_SIZE / 2 - r * Math.cos(rad);
      return (
        <View
          key={i}
          style={{
            position: "absolute",
            left: cx - tickW / 2,
            top: cy - tickH / 2,
            height: tickH,
            width: tickW,
            backgroundColor: color,
            opacity: isMajor ? 0.6 : 0.25,
            borderRadius: tickW / 2,
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      );
    })}
  </>
));

TickMarks.displayName = "TickMarks";

/* ── Props ──────────────────────────────────────────────────── */

interface QuestCompassProps {
  visible: boolean;
  onDismiss: () => void;
  objectives: ObjectiveResponse[];
  userLocation: [number, number] | null; // [lng, lat]
  accentColor?: string;
}

/* ── Component ──────────────────────────────────────────────── */

const QuestCompass: React.FC<QuestCompassProps> = ({
  visible,
  onDismiss,
  objectives,
  userLocation,
  accentColor = "#86efac",
}) => {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors, accentColor), [colors, accentColor]);

  /* ── Current objective (first unchecked with coords) ────── */

  const currentObjective = useMemo(
    () =>
      objectives
        .filter((o) => !o.checkedInAt && o.latitude != null && o.longitude != null)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null,
    [objectives],
  );

  /* ── Track displayed objective ───────────────────────── */

  const displayedObjective = currentObjective;

  /* ── Compass heading ───────────────────────────────────── */

  const { heading, isAvailable: compassAvailable } = useCompassHeading(visible);

  /* ── Bearing + distance ────────────────────────────────── */

  const bearingToObjective = useSharedValue(0);
  const [distanceM, setDistanceM] = useState<number | null>(null);

  useEffect(() => {
    if (
      !userLocation ||
      !displayedObjective?.latitude ||
      !displayedObjective?.longitude
    )
      return;

    const [lng, lat] = userLocation;
    const bearing = calculateBearing(
      lat,
      lng,
      displayedObjective.latitude,
      displayedObjective.longitude,
    );
    bearingToObjective.value = withSpring(bearing, {
      damping: 20,
      stiffness: 90,
    });

    const dist = haversineDistance(
      lat,
      lng,
      displayedObjective.latitude,
      displayedObjective.longitude,
    );
    setDistanceM(dist);
  }, [userLocation, displayedObjective]);

  /* ── Proximity state ───────────────────────────────────── */

  const isNearby = distanceM !== null && distanceM <= CHECKIN_RADIUS_M;
  const isAlmostThere =
    distanceM !== null &&
    distanceM > CHECKIN_RADIUS_M &&
    distanceM <= ALMOST_THERE_RADIUS_M;

  // Haptic when entering the nearby zone
  const wasNearby = useRef(false);
  useEffect(() => {
    if (isNearby && !wasNearby.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    wasNearby.current = isNearby;
  }, [isNearby]);

  /* ── Compass ring rotation (ring turns so N stays north) ── */

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-heading.value}deg` }],
  }));

  /* ── Needle rotation (points at objective relative to device) */

  const needleBobY = useSharedValue(0);
  useEffect(() => {
    needleBobY.value = withRepeat(
      withSequence(
        withTiming(-3, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(3, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      true,
    );
  }, []);

  const needleStyle = useAnimatedStyle(() => {
    const rotation = bearingToObjective.value - heading.value;
    return {
      transform: [
        { rotate: `${rotation}deg` },
        { translateY: needleBobY.value },
      ],
    };
  });

  /* ── Celebration pulse ─────────────────────────────────── */

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isNearby) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
    }
  }, [isNearby]);

  const ringPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  /* ── Completion state ──────────────────────────────────── */

  const allComplete =
    currentObjective === null &&
    objectives.length > 0 &&
    objectives.every((o) => o.checkedInAt);

  useEffect(() => {
    if (!allComplete || !visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => onDismiss(), 3000);
    return () => clearTimeout(t);
  }, [allComplete, visible]);

  /* ── Swipe-to-dismiss gesture ──────────────────────────── */

  const translateY = useSharedValue(0);

  const dismissGesture = Gesture.Pan()
    .activeOffsetY([15, Infinity])
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (
        e.translationY > DISMISS_THRESHOLD ||
        e.velocityY > DISMISS_VELOCITY
      ) {
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 200, easing: Easing.in(Easing.cubic) },
          () => {
            scheduleOnRN(onDismiss);
          },
        );
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const containerDragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT * 0.4],
      [1, 0.5],
    ),
  }));

  // Reset translate when opening
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible]);

  /* ── Distance label ────────────────────────────────────── */

  const distanceLabel = useMemo(() => {
    if (distanceM === null) return "";
    if (isNearby) return "You're here!";
    if (isAlmostThere) return "Almost there!";
    return formatDistance(distanceM);
  }, [distanceM, isNearby, isAlmostThere]);

  /* ── Progress ───────────────────────────────────────────── */

  const sortedObjectives = useMemo(
    () => [...objectives].sort((a, b) => a.sortOrder - b.sortOrder),
    [objectives],
  );

  const checkedInCount = objectives.filter((o) => o.checkedInAt).length;
  const currentIndex = displayedObjective
    ? sortedObjectives.findIndex((o) => o.id === displayedObjective.id) + 1
    : 0;

  /* ── Render ────────────────────────────────────────────── */

  if (!visible) return null;

  const noLocation = !userLocation;
  const noCoords =
    !displayedObjective && !allComplete && objectives.length > 0;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <GestureDetector gesture={dismissGesture}>
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={s.root}
        >
          <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />

          {/* Close button — outside GestureDetector so taps aren't intercepted */}
          <Pressable
            style={s.closeButton}
            hitSlop={16}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDismiss();
            }}
          >
            <X size={18} color={colors.text.secondary} />
          </Pressable>

          <Animated.View style={[s.content, containerDragStyle]}>
            {/* Drag indicator */}
            <View style={s.dragIndicator} />

            {/* ── HUD: inline quest info ── */}
            {displayedObjective && !noLocation && (
              <View style={s.hudContainer}>
                <View style={s.hudRow}>
                  <Text style={s.hudEmoji}>
                    {displayedObjective.emoji ?? "\u{1F4CD}"}
                  </Text>
                  <Text style={s.hudName} numberOfLines={1}>
                    {displayedObjective.venueName ?? displayedObjective.title}
                  </Text>
                  <Text style={s.hudProgress}>
                    {checkedInCount}/{sortedObjectives.length}
                  </Text>
                </View>
              </View>
            )}

            {/* Fallback states */}
            {noLocation && (
              <View style={s.fallback}>
                <Text style={s.fallbackText}>Waiting for location...</Text>
              </View>
            )}

            {noCoords && !noLocation && (
              <View style={s.fallback}>
                <Text style={s.fallbackText}>
                  No location data for objectives
                </Text>
              </View>
            )}

            {/* Completion state */}
            {allComplete && (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={s.completionContainer}
              >
                <Text style={s.completionEmoji}>{"\u2705"}</Text>
                <Text style={s.completionTitle}>Quest Complete!</Text>
                <Text style={s.completionSub}>All objectives checked in</Text>
              </Animated.View>
            )}

            {/* Active compass state — centered in remaining space */}
            {displayedObjective && !noLocation && (
              <View style={s.compassArea}>
                {/* Compass ring */}
                <Animated.View style={[s.compassContainer, ringPulseStyle]}>
                  <View
                    style={[
                      s.ring,
                      isNearby && {
                        borderColor: accentColor,
                        shadowColor: accentColor,
                        shadowOpacity: 0.4,
                        shadowRadius: 16,
                      },
                    ]}
                  >
                    {/* Rotating ring internals (cardinal labels + ticks) */}
                    <Animated.View style={[s.ringInner, ringStyle]}>
                      <TickMarks color={colors.text.secondary} />
                      <Text style={[s.cardinal, s.cardinalN]}>N</Text>
                      <Text style={[s.cardinal, s.cardinalE]}>E</Text>
                      <Text style={[s.cardinal, s.cardinalS]}>S</Text>
                      <Text style={[s.cardinal, s.cardinalW]}>W</Text>
                    </Animated.View>

                    {/* Needle (always points at objective) */}
                    <Animated.View style={[s.needleContainer, needleStyle]}>
                      <NeedleArrow
                        color={accentColor}
                      />
                    </Animated.View>

                  </View>
                </Animated.View>

                {/* Distance readout */}
                <View style={s.distanceContainer}>
                  <Text
                    style={[
                      s.distanceText,
                      isNearby && s.distanceTextNearby,
                      isAlmostThere && s.distanceTextAlmost,
                    ]}
                  >
                    {distanceLabel}
                  </Text>
                  {!isNearby && !isAlmostThere && distanceM !== null && (
                    <Text style={s.distanceSub}>to next stop</Text>
                  )}
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
};

QuestCompass.displayName = "QuestCompass";

export default QuestCompass;

/* ── Mini Compass Preview (inline on detail screen) ─────────── */

const MINI_RING = 80;
const MINI_NEEDLE = 28;
const MINI_TICK_COUNT = 12;
const MINI_TICKS = Array.from({ length: MINI_TICK_COUNT }, (_, i) => i);

const MiniNeedle: React.FC<{ color: string }> = React.memo(({ color }) => (
  <Svg width={MINI_NEEDLE} height={MINI_NEEDLE} viewBox="0 0 28 28">
    <Polygon
      points="14,3 18,22 14,19 10,22"
      fill={color}
      stroke={color}
      strokeWidth={0.5}
      strokeLinejoin="round"
    />
  </Svg>
));

MiniNeedle.displayName = "MiniNeedle";

interface MiniCompassPreviewProps {
  userLocation: [number, number] | null;
  objectiveLat: number;
  objectiveLng: number;
  distanceLabel: string;
  venueName: string;
  emoji: string;
  onPress: () => void;
  accentColor?: string;
}

export const MiniCompassPreview: React.FC<MiniCompassPreviewProps> = React.memo(
  ({ userLocation, objectiveLat, objectiveLng, distanceLabel, venueName, emoji, onPress, accentColor = "#86efac" }) => {
    const colors = useColors();
    const ms = useMemo(() => createMiniStyles(colors, accentColor), [colors, accentColor]);
    const { heading } = useCompassHeading(true);
    const bearingTo = useSharedValue(0);

    useEffect(() => {
      if (!userLocation) return;
      const [lng, lat] = userLocation;
      const b = calculateBearing(lat, lng, objectiveLat, objectiveLng);
      bearingTo.value = withTiming(b, { duration: 300 });
    }, [userLocation, objectiveLat, objectiveLng]);

    const ringRotation = useAnimatedStyle(() => ({
      transform: [{ rotate: `${-heading.value}deg` }],
    }));

    const needleRotation = useAnimatedStyle(() => ({
      transform: [{ rotate: `${bearingTo.value - heading.value}deg` }],
    }));

    return (
      <Pressable style={ms.container} onPress={onPress}>
        {/* Compass */}
        <View style={ms.compassWrap}>
          <View style={ms.ring}>
            <Animated.View style={[ms.ringInner, ringRotation]}>
              {/* Tick marks */}
              {MINI_TICKS.map((i) => {
                const deg = (360 / MINI_TICK_COUNT) * i;
                const isMajor = i % 3 === 0;
                const h = isMajor ? 6 : 3;
                const w = isMajor ? 1.5 : 1;
                const r = MINI_RING / 2 - 5 - h / 2;
                const rad = (deg * Math.PI) / 180;
                const cx = MINI_RING / 2 + r * Math.sin(rad);
                const cy = MINI_RING / 2 - r * Math.cos(rad);
                return (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      left: cx - w / 2,
                      top: cy - h / 2,
                      height: h,
                      width: w,
                      backgroundColor: colors.text.secondary,
                      opacity: isMajor ? 0.5 : 0.2,
                      borderRadius: w / 2,
                      transform: [{ rotate: `${deg}deg` }],
                    }}
                  />
                );
              })}
              {/* N label */}
              <Text style={ms.northLabel}>N</Text>
            </Animated.View>

            {/* Needle */}
            <Animated.View style={[ms.needleWrap, needleRotation]}>
              <MiniNeedle color={accentColor} />
            </Animated.View>
          </View>
        </View>

        {/* Info */}
        <View style={ms.info}>
          <View style={ms.nameRow}>
            <Text style={ms.emoji}>{emoji}</Text>
            <Text style={ms.name} numberOfLines={1}>{venueName}</Text>
          </View>
          <Text style={ms.distance}>{distanceLabel} away</Text>
          <Text style={ms.cta}>Tap to expand</Text>
        </View>
      </Pressable>
    );
  },
);

MiniCompassPreview.displayName = "MiniCompassPreview";

const createMiniStyles = (colors: Colors, accentHex = "#86efac") => {
  const r = parseInt(accentHex.slice(1, 3), 16);
  const g = parseInt(accentHex.slice(3, 5), 16);
  const b = parseInt(accentHex.slice(5, 7), 16);
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.04)`,
      borderWidth: 1,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
      borderRadius: 16,
      padding: spacing.md,
    },
    compassWrap: {
      width: MINI_RING,
      height: MINI_RING,
    },
    ring: {
      width: MINI_RING,
      height: MINI_RING,
      borderRadius: MINI_RING / 2,
      borderWidth: 1.5,
      borderColor: colors.border.default,
      alignItems: "center",
      justifyContent: "center",
    },
    ringInner: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    northLabel: {
      position: "absolute",
      top: 8,
      alignSelf: "center",
      fontSize: 7,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: accentHex,
    },
    needleWrap: {
      position: "absolute",
      width: MINI_NEEDLE,
      height: MINI_NEEDLE,
      alignItems: "center",
      justifyContent: "center",
    },
    info: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    emoji: {
      fontSize: 14,
    },
    name: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      flex: 1,
    },
    distance: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: accentHex,
    },
    cta: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
  });
};

/* ── Styles ─────────────────────────────────────────────────── */

const createStyles = (colors: Colors, accentHex = "#86efac") =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    content: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: spacing.lg,
    },

    /* Drag indicator */
    dragIndicator: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.text.secondary,
      opacity: 0.4,
      marginTop: spacing.xl + 16,
      marginBottom: spacing.md,
    },

    /* Close button */
    closeButton: {
      position: "absolute",
      top: spacing.xl + 24,
      right: spacing.xl,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },

    /* HUD */
    hudContainer: {
      alignSelf: "flex-start",
      gap: spacing.sm,
    },
    hudRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    hudEmoji: {
      fontSize: 14,
    },
    hudName: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    hudProgress: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: accentHex,
    },

    /* Fallback */
    fallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
    },
    fallbackText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },

    /* Completion */
    completionContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
    },
    completionEmoji: {
      fontSize: 48,
    },
    completionTitle: {
      fontSize: 24,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: accentHex,
    },
    completionSub: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },

    /* Compass + distance centered in remaining space */
    compassArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    compassContainer: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    ring: {
      width: RING_SIZE,
      height: RING_SIZE,
      borderRadius: RING_SIZE / 2,
      borderWidth: RING_BORDER,
      borderColor: colors.border.default,
      alignItems: "center",
      justifyContent: "center",
    },
    ringInner: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Cardinal labels */
    cardinal: {
      position: "absolute",
      fontSize: 13,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    cardinalN: {
      top: 24,
      alignSelf: "center",
      color: accentHex,
    },
    cardinalE: {
      right: 24,
      top: RING_SIZE / 2 - 8,
    },
    cardinalS: {
      bottom: 24,
      alignSelf: "center",
    },
    cardinalW: {
      left: 24,
      top: RING_SIZE / 2 - 8,
    },

    /* Needle */
    needleContainer: {
      position: "absolute",
      width: NEEDLE_SIZE,
      height: NEEDLE_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Distance */
    distanceContainer: {
      alignItems: "center",
      gap: 4,
      marginTop: spacing.lg,
    },
    distanceText: {
      fontSize: 32,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    distanceTextNearby: {
      color: accentHex,
    },
    distanceTextAlmost: {
      color: "#fbbf24",
    },
    distanceSub: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },

  });
