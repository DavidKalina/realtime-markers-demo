import { useColors } from "@/theme";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";

const W = 280;
const H = 230;
const CARD_LEFT = 20;
const CARD_W = 240;
const CARD_H = 52;
const CARD_R = 10;

interface FilterPillProps {
  label: string;
  x: number;
  color: string;
  delay: number;
  active: boolean;
}

const FilterPill: React.FC<FilterPillProps> = ({
  label,
  x,
  color,
  delay,
  active,
}) => {
  const colors = useColors();
  const translateX = useSharedValue(-30);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      translateX.value = withDelay(
        delay,
        withSpring(0, { damping: 15, stiffness: 200 }),
      );
      opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    } else {
      translateX.value = -30;
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [active, delay, opacity, translateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          top: 48,
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 12,
          backgroundColor: color,
        },
        style,
      ]}
    >
      <Animated.Text
        style={{ color: colors.bg.primary, fontSize: 11, fontWeight: "600" }}
      >
        {label}
      </Animated.Text>
    </Animated.View>
  );
};

interface EventCardSketchProps {
  y: number;
  delay: number;
  active: boolean;
  emoji: string;
  titleW: number;
  detailW1: number;
  detailW2: number;
}

const EventCardSketch: React.FC<EventCardSketchProps> = ({
  y,
  delay,
  active,
  emoji,
  titleW,
  detailW1,
  detailW2,
}) => {
  const colors = useColors();
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    if (active) {
      translateY.value = withDelay(
        delay,
        withSpring(0, { damping: 15, stiffness: 180 }),
      );
      opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
      scale.value = withDelay(
        delay,
        withSpring(1, { damping: 15, stiffness: 180 }),
      );
    } else {
      translateY.value = 20;
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = 0.95;
    }
  }, [active, delay, opacity, scale, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const emojiBoxSize = 36;
  const emojiX = CARD_LEFT + 8;
  const emojiY = y + (CARD_H - emojiBoxSize) / 2;
  const textX = emojiX + emojiBoxSize + 10;
  const chevronX = CARD_LEFT + CARD_W - 30;
  const chevronCY = y + CARD_H / 2;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Card background */}
        <Rect
          x={CARD_LEFT}
          y={y}
          width={CARD_W}
          height={CARD_H}
          rx={CARD_R}
          fill={colors.bg.card}
          stroke={colors.border.default}
          strokeWidth={1}
        />

        {/* Emoji square */}
        <Rect
          x={emojiX}
          y={emojiY}
          width={emojiBoxSize}
          height={emojiBoxSize}
          rx={8}
          fill={colors.border.subtle}
          stroke={colors.border.medium}
          strokeWidth={1}
        />
        <SvgText
          x={emojiX + emojiBoxSize / 2}
          y={emojiY + emojiBoxSize / 2 + 6}
          textAnchor="middle"
          fontSize={18}
        >
          {emoji}
        </SvgText>

        {/* Title bar */}
        <Rect
          x={textX}
          y={y + 10}
          width={titleW}
          height={7}
          rx={3.5}
          fill={colors.text.primary}
          opacity={0.5}
        />

        {/* Detail row 1: calendar icon + text */}
        <Rect
          x={textX}
          y={y + 24}
          width={6}
          height={6}
          rx={1}
          fill={colors.accent.primary}
          opacity={0.6}
        />
        <Rect
          x={textX + 10}
          y={y + 25}
          width={detailW1}
          height={5}
          rx={2.5}
          fill={colors.text.secondary}
          opacity={0.35}
        />

        {/* Detail row 2: pin icon + text */}
        <Circle
          cx={textX + 3}
          cy={y + 38}
          r={3}
          fill={colors.accent.primary}
          opacity={0.6}
        />
        <Rect
          x={textX + 10}
          y={y + 35.5}
          width={detailW2}
          height={5}
          rx={2.5}
          fill={colors.text.secondary}
          opacity={0.35}
        />

        {/* Chevron circle */}
        <Circle
          cx={chevronX}
          cy={chevronCY}
          r={12}
          fill={colors.border.subtle}
          stroke={colors.border.medium}
          strokeWidth={1}
        />
        <Path
          d={`M${chevronX - 3} ${chevronCY - 4} L${chevronX + 2} ${chevronCY} L${chevronX - 3} ${chevronCY + 4}`}
          fill="none"
          stroke={colors.text.detail}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
};

export const DiscoverIllustration: React.FC<{ active: boolean }> = ({
  active,
}) => {
  const colors = useColors();
  const containerOpacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      containerOpacity.value = withTiming(1, { duration: 400 });
    } else {
      containerOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [active, containerOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Search bar */}
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect
          x={CARD_LEFT}
          y={8}
          width={CARD_W}
          height={32}
          rx={16}
          fill={colors.bg.card}
          stroke={colors.accent.border}
          strokeWidth={1}
        />
        {/* Search icon (magnifier) */}
        <Circle
          cx={CARD_LEFT + 20}
          cy={24}
          r={5}
          fill="none"
          stroke={colors.text.secondary}
          strokeWidth={1.2}
          opacity={0.4}
        />
        <Line
          x1={CARD_LEFT + 24}
          y1={28}
          x2={CARD_LEFT + 27}
          y2={31}
          stroke={colors.text.secondary}
          strokeWidth={1.2}
          opacity={0.4}
        />
        <Rect
          x={CARD_LEFT + 34}
          y={21}
          width={45}
          height={5}
          rx={2.5}
          fill={colors.text.secondary}
          opacity={0.2}
        />
      </Svg>

      {/* Filter pills */}
      <FilterPill
        label="Music"
        x={CARD_LEFT}
        color="#a78bfa"
        delay={300}
        active={active}
      />
      <FilterPill
        label="Art"
        x={CARD_LEFT + 70}
        color="#38bdf8"
        delay={450}
        active={active}
      />
      <FilterPill
        label="Food"
        x={CARD_LEFT + 120}
        color="#34d399"
        delay={600}
        active={active}
      />
      <FilterPill
        label="Free"
        x={CARD_LEFT + 175}
        color="#fbbf24"
        delay={750}
        active={active}
      />

      {/* Event cards that look like EventItem */}
      <EventCardSketch
        y={82}
        delay={500}
        active={active}
        emoji="🎵"
        titleW={90}
        detailW1={55}
        detailW2={70}
      />
      <EventCardSketch
        y={142}
        delay={650}
        active={active}
        emoji="🎨"
        titleW={75}
        detailW1={65}
        detailW2={50}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: W,
    height: H,
  },
});
