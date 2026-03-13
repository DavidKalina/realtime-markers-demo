import React, { useCallback, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import MapboxGL from "@rnmapbox/maps";
import {
  useAnchorPlanStore,
  type AnchorStop,
} from "@/stores/useAnchorPlanStore";
import { fontSize, lineHeight, spacing, spring, useColors } from "@/theme";
import {
  MARKER_HEIGHT,
  MARKER_WIDTH,
  MarkerSVG,
  SHADOW_OFFSET,
  ShadowSVG,
} from "./MarkerSVGs";

const ANCHOR = { x: 0.5, y: 1 };

/* ── Single anchor pin ──────────────────────────────────── */

const AnchorPin = React.memo(
  ({ anchor, index }: { anchor: AnchorStop; index: number }) => {
    const colors = useColors();
    const removeAnchor = useAnchorPlanStore((s) => s.removeAnchor);
    const setPendingAnchor = useAnchorPlanStore((s) => s.setPendingAnchor);

    const scale = useSharedValue(0);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);

    // Pop-in animation on mount
    useEffect(() => {
      scale.value = withSpring(1, spring.bouncy);
      rippleScale.value = withTiming(5, { duration: 800 });
      rippleOpacity.value = withTiming(0, { duration: 800 });

      return () => {
        cancelAnimation(scale);
        cancelAnimation(rippleScale);
        cancelAnimation(rippleOpacity);
      };
    }, []);

    const markerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      opacity: rippleOpacity.value,
      transform: [{ scale: rippleScale.value }],
      borderColor: colors.fixed.white,
    }));

    // Tap → re-open nearby picker to edit this anchor
    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setPendingAnchor(anchor.id);
    }, [anchor.id, setPendingAnchor]);

    // Long press → remove anchor
    const handleLongPress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      scale.value = withSequence(
        withTiming(0.85, { duration: 100 }),
        withSpring(0, spring.bouncy),
      );
      setTimeout(() => removeAnchor(anchor.id), 250);
    }, [anchor.id, removeAnchor, scale]);

    return (
      <MapboxGL.MarkerView coordinate={anchor.coordinates} anchor={ANCHOR}>
        <View style={styles.container}>
          {/* Shadow */}
          <View style={[styles.shadowContainer, staticShadowStyle]}>
            <ShadowSVG />
          </View>

          {/* Marker */}
          <TouchableOpacity
            onPress={handlePress}
            onLongPress={handleLongPress}
            delayLongPress={400}
            activeOpacity={0.7}
            style={styles.touchableArea}
          >
            <Animated.View style={[styles.markerContainer, markerStyle]}>
              <MarkerSVG
                fill={colors.accent.primary}
                stroke={colors.accent.dark}
                strokeWidth="3"
                highlightStrokeWidth="2.5"
                circleRadius="12"
                circleStroke={colors.accent.dark}
                circleStrokeWidth="1"
              />

              {/* Number label */}
              <View style={styles.emojiContainer}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>

              {/* Impact ripple */}
              <Animated.View style={[styles.rippleEffect, rippleStyle]} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </MapboxGL.MarkerView>
    );
  },
);

/* ── Container ──────────────────────────────────────────── */

export default function AnchorMarkers() {
  const anchors = useAnchorPlanStore((s) => s.anchors);

  if (anchors.length === 0) return null;

  return (
    <>
      {anchors.map((anchor, idx) => (
        <AnchorPin key={anchor.id} anchor={anchor} index={idx} />
      ))}
    </>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const staticShadowStyle = {
  opacity: 0.3,
  transform: [{ translateX: SHADOW_OFFSET.x }, { translateY: SHADOW_OFFSET.y }],
};

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
  emojiContainer: {
    position: "absolute",
    top: spacing._10,
    width: MARKER_WIDTH,
    height: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.tight,
    textAlign: "center",
    fontWeight: "800",
    color: "#FFFFFF",
  },
  rippleEffect: {
    position: "absolute",
    width: spacing._10,
    height: spacing._10,
    borderRadius: 5,
    backgroundColor: "transparent",
    borderWidth: 2,
    opacity: 0.7,
    bottom: spacing.md,
  },
});
