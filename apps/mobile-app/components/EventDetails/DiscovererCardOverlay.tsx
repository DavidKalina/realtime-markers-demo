import React, { useCallback, useMemo } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Svg, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import {
  useColors,
  radius,
  spacing,
  fontSize,
  fontFamily,
  fontWeight,
  spring,
  type Colors,
} from "@/theme";
import { getTierByName } from "@/utils/gamification";
import { useDeviceMotionTilt } from "./useDeviceMotionTilt";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_ASPECT = 1.586; // Credit card ratio
const OVERLAY_CARD_WIDTH = SCREEN_WIDTH * 0.85;
const OVERLAY_CARD_HEIGHT = OVERLAY_CARD_WIDTH / CARD_ASPECT;
const SHEEN_WIDTH = 140;

const TIER_COLORS: Record<string, string> = {
  Explorer: "#4ade80",
  Scout: "#60a5fa",
  Curator: "#fbbf24",
  Ambassador: "#a78bfa",
};

const WATERMARK_TEXT = "A THIRD SPACE";
const WATERMARK_CHAR_COUNT = WATERMARK_TEXT.length;
const CHAR_WIDTH_RATIO = 0.6;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface DiscovererCardOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  firstName?: string;
  lastName?: string;
  currentTier?: string;
  totalXp?: number;
  currentStreak?: number;
  longestStreak?: number;
  memberSince?: string;
}

const DiscovererCardOverlay: React.FC<DiscovererCardOverlayProps> = ({
  visible,
  onDismiss,
  firstName,
  lastName,
  currentTier,
  totalXp,
  currentStreak,
  longestStreak,
  memberSince,
}) => {
  const colors = useColors();
  const overlayStyles = useMemo(() => createOverlayStyles(colors), [colors]);
  const scrimOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.85);
  const cardOpacity = useSharedValue(0);

  const { rotateX, rotateY, sheenTranslateX } = useDeviceMotionTilt(visible);

  const tierInfo = currentTier ? getTierByName(currentTier) : null;
  const tierColor = currentTier
    ? TIER_COLORS[currentTier] || TIER_COLORS.Explorer
    : TIER_COLORS.Explorer;

  const displayName = (() => {
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    if (lastName) return lastName;
    return "Anonymous User";
  })();

  const watermarkFontSize = (() => {
    const diagonal = Math.sqrt(
      OVERLAY_CARD_WIDTH * OVERLAY_CARD_WIDTH +
        OVERLAY_CARD_HEIGHT * OVERLAY_CARD_HEIGHT,
    );
    const available = diagonal * 0.8;
    const size = (available / WATERMARK_CHAR_COUNT - 5) / CHAR_WIDTH_RATIO;
    return Math.min(Math.max(size, 16), 48);
  })();

  const onShow = useCallback(() => {
    scrimOpacity.value = withTiming(1, { duration: 300 });
    cardScale.value = withSpring(1, spring.firm);
    cardOpacity.value = withTiming(1, { duration: 200 });
  }, [scrimOpacity, cardScale, cardOpacity]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardScale.value = withSpring(0.85, spring.firm);
    cardOpacity.value = withTiming(0, { duration: 200 });
    scrimOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
      }
    });
  }, [cardScale, cardOpacity, scrimOpacity, onDismiss]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateX: `${-rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
    ],
  }));

  const sheenTiltStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      sheenTranslateX.value,
      [-15, 15],
      [-SHEEN_WIDTH, OVERLAY_CARD_WIDTH + SHEEN_WIDTH],
    );
    return { transform: [{ translateX }] };
  });

  if (!visible) return null;

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      onShow={onShow}
      onRequestClose={handleDismiss}
    >
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
        <Animated.View style={[overlayStyles.scrim, scrimStyle]} />
      </Pressable>

      {/* Centered card */}
      <View style={overlayStyles.centerContainer} pointerEvents="box-none">
        <Animated.View style={entranceStyle}>
          <Animated.View style={tiltStyle}>
            <View style={overlayStyles.cardFace}>
              {/* Top row */}
              <View style={overlayStyles.topRow}>
                <Text style={overlayStyles.name}>{displayName}</Text>
                {tierInfo && (
                  <Text style={[overlayStyles.tierText, { color: tierColor }]}>
                    {tierInfo.emoji} {tierInfo.name}
                  </Text>
                )}
              </View>

              {/* Watermark */}
              <View
                style={overlayStyles.watermarkContainer}
                pointerEvents="none"
              >
                <Text
                  style={[
                    overlayStyles.watermark,
                    { fontSize: watermarkFontSize },
                  ]}
                  numberOfLines={1}
                >
                  {WATERMARK_TEXT}
                </Text>
              </View>

              {/* Weekly badge */}
              {weeklyScanCount != null && weeklyScanCount > 0 && (
                <View
                  style={[
                    overlayStyles.weeklyBadge,
                    { borderColor: tierColor },
                  ]}
                >
                  <Text
                    style={[overlayStyles.weeklyText, { color: tierColor }]}
                  >
                    {weeklyScanCount} this week
                  </Text>
                </View>
              )}

              {/* Bottom section */}
              <View style={overlayStyles.bottomSection}>
                {memberSince && (
                  <Text style={overlayStyles.memberSince}>
                    Member since {memberSince}
                  </Text>
                )}
                <View style={overlayStyles.bottomRow}>
                  <View style={overlayStyles.stat}>
                    <Text
                      style={[overlayStyles.statValue, { color: tierColor }]}
                    >
                      {(totalXp ?? 0).toLocaleString()}
                    </Text>
                    <Text style={overlayStyles.statLabel}>XP</Text>
                  </View>
                  <View style={overlayStyles.stat}>
                    <Text style={overlayStyles.statValue}>
                      {currentStreak ?? 0}
                    </Text>
                    <Text style={overlayStyles.statLabel}>STREAK</Text>
                  </View>
                  <View style={overlayStyles.stat}>
                    <Text style={overlayStyles.statValue}>
                      {longestStreak ?? 0}
                    </Text>
                    <Text style={overlayStyles.statLabel}>BEST</Text>
                  </View>
                </View>
              </View>

              {/* Tilt-driven sheen */}
              <AnimatedSvg
                style={[overlayStyles.sheenOverlay, sheenTiltStyle]}
                width={SHEEN_WIDTH}
                height={OVERLAY_CARD_HEIGHT}
                pointerEvents="none"
              >
                <Defs>
                  <LinearGradient id="overlaySheen" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="white" stopOpacity="0" />
                    <Stop offset="0.5" stopColor="white" stopOpacity="0.12" />
                    <Stop offset="1" stopColor="white" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width={SHEEN_WIDTH}
                  height={OVERLAY_CARD_HEIGHT}
                  fill="url(#overlaySheen)"
                />
              </AnimatedSvg>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createOverlayStyles = (colors: Colors) =>
  StyleSheet.create({
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
    },
    centerContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    cardFace: {
      width: OVERLAY_CARD_WIDTH,
      height: OVERLAY_CARD_HEIGHT,
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.default,
      padding: spacing.md,
      overflow: "hidden",
      justifyContent: "space-between",
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    tierText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
    },
    watermarkContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
    },
    watermark: {
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "rgba(255, 255, 255, 0.03)",
      letterSpacing: 5,
      textShadowColor: "rgba(0, 0, 0, 0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 0,
      transform: [{ rotate: "-18deg" }],
    },
    name: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      letterSpacing: 1,
    },
    bottomSection: {
      gap: spacing.xs,
    },
    memberSince: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    weeklyBadge: {
      alignSelf: "flex-end",
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    weeklyText: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },
    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    stat: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    statValue: {
      fontSize: fontSize.lg,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    statLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      letterSpacing: 1,
    },
    sheenOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
    },
  });

export default DiscovererCardOverlay;
