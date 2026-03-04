import { colors } from "@/theme";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";

const W = 280;
const H = 220;

// Action tiles — matches the footer buttons in EventDetails
const ACTIONS = [
  {
    label: "RSVP",
    color: "#34d399",
    iconPath: "M8 14 L12 18 L20 9",
    delay: 300,
  },
  {
    label: "SAVE",
    color: "#fbbf24",
    iconPath: "M9 5 L9 21 L14 17 L19 21 L19 5 Z",
    delay: 450,
  },
  {
    label: "MAP",
    color: "#38bdf8",
    iconPath:
      "M14 6 C10.5 6 8 8.8 8 12 C8 16.5 14 22 14 22 C14 22 20 16.5 20 12 C20 8.8 17.5 6 14 6 Z",
    delay: 600,
  },
  {
    label: "SHARE",
    color: "#a78bfa",
    iconPath: "M14 6 L14 18 M9 10 L14 6 L19 10",
    delay: 750,
  },
];

const TILE_SIZE = 52;
const TILE_GAP = 10;
const GRID_W = TILE_SIZE * 4 + TILE_GAP * 3;
const GRID_LEFT = (W - GRID_W) / 2;
const TILES_Y = 80;

interface ActionTileProps {
  index: number;
  label: string;
  color: string;
  iconPath: string;
  delay: number;
  active: boolean;
}

const ActionTile: React.FC<ActionTileProps> = ({
  index,
  label,
  color,
  iconPath,
  delay,
  active,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withDelay(
        delay,
        withSpring(1, { damping: 10, stiffness: 200, mass: 0.7 }),
      );
      opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    } else {
      scale.value = 0;
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [active, delay, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const x = GRID_LEFT + index * (TILE_SIZE + TILE_GAP);

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          top: TILES_Y,
          width: TILE_SIZE,
          alignItems: "center",
        },
        style,
      ]}
    >
      <Svg
        width={TILE_SIZE}
        height={TILE_SIZE}
        viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}
      >
        {/* Square tile with rounded corners */}
        <Rect
          x={0}
          y={0}
          width={TILE_SIZE}
          height={TILE_SIZE}
          rx={10}
          fill={`${color}20`}
          stroke={`${color}40`}
          strokeWidth={1.5}
        />
        {/* Icon centered in tile */}
        <Path
          d={iconPath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(12, 12)"
        />
      </Svg>
      <Animated.Text
        style={{
          color,
          fontSize: 9,
          fontWeight: "600",
          fontFamily: "SpaceMono",
          marginTop: 4,
          textAlign: "center",
        }}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  );
};

export const EngageIllustration: React.FC<{ active: boolean }> = ({
  active,
}) => {
  const containerOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.95);
  const cardOpacity = useSharedValue(0);
  const insightOpacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      containerOpacity.value = withTiming(1, { duration: 400 });
      cardOpacity.value = withTiming(1, { duration: 500 });
      cardScale.value = withSpring(1, { damping: 15, stiffness: 180 });
      insightOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
    } else {
      containerOpacity.value = withTiming(0, { duration: 300 });
      cardOpacity.value = 0;
      cardScale.value = 0.95;
      insightOpacity.value = 0;
    }
  }, [active, cardOpacity, cardScale, containerOpacity, insightOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const insightStyle = useAnimatedStyle(() => ({
    opacity: insightOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Event card preview at top */}
      <Animated.View style={[styles.cardPreview, cardStyle]}>
        <Svg width={GRID_W} height={56} viewBox={`0 0 ${GRID_W} 56`}>
          <Rect
            x={0}
            y={0}
            width={GRID_W}
            height={56}
            rx={12}
            fill={colors.bg.card}
            stroke={colors.border.default}
            strokeWidth={1}
          />
          {/* Emoji box */}
          <Rect
            x={8}
            y={10}
            width={36}
            height={36}
            rx={8}
            fill={colors.border.subtle}
            stroke={colors.border.medium}
            strokeWidth={1}
          />
          {/* Title */}
          <Rect
            x={54}
            y={14}
            width={100}
            height={7}
            rx={3.5}
            fill={colors.text.primary}
            opacity={0.5}
          />
          {/* Detail rows */}
          <Circle
            cx={58}
            cy={32}
            r={3}
            fill={colors.accent.primary}
            opacity={0.6}
          />
          <Rect
            x={64}
            y={29.5}
            width={60}
            height={5}
            rx={2.5}
            fill={colors.text.secondary}
            opacity={0.35}
          />
          <Circle
            cx={58}
            cy={44}
            r={3}
            fill={colors.accent.primary}
            opacity={0.6}
          />
          <Rect
            x={64}
            y={41.5}
            width={80}
            height={5}
            rx={2.5}
            fill={colors.text.secondary}
            opacity={0.35}
          />
        </Svg>
      </Animated.View>

      {/* Action tiles */}
      {ACTIONS.map((action, i) => (
        <ActionTile
          key={action.label}
          index={i}
          label={action.label}
          color={action.color}
          iconPath={action.iconPath}
          delay={action.delay}
          active={active}
        />
      ))}

      {/* Insight bar at bottom — automatic, not a button */}
      <Animated.View style={[styles.insightBar, insightStyle]}>
        <Svg width={GRID_W} height={36} viewBox={`0 0 ${GRID_W} 36`}>
          <Rect
            x={0}
            y={0}
            width={GRID_W}
            height={36}
            rx={8}
            fill="rgba(251, 191, 36, 0.08)"
            stroke="rgba(251, 191, 36, 0.25)"
            strokeWidth={1}
          />
          {/* Sparkle icon */}
          <Path
            d="M16 12 L17 15 L20 16 L17 17 L16 20 L15 17 L12 16 L15 15 Z"
            fill="#fbbf24"
            opacity={0.7}
          />
          {/* "AI Insight" text placeholder */}
          <Rect
            x={28}
            y={14}
            width={55}
            height={5}
            rx={2.5}
            fill="#fbbf24"
            opacity={0.4}
          />
          {/* Insight text lines */}
          <Rect
            x={28}
            y={23}
            width={GRID_W - 44}
            height={4}
            rx={2}
            fill={colors.text.secondary}
            opacity={0.2}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: W,
    height: H,
  },
  cardPreview: {
    position: "absolute",
    left: GRID_LEFT,
    top: 10,
  },
  insightBar: {
    position: "absolute",
    left: GRID_LEFT,
    top: 155,
  },
});
