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
const CARD_COUNT = 5;

const SCREEN_WIDTH = Dimensions.get("window").width;

// Fan angles for each card (degrees), from left to right
const FAN_ANGLES = [-18, -9, 0, 9, 18];
// Vertical offsets to create a slight arc
const FAN_Y = [4, 1, 0, 1, 4];

// All cards fly in from stage right
const ENTRY_FROM_X = SCREEN_WIDTH;

const STAGGER_MS = 120;
const INITIAL_DELAY = 600;
const FAN_DELAY = INITIAL_DELAY + CARD_COUNT * STAGGER_MS + 300;

const CARD_TINTS = [
  "rgba(134, 239, 172, 0.5)", // green
  "rgba(251, 191, 36, 0.5)", // amber
  "rgba(168, 85, 247, 0.5)", // purple
  "rgba(56, 189, 248, 0.5)", // sky blue
  "rgba(52, 211, 153, 0.5)", // teal
];

const CARD_ICONS = ["🎸", "🥾", "🎨", "🍳", "🏄"];

interface MiniCardProps {
  index: number;
  fanProgress: Animated.SharedValue<number>;
}

const MiniCard: React.FC<MiniCardProps> = React.memo(({ index, fanProgress }) => {
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
    // Phase 2: fan out from pile
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
        styles.card,
        {
          backgroundColor: colors.bg.card,
          borderColor: tint,
          zIndex: index, // last card lands on top, then fan reorders visually
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
        <Text style={styles.cardIcon}>{CARD_ICONS[index]}</Text>
        <View style={[styles.cardLine, { backgroundColor: tint }]} />
        <View style={[styles.cardLineSm, { backgroundColor: tint }]} />
      </View>
    </Animated.View>
  );
});

const MiniDeck: React.FC = () => {
  const fanProgress = useSharedValue(0);

  useEffect(() => {
    // After all cards have landed, fan them out
    fanProgress.value = withDelay(
      FAN_DELAY,
      withSpring(1, { damping: 20, stiffness: 180, mass: 0.8 }),
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.deckContainer}>
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <MiniCard key={i} index={i} fanProgress={fanProgress} />
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
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
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
