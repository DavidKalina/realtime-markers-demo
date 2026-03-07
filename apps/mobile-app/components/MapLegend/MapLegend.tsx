import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useLocationStore } from "@/stores/useLocationStore";
import { getCategoryColor } from "@/utils/categoryColors";
import { useColors, fontFamily, radius, spacing, type Colors } from "@/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Ring geometry
const RING_SIZE = 44;
const RING_RADIUS = 16;
const RING_STROKE = 6;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const MAX_CATEGORIES = 6;

const titleCase = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

/** Single animated arc segment of the DNA ring */
function RingSegment({
  color,
  arcLength,
  offset,
  index,
}: {
  color: string;
  arcLength: number;
  offset: number;
  index: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 80,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, progress]);

  const animatedProps = useAnimatedProps(() => {
    const currentArc = arcLength * progress.value;
    return {
      strokeDasharray: [currentArc, RING_CIRCUMFERENCE - currentArc],
    };
  });

  return (
    <AnimatedCircle
      cx={RING_SIZE / 2}
      cy={RING_SIZE / 2}
      r={RING_RADIUS}
      fill="none"
      stroke={color}
      strokeWidth={RING_STROKE}
      strokeLinecap="butt"
      strokeDashoffset={-offset}
      animatedProps={animatedProps}
    />
  );
}

function MapLegend() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const markers = useLocationStore((state) => state.markers);
  const selectedItem = useLocationStore((state) => state.selectedItem);

  // Collapse when a marker is selected or the map is tapped
  useEffect(() => {
    setExpanded(false);
  }, [selectedItem]);

  const activeCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of markers) {
      const cat = m.data.categories?.[0];
      if (cat) counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CATEGORIES)
      .map(([name, count]) => ({
        name,
        count,
        color: getCategoryColor(name),
      }));
  }, [markers]);

  const total = useMemo(
    () => activeCategories.reduce((sum, c) => sum + c.count, 0),
    [activeCategories],
  );

  const segments = useMemo(() => {
    let offset = 0;
    return activeCategories.map((cat, i) => {
      const arcLength = (cat.count / total) * RING_CIRCUMFERENCE;
      const seg = { ...cat, arcLength, offset, index: i };
      offset += arcLength;
      return seg;
    });
  }, [activeCategories, total]);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  if (activeCategories.length === 0) return null;

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.8}
      style={styles.container}
    >
      <View style={styles.ringRow}>
        {/* DNA ring */}
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={colors.border.default}
            strokeWidth={RING_STROKE}
            opacity={0.2}
          />
          {segments.map((seg) => (
            <RingSegment
              key={seg.name}
              color={seg.color}
              arcLength={seg.arcLength}
              offset={seg.offset}
              index={seg.index}
            />
          ))}
        </Svg>

        {/* Marker count in center */}
        <Text style={styles.ringCount}>{total}</Text>
      </View>

      {/* Expanded labels */}
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(120)}
          style={styles.labels}
        >
          {activeCategories.map((cat) => (
            <View key={cat.name} style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={styles.labelText} numberOfLines={1}>
                {titleCase(cat.name)}
              </Text>
              <Text style={styles.labelPct}>
                {Math.round((cat.count / total) * 100)}%
              </Text>
            </View>
          ))}
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(MapLegend);

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 1000,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  ringRow: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCount: {
    position: "absolute",
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
    fontWeight: "700",
  },
  labels: {
    marginTop: spacing.sm,
    gap: 5,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  labelText: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
  },
  labelPct: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    marginLeft: 4,
  },
});
