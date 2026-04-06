import { useColors, fontFamily, spacing } from "@/theme";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const CARD_WIDTH = 40;
const CARD_HEIGHT = 56; // ~5:7 ratio
const CARD_WIDTH_LG = 52;
const CARD_HEIGHT_LG = 72;
const CARD_COUNT = 5;
const CARD_COUNT_CHAIN = 7;

const SCREEN_WIDTH = Dimensions.get("window").width;

// Fan angles for each card (degrees), from left to right
const FAN_ANGLES = [-18, -9, 0, 9, 18];
// Vertical offsets to create a slight arc
const FAN_Y = [4, 1, 0, 1, 4];

// Chain layout: slight alternating rotations and vertical offsets
const CHAIN_ANGLES = [-6, 4, -3, 5, -4, 3, -5];
const CHAIN_Y = [2, -2, 1, -1, 2, -2, 1];
const CHAIN_OVERLAP = 16; // px overlap between cards

// All cards fly in from stage right
const ENTRY_FROM_X = SCREEN_WIDTH;

const STAGGER_MS = 120;
const INITIAL_DELAY = 600;

const CARD_TINTS = [
  "rgba(125, 211, 252, 0.5)", // sky accent
  "rgba(251, 191, 36, 0.5)", // amber
  "rgba(168, 85, 247, 0.5)", // purple
  "rgba(56, 189, 248, 0.5)", // sky blue
  "rgba(52, 211, 153, 0.5)", // teal
  "rgba(244, 114, 182, 0.5)", // pink
  "rgba(251, 146, 60, 0.5)", // orange
];

const CARD_ICONS = ["🎸", "🥾", "🎨", "🍳", "🏄", "🎤", "🧗"];

type MiniDeckVariant = "fan" | "chain";

interface MiniCardProps {
  index: number;
  fanProgress: Animated.SharedValue<number>;
  variant: MiniDeckVariant;
}

const MiniCard: React.FC<MiniCardProps> = React.memo(({ index, fanProgress, variant }) => {
  const colors = useColors();
  const tint = CARD_TINTS[index];

  // Per-card: animate translateX directly from offscreen to 0
  const translateX = useSharedValue(ENTRY_FROM_X);
  const landed = useSharedValue(1);
  const visible = useSharedValue(0);

  useEffect(() => {
    const delay = INITIAL_DELAY + index * STAGGER_MS;

    // Make visible right when animation starts
    visible.value = withDelay(delay, withTiming(1, { duration: 0 }));

    // Slide in from right
    translateX.value = withDelay(
      delay,
      withSpring(0, { damping: 22, stiffness: 200 }),
    );

    // Bounce on landing
    landed.value = withDelay(
      delay + 300,
      withSequence(
        withSpring(1.06, { damping: 20, stiffness: 400 }),
        withSpring(1, { damping: 22, stiffness: 350 }),
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    if (variant === "chain") {
      const chainAngle = interpolate(
        fanProgress.value,
        [0, 1],
        [0, CHAIN_ANGLES[index]],
        Extrapolation.CLAMP,
      );
      const chainY = interpolate(
        fanProgress.value,
        [0, 1],
        [0, CHAIN_Y[index]],
        Extrapolation.CLAMP,
      );

      return {
        opacity: visible.value,
        transform: [
          { translateX: translateX.value },
          { translateY: chainY },
          { rotate: `${chainAngle}deg` },
          { scale: landed.value },
        ],
      };
    }

    // Default fan variant
    const fanAngle = interpolate(
      fanProgress.value,
      [0, 1],
      [0, FAN_ANGLES[index]],
      Extrapolation.CLAMP,
    );
    const fanY = interpolate(
      fanProgress.value,
      [0, 1],
      [0, FAN_Y[index]],
      Extrapolation.CLAMP,
    );

    return {
      opacity: visible.value,
      transform: [
        { translateX: translateX.value },
        { translateY: fanY },
        { rotate: `${fanAngle}deg` },
        { scale: landed.value },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        variant === "chain" ? styles.cardChain : styles.card,
        variant === "chain" && { marginLeft: index === 0 ? 0 : -CHAIN_OVERLAP },
        {
          backgroundColor: colors.bg.card,
          borderColor: tint,
          zIndex: index,
        },
        animatedStyle,
      ]}
    >
      {/* Card gradient background */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`cardGrad${index}`} x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={tint} stopOpacity="0.3" />
              <Stop offset="1" stopColor="transparent" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx={8}
            fill={`url(#cardGrad${index})`}
          />
        </Svg>
      </View>

      {/* Card content */}
      <View style={styles.cardInner}>
        <Text style={variant === "chain" ? styles.cardIconLg : styles.cardIcon}>{CARD_ICONS[index]}</Text>
        <View style={[styles.cardLine, { backgroundColor: tint }]} />
        <View style={[styles.cardLineSm, { backgroundColor: tint }]} />
      </View>
    </Animated.View>
  );
});

interface MiniDeckProps {
  variant?: MiniDeckVariant;
}

const MiniDeck: React.FC<MiniDeckProps> = ({ variant = "fan" }) => {
  const fanProgress = useSharedValue(0);
  const count = variant === "chain" ? CARD_COUNT_CHAIN : CARD_COUNT;

  useEffect(() => {
    const fanDelay = INITIAL_DELAY + count * STAGGER_MS + 300;
    fanProgress.value = withDelay(
      fanDelay,
      withSpring(1, { damping: 20, stiffness: 180, mass: 0.8 }),
    );
  }, []);

  if (variant === "chain") {
    return (
      <View style={styles.chainContainer}>
        {Array.from({ length: CARD_COUNT_CHAIN }).map((_, i) => (
          <MiniCard key={i} index={i} fanProgress={fanProgress} variant="chain" />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.deckContainer}>
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <MiniCard key={i} index={i} fanProgress={fanProgress} variant="fan" />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    height: CARD_HEIGHT + 20,
    overflow: "visible",
  },
  deckContainer: {
    width: CARD_WIDTH + 40,
    height: CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  chainContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: CARD_HEIGHT_LG + 20,
    overflow: "visible",
  },
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardChain: {
    position: "relative",
    width: CARD_WIDTH_LG,
    height: CARD_HEIGHT_LG,
    borderRadius: 10,
    borderWidth: 1,
  },
  cardInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    gap: 4,
  },
  cardIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  cardIconLg: {
    fontSize: 20,
    marginBottom: 3,
  },
  cardLine: {
    width: "60%",
    height: 2,
    borderRadius: 1,
    opacity: 0.4,
  },
  cardLineSm: {
    width: "40%",
    height: 2,
    borderRadius: 1,
    opacity: 0.25,
  },
});

export default MiniDeck;
