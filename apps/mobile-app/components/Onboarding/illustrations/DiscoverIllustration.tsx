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
import Svg, { Rect } from "react-native-svg";

// Layout constants — everything relative to a 280×220 container
const W = 280;
const H = 220;
const CONTENT_W = 220; // width of search bar / cards
const PAD = (W - CONTENT_W) / 2; // left padding to center content

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
          left: PAD + x,
          top: 52,
          paddingHorizontal: 12,
          paddingVertical: 6,
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

interface EventCardProps {
  y: number;
  delay: number;
  active: boolean;
  width: number;
}

const EventCard: React.FC<EventCardProps> = ({ y, delay, active, width }) => {
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

  // Center each card: (containerWidth - cardWidth) / 2
  const cardLeft = (W - width) / 2;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: cardLeft,
          top: y,
          width,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.bg.card,
          borderWidth: 1,
          borderColor: colors.accent.border,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: "#34d399",
          marginRight: 8,
        }}
      />
      <Animated.View
        style={{
          width: width * 0.5,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.text.secondary,
          opacity: 0.4,
        }}
      />
    </Animated.View>
  );
};

export const DiscoverIllustration: React.FC<{ active: boolean }> = ({
  active,
}) => {
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
      {/* Search bar via SVG */}
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect
          x={PAD}
          y={12}
          width={CONTENT_W}
          height={32}
          rx={16}
          fill={colors.bg.card}
          stroke={colors.accent.border}
          strokeWidth={1}
        />
        {/* Search placeholder text */}
        <Rect
          x={PAD + 16}
          y={24}
          width={50}
          height={6}
          rx={3}
          fill={colors.text.secondary}
          opacity={0.3}
        />
      </Svg>

      {/* Filter pills — positioned relative to PAD */}
      <FilterPill
        label="Music"
        x={0}
        color="#a78bfa"
        delay={300}
        active={active}
      />
      <FilterPill
        label="Art"
        x={70}
        color="#38bdf8"
        delay={450}
        active={active}
      />
      <FilterPill
        label="Food"
        x={120}
        color="#34d399"
        delay={600}
        active={active}
      />
      <FilterPill
        label="Free"
        x={175}
        color="#fbbf24"
        delay={750}
        active={active}
      />

      {/* Event cards — centered */}
      <EventCard y={88} delay={500} active={active} width={CONTENT_W} />
      <EventCard y={132} delay={650} active={active} width={210} />
      <EventCard y={176} delay={800} active={active} width={215} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: W,
    height: H,
  },
});
