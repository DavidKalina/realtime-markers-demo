import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
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
import type { AdventureScoreResponse } from "@/services/api/modules/adventureScore";

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

const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 8;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const FACTOR_META = [
  { key: "activityScore" as const, label: "Activity", color: "#4ade80" },
  { key: "consistencyScore" as const, label: "Consistency", color: "#60a5fa" },
  { key: "diversityScore" as const, label: "Diversity", color: "#fbbf24" },
  { key: "completionScore" as const, label: "Completion", color: "#a78bfa" },
  { key: "discoveryScore" as const, label: "Discovery", color: "#f97316" },
];

function overlayScoreColor(score: number): string {
  const t = Math.min(Math.max(score / 100, 0), 1);
  const r = Math.round(180 - t * 140);
  const g = Math.round(230 - t * 60);
  const b = Math.round(180 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}

const AnimatedSubScore: React.FC<{
  value: number;
  color: string;
  delay: number;
  style: ReturnType<typeof StyleSheet.create>[string];
}> = ({ value, color, delay, style }) => {
  const animated = useSharedValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withDelay(
      delay,
      withTiming(value, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [value, delay, animated]);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (current) => {
      scheduleOnRN(setDisplayed, current);
    },
  );

  return <Text style={[style, { color }]}>{displayed}</Text>;
};

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
  scoreData?: AdventureScoreResponse | null;
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
  scoreData,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createOverlayStyles(colors), [colors]);
  const scrimOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.85);
  const cardOpacity = useSharedValue(0);
  const flipProgress = useSharedValue(0); // 0 = front (score), 1 = back (identity)

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

  // Score ring animation
  const animatedProgress = useSharedValue(0);
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    if (!scoreData || !visible) return;
    animatedProgress.value = 0;
    animatedProgress.value = withDelay(
      400,
      withTiming(scoreData.score / 100, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [scoreData, visible, animatedProgress]);

  const animatedScore = useSharedValue(0);

  useEffect(() => {
    if (!scoreData || !visible) return;
    animatedScore.value = 0;
    animatedScore.value = withDelay(
      400,
      withTiming(scoreData.score, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [scoreData, visible, animatedScore]);

  useAnimatedReaction(
    () => Math.round(animatedScore.value),
    (current) => {
      scheduleOnRN(setDisplayedScore, current);
    },
  );

  const circleAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - animatedProgress.value),
  }));

  const onShow = useCallback(() => {
    scrimOpacity.value = withTiming(1, { duration: 300 });
    cardScale.value = withSpring(1, spring.firm);
    cardOpacity.value = withTiming(1, { duration: 200 });
    flipProgress.value = 0;
  }, [scrimOpacity, cardScale, cardOpacity, flipProgress]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardScale.value = withSpring(0.85, spring.firm);
    cardOpacity.value = withTiming(0, { duration: 200 });
    scrimOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        scheduleOnRN(onDismiss);
      }
    });
  }, [cardScale, cardOpacity, scrimOpacity, onDismiss]);

  const handleFlip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = flipProgress.value < 0.5 ? 1 : 0;
    flipProgress.value = withSpring(target, {
      damping: 20,
      stiffness: 200,
      mass: 0.8,
    });
  }, [flipProgress]);

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

  // Front face: visible from 0-90deg, hidden from 90-180deg
  const frontStyle = useAnimatedStyle(() => {
    const rotateYDeg = interpolate(flipProgress.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 800 }, { rotateY: `${rotateYDeg}deg` }],
      backfaceVisibility: "hidden" as const,
      opacity: flipProgress.value < 0.5 ? 1 : 0,
    };
  });

  // Back face: starts at -180deg, visible from 90-180deg
  const backStyle = useAnimatedStyle(() => {
    const rotateYDeg = interpolate(flipProgress.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 800 }, { rotateY: `${rotateYDeg}deg` }],
      backfaceVisibility: "hidden" as const,
      opacity: flipProgress.value >= 0.5 ? 1 : 0,
    };
  });

  const sheenTiltStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      sheenTranslateX.value,
      [-15, 15],
      [-SHEEN_WIDTH, OVERLAY_CARD_WIDTH + SHEEN_WIDTH],
    );
    return { transform: [{ translateX }] };
  });

  const color = scoreData ? overlayScoreColor(scoreData.score) : "#4ade80";

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
        <Animated.View style={[styles.scrim, scrimStyle]} />
      </Pressable>

      {/* Centered card */}
      <View style={styles.centerContainer} pointerEvents="box-none">
        <Animated.View style={entranceStyle}>
          <Animated.View style={tiltStyle}>
            <Pressable onPress={handleFlip}>
              {/* Front face — Adventure Score */}
              <Animated.View style={[styles.cardFace, frontStyle]}>
                <Text style={styles.sectionLabel}>ADVENTURE SCORE</Text>

                <View style={styles.scoreRow}>
                  <View style={styles.circleWrapper}>
                    <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
                      <Circle
                        cx={CIRCLE_SIZE / 2}
                        cy={CIRCLE_SIZE / 2}
                        r={CIRCLE_RADIUS}
                        stroke={colors.border.accent}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                      />
                      <AnimatedCircle
                        cx={CIRCLE_SIZE / 2}
                        cy={CIRCLE_SIZE / 2}
                        r={CIRCLE_RADIUS}
                        stroke={color}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        animatedProps={circleAnimatedProps}
                        transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
                      />
                    </Svg>
                    <View style={styles.circleLabel}>
                      <Text style={[styles.circleScore, { color }]}>
                        {displayedScore}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.factorsColumn}>
                    {FACTOR_META.map((factor, index) => (
                      <View key={factor.key} style={styles.factorRow}>
                        <View style={styles.factorLabelRow}>
                          <View
                            style={[
                              styles.factorDot,
                              { backgroundColor: factor.color },
                            ]}
                          />
                          <Text style={styles.factorLabel}>{factor.label}</Text>
                        </View>
                        <AnimatedSubScore
                          value={scoreData?.[factor.key] ?? 0}
                          color={factor.color}
                          delay={500 + index * 150}
                          style={styles.factorValue}
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <Text style={styles.flipHint}>Tap to flip</Text>

                {/* Tilt-driven sheen */}
                <AnimatedSvg
                  style={[styles.sheenOverlay, sheenTiltStyle]}
                  width={SHEEN_WIDTH}
                  height={OVERLAY_CARD_HEIGHT}
                  pointerEvents="none"
                >
                  <Defs>
                    <LinearGradient
                      id="overlaySheen"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
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
              </Animated.View>

              {/* Back face — Personal Identity */}
              <Animated.View
                style={[styles.cardFace, styles.cardFaceBack, backStyle]}
              >
                {/* Top row */}
                <View style={styles.topRow}>
                  <Text style={styles.name}>{displayName}</Text>
                  {tierInfo && (
                    <Text style={[styles.tierText, { color: tierColor }]}>
                      {tierInfo.emoji} {tierInfo.name}
                    </Text>
                  )}
                </View>

                {/* Watermark */}
                <View style={styles.watermarkContainer} pointerEvents="none">
                  <Text
                    style={[styles.watermark, { fontSize: watermarkFontSize }]}
                    numberOfLines={1}
                  >
                    {WATERMARK_TEXT}
                  </Text>
                </View>

                {/* Weekly badge */}
                {currentStreak != null && currentStreak > 0 && (
                  <View
                    style={[styles.weeklyBadge, { borderColor: tierColor }]}
                  >
                    <Text style={[styles.weeklyText, { color: tierColor }]}>
                      {currentStreak}w streak
                    </Text>
                  </View>
                )}

                {/* Bottom section */}
                <View style={styles.bottomSection}>
                  {memberSince && (
                    <Text style={styles.memberSince}>
                      Member since {memberSince}
                    </Text>
                  )}
                  <View style={styles.bottomRow}>
                    <View style={styles.stat}>
                      <Text style={[styles.statValue, { color: tierColor }]}>
                        {(totalXp ?? 0).toLocaleString()}
                      </Text>
                      <Text style={styles.statLabel}>XP</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{currentStreak ?? 0}</Text>
                      <Text style={styles.statLabel}>STREAK</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{longestStreak ?? 0}</Text>
                      <Text style={styles.statLabel}>BEST</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.flipHint}>Tap to flip</Text>

                {/* Tilt-driven sheen */}
                <AnimatedSvg
                  style={[styles.sheenOverlay, sheenTiltStyle]}
                  width={SHEEN_WIDTH}
                  height={OVERLAY_CARD_HEIGHT}
                  pointerEvents="none"
                >
                  <Defs>
                    <LinearGradient
                      id="overlaySheenBack"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
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
                    fill="url(#overlaySheenBack)"
                  />
                </AnimatedSvg>
              </Animated.View>
            </Pressable>
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
    cardFaceBack: {
      position: "absolute",
      top: 0,
      left: 0,
    },
    // Front face — score
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    circleWrapper: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      justifyContent: "center",
      alignItems: "center",
    },
    circleLabel: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    circleScore: {
      fontSize: 32,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    factorsColumn: {
      flex: 1,
      gap: spacing.xs,
    },
    factorRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    factorLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    factorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    factorLabel: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    factorValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    flipHint: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      textAlign: "center",
      letterSpacing: 0.5,
    },
    // Back face — identity
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
