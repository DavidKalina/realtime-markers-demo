import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  MARKER_HEIGHT,
  MARKER_WIDTH,
  MarkerSVG,
  ShadowSVG,
} from "../MarkerSVGs";
import { colors, fontFamily, lineHeight } from "@/theme";
import { getCategoryColorScheme } from "@/utils/categoryColors";
import { COLOR_SCHEMES, ANIMATIONS } from "./constants";
import { useClusterAnimations } from "./useClusterAnimations";

interface ClusterMarkerProps {
  count: number;
  coordinates: [number, number];
  onPress: () => void;
  isSelected?: boolean;
  isHighlighted?: boolean;
  index?: number;
  dominantCategory?: string;
}

export const ClusterMarker: React.FC<ClusterMarkerProps> = React.memo(
  ({ count, onPress, isSelected = false, dominantCategory }) => {
    const { scale, markerStyle, shadowStyle, rippleStyle } =
      useClusterAnimations(count, isSelected);

    // Memoize color scheme: category-based when available, else size-based fallback
    const colorScheme = useMemo(() => {
      if (dominantCategory) {
        return getCategoryColorScheme(dominantCategory);
      }
      if (count < 5) return COLOR_SCHEMES.small;
      if (count < 15) return COLOR_SCHEMES.medium;
      return COLOR_SCHEMES.large;
    }, [count, dominantCategory]);

    // Memoize formatted count
    const formattedCount = useMemo(
      () => (count > 99 ? "99+" : count.toString()),
      [count],
    );

    // Use shared SVG components
    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const MarkerSvg = useMemo(
      () => (
        <MarkerSVG
          fill={colorScheme.fill}
          stroke={colorScheme.stroke}
          strokeWidth={count > 5 ? "4" : "3"}
          highlightStrokeWidth={count > 5 ? "3" : "2.5"}
          circleRadius={count > 5 ? "14" : "12"}
          circleStroke={colorScheme.circleStroke}
          circleStrokeWidth={count > 15 ? "2" : "1"}
        />
      ),
      [colorScheme, count],
    );

    // Handle press with haptic feedback
    const handlePress = useCallback(() => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(
          isSelected
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => {});
      }

      scale.value = withSequence(
        withTiming(0.9, ANIMATIONS.SCALE_PRESS),
        withSpring(isSelected ? 1 : 1.15, ANIMATIONS.SCALE_RELEASE),
      );

      onPress();
    }, [isSelected, onPress, scale]);

    return (
      <View style={styles.container}>
        <Animated.View style={[styles.shadowContainer, shadowStyle]}>
          {ShadowSvg}
        </Animated.View>

        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          style={styles.touchableArea}
        >
          <Animated.View style={[styles.markerContainer, markerStyle]}>
            {MarkerSvg}

            <View style={styles.countContainer}>
              <Text
                style={[
                  styles.countText,
                  {
                    fontSize: count > 99 ? 14 : count > 9 ? 16 : 18,
                    color: colorScheme.text,
                  },
                ]}
              >
                {formattedCount}
              </Text>
            </View>

            <Animated.View style={[styles.rippleEffect, rippleStyle]} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.count === nextProps.count &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.coordinates[0] === nextProps.coordinates[0] &&
      prevProps.coordinates[1] === nextProps.coordinates[1] &&
      prevProps.dominantCategory === nextProps.dominantCategory
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  touchableArea: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  markerContainer: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  shadowContainer: {
    position: "absolute",
    bottom: 0,
    zIndex: -1,
  },
  countContainer: {
    position: "absolute",
    top: 12,
    width: MARKER_WIDTH,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontWeight: "bold",
    fontFamily: fontFamily.mono,
    textAlign: "center",
    lineHeight: lineHeight.loose,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow.light,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 1,
      },
      android: {
        textShadowColor: colors.shadow.light,
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
    }),
  },
  rippleEffect: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.fixed.transparent,
    borderWidth: 2,
    borderColor: colors.fixed.white,
    opacity: 0.7,
    bottom: 12,
  },
});
