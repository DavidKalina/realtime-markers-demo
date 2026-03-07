import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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
import DiscovererCardOverlay from "./DiscovererCardOverlay";

const TIER_COLORS: Record<string, string> = {
  Explorer: "#93c5fd",
  Scout: "#34d399",
  Curator: "#fbbf24",
  Ambassador: "#a78bfa",
};

const SHEEN_WIDTH = 140;
const CARD_HEIGHT = 210;
const WATERMARK_TEXT = "A THIRD SPACE";
const WATERMARK_CHAR_COUNT = WATERMARK_TEXT.length;
// Approximate character width ratio for SpaceMono (monospace ~0.6 of fontSize)
const CHAR_WIDTH_RATIO = 0.6;

interface DiscovererCardProps {
  userId?: string;
  firstName?: string;
  lastName?: string;
  currentTier?: string;
  totalXp?: number;
  discoveryCount?: number;
  followingCount?: number;
  memberSince?: string;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const DiscovererCard: React.FC<DiscovererCardProps> = ({
  userId,
  firstName,
  lastName,
  currentTier,
  totalXp,
  discoveryCount,
  followingCount,
  memberSince,
}) => {
  const colors = useColors();
  const cardStyles = useMemo(() => createCardStyles(colors), [colors]);
  const [cardWidth, setCardWidth] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const sheenProgress = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0 && cardWidth === 0) {
        setCardWidth(w);
        sheenProgress.value = withDelay(
          1000,
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        );
      }
    },
    [cardWidth, sheenProgress],
  );

  const sheenStyle = useAnimatedStyle(() => {
    if (cardWidth === 0) return { transform: [{ translateX: -SHEEN_WIDTH }] };
    const translateX = interpolate(
      sheenProgress.value,
      [0, 1],
      [-SHEEN_WIDTH, cardWidth + SHEEN_WIDTH],
    );
    return { transform: [{ translateX }] };
  });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const tierInfo = currentTier ? getTierByName(currentTier) : null;
  const tierColor = currentTier
    ? TIER_COLORS[currentTier] || TIER_COLORS.Explorer
    : TIER_COLORS.Explorer;

  // Calculate watermark font size to fit the diagonal of the card
  const watermarkFontSize = useMemo(() => {
    if (cardWidth === 0) return 0;
    // The diagonal of the card gives the max line length when rotated
    const diagonal = Math.sqrt(
      cardWidth * cardWidth + CARD_HEIGHT * CARD_HEIGHT,
    );
    // Use ~80% of diagonal to leave breathing room
    const available = diagonal * 0.8;
    // fontSize = available / (charCount * charWidthRatio + letterSpacingChars)
    // letterSpacing adds per-character, so effective width = charCount * (fontSize * ratio + letterSpacing)
    // Solve: available = charCount * (fontSize * ratio + 5)
    // fontSize = (available / charCount - 5) / ratio
    const size = (available / WATERMARK_CHAR_COUNT - 5) / CHAR_WIDTH_RATIO;
    return Math.min(Math.max(size, 16), 48);
  }, [cardWidth]);

  const displayName = (() => {
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    if (lastName) return lastName;
    return "Anonymous User";
  })();

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.97, spring.press);
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, spring.bouncy);
  }, [pressScale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOverlayVisible(true);
  }, []);

  return (
    <>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Animated.View
          style={[cardStyles.card, pressStyle]}
          onLayout={onLayout}
        >
          {/* Top row: name left, tier right */}
          <View style={cardStyles.topRow}>
            <Text style={cardStyles.name}>{displayName}</Text>
            {tierInfo && (
              <Text style={[cardStyles.tierText, { color: tierColor }]}>
                {tierInfo.emoji} {tierInfo.name}
              </Text>
            )}
          </View>

          {/* Diagonal etched watermark */}
          {cardWidth > 0 && (
            <View style={cardStyles.watermarkContainer} pointerEvents="none">
              <Text
                style={[cardStyles.watermark, { fontSize: watermarkFontSize }]}
                numberOfLines={1}
              >
                {WATERMARK_TEXT}
              </Text>
            </View>
          )}

          {/* Bottom section */}
          <View style={cardStyles.bottomSection}>
            {memberSince && (
              <Text style={cardStyles.memberSince}>
                Member since {memberSince}
              </Text>
            )}
            <View style={cardStyles.bottomRow}>
              <View style={cardStyles.stat}>
                <Text style={cardStyles.statValue}>
                  {(totalXp ?? 0).toLocaleString()}
                </Text>
                <Text style={cardStyles.statLabel}>XP</Text>
              </View>
              <View style={cardStyles.stat}>
                <Text style={cardStyles.statValue}>{discoveryCount ?? 0}</Text>
                <Text style={cardStyles.statLabel}>DISCOVERIES</Text>
              </View>
              <View style={cardStyles.stat}>
                <Text style={cardStyles.statValue}>{followingCount ?? 0}</Text>
                <Text style={cardStyles.statLabel}>FOLLOWING</Text>
              </View>
            </View>
          </View>

          {/* Sheen overlay — single sweep */}
          {cardWidth > 0 && (
            <AnimatedSvg
              style={[cardStyles.sheenOverlay, sheenStyle]}
              width={SHEEN_WIDTH}
              height={CARD_HEIGHT}
              pointerEvents="none"
            >
              <Defs>
                <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="white" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="white" stopOpacity="0.07" />
                  <Stop offset="1" stopColor="white" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={SHEEN_WIDTH}
                height={CARD_HEIGHT}
                fill="url(#sheen)"
              />
            </AnimatedSvg>
          )}
        </Animated.View>
      </Pressable>

      <DiscovererCardOverlay
        visible={overlayVisible}
        onDismiss={() => setOverlayVisible(false)}
        userId={userId}
        firstName={firstName}
        lastName={lastName}
        currentTier={currentTier}
        totalXp={totalXp}
        discoveryCount={discoveryCount}
        followingCount={followingCount}
        memberSince={memberSince}
      />
    </>
  );
};

const createCardStyles = (colors: Colors) => StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    width: "100%",
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
    color: colors.border.subtle,
    letterSpacing: 5,
    textShadowColor: colors.shadow.light,
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
  bottomRow: {
    flexDirection: "row",
    gap: spacing.xl,
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
    color: colors.text.secondary,
    letterSpacing: 1,
  },
  sheenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});

export default DiscovererCard;
