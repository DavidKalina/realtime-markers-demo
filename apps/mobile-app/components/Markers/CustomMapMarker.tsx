import { Marker } from "@/hooks/useMapWebsocket";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { COLORS } from "../Layout/ScreenLayout";
import {
  MARKER_HEIGHT,
  MARKER_WIDTH,
  MarkerSVG,
  SHADOW_OFFSET,
  ShadowSVG,
} from "./MarkerSVGs";
import { TimePopup } from "./TimePopup";

// Animation configurations
const ANIMATIONS = {
  SCALE_PRESS: {
    duration: 100,
  },
  SCALE_RELEASE: {
    stiffness: 200,
    damping: 12,
  },
  RIPPLE: {
    duration: 800,
  },
  SHADOW: {
    duration: 300,
  },
  FAN_OUT: {
    duration: 800,
    easing: Easing.out(Easing.back(1.2)),
  },
  FAN_IN: {
    duration: 600,
    easing: Easing.in(Easing.back(1.2)),
  },
  PULSE: {
    duration: 1000,
    easing: Easing.inOut(Easing.sin),
  },
  BURST: {
    duration: 400,
    easing: Easing.inOut(Easing.sin),
  },
};

interface EmojiMapMarkerProps {
  event: Marker;
  isSelected: boolean;
  isHighlighted?: boolean;
  onPress: () => void;
  index?: number;
}

export const EmojiMapMarker: React.FC<EmojiMapMarkerProps> = React.memo(
  ({ event, isSelected, onPress, index = 0 }) => {
    const isMountedRef = useRef(true);
    const animationTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const animationIntervalsRef = useRef<Array<ReturnType<typeof setInterval>>>([]);

    // Animation values
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(0.3);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);
    const fanRotation = useSharedValue(0);
    const fanScale = useSharedValue(1);
    const pulseScale = useSharedValue(1);
    const burstScale = useSharedValue(1);

    // Calculate stagger delay based on marker index
    const initialDelay = useMemo(() => index * 200, [index]);

    // Cleanup function for all animations and timers
    const cleanupAnimations = useCallback(() => {
      isMountedRef.current = false;

      cancelAnimation(scale);
      cancelAnimation(shadowOpacity);
      cancelAnimation(rippleScale);
      cancelAnimation(rippleOpacity);
      cancelAnimation(fanRotation);
      cancelAnimation(fanScale);
      cancelAnimation(pulseScale);
      cancelAnimation(burstScale);

      for (const timer of animationTimersRef.current) {
        clearTimeout(timer);
      }
      animationTimersRef.current = [];

      for (const interval of animationIntervalsRef.current) {
        clearInterval(interval);
      }
      animationIntervalsRef.current = [];
    }, []);

    // Track a timeout safely — only schedule if mounted, auto-track for cleanup
    const safeTimeout = useCallback(
      (fn: () => void, delay: number): void => {
        if (!isMountedRef.current) return;
        const timer = setTimeout(() => {
          if (isMountedRef.current) fn();
        }, delay);
        animationTimersRef.current.push(timer);
      },
      [],
    );

    // Initial mount animations
    useEffect(() => {
      isMountedRef.current = true;

      // Shadow fade-in
      shadowOpacity.value = withTiming(0.3, ANIMATIONS.SHADOW);

      // Ripple expanding outward
      rippleScale.value = withTiming(5, ANIMATIONS.RIPPLE);
      rippleOpacity.value = withTiming(0, ANIMATIONS.RIPPLE);

      return cleanupAnimations;
    }, [cleanupAnimations]);

    // Selection state spring
    useEffect(() => {
      if (isSelected) {
        scale.value = withSpring(1.15, ANIMATIONS.SCALE_RELEASE);
      } else {
        scale.value = withSpring(1, ANIMATIONS.SCALE_RELEASE);
      }
    }, [isSelected]);

    // Fan-out/in animation — gentle wobble at randomized intervals
    useEffect(() => {
      const startFanAnimation = () => {
        if (!isMountedRef.current) return;

        fanRotation.value = withSequence(
          withTiming(0.15, ANIMATIONS.FAN_OUT),
          withTiming(-0.15, ANIMATIONS.FAN_OUT),
          withTiming(0, ANIMATIONS.FAN_IN),
        );

        fanScale.value = withSequence(
          withTiming(1.05, ANIMATIONS.FAN_OUT),
          withTiming(1.05, { duration: 200 }),
          withTiming(1, ANIMATIONS.FAN_IN),
        );
      };

      // Staggered start
      safeTimeout(startFanAnimation, initialDelay);

      // Repeat every 4-6s with a random offset
      const fanInterval = setInterval(() => {
        const randomDelay = Math.random() * 2000;
        safeTimeout(startFanAnimation, randomDelay);
      }, 4000 + Math.random() * 2000);
      animationIntervalsRef.current.push(fanInterval);

      return () => {
        clearInterval(fanInterval);
        cancelAnimation(fanRotation);
        cancelAnimation(fanScale);
      };
    }, [initialDelay, safeTimeout]);

    // Gentle breathing pulse
    useEffect(() => {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1500 }),
          withTiming(0.98, { duration: 1500 }),
        ),
        -1,
        true,
      );

      return () => {
        cancelAnimation(pulseScale);
      };
    }, []);

    // Occasional burst pop
    useEffect(() => {
      const burstInterval = setInterval(() => {
        const randomDelay = Math.random() * 2000;
        safeTimeout(() => {
          burstScale.value = withSequence(
            withTiming(1.1, ANIMATIONS.BURST),
            withTiming(1, ANIMATIONS.BURST),
          );
        }, randomDelay);
      }, 8000 + Math.random() * 4000);
      animationIntervalsRef.current.push(burstInterval);

      return () => {
        clearInterval(burstInterval);
        cancelAnimation(burstScale);
      };
    }, [safeTimeout]);

    // Press handler with haptic + burst
    const handlePress = useCallback(() => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      scale.value = withSequence(
        withTiming(0.9, ANIMATIONS.SCALE_PRESS),
        withSpring(isSelected ? 1 : 1.15, ANIMATIONS.SCALE_RELEASE),
      );

      burstScale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      );

      onPress();
    }, [isSelected, onPress]);

    // Composite animated style — all scale/rotation factors multiplied
    const markerStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale:
            scale.value * fanScale.value * pulseScale.value * burstScale.value,
        },
        { rotate: `${fanRotation.value}rad` },
      ],
    }));

    const shadowStyle = useAnimatedStyle(() => ({
      opacity: shadowOpacity.value,
      transform: [
        { translateX: SHADOW_OFFSET.x },
        { translateY: SHADOW_OFFSET.y },
      ],
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      opacity: rippleOpacity.value,
      transform: [{ scale: rippleScale.value }],
      borderColor: "#fff",
    }));

    // Memoized SVGs
    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const MarkerSvg = useMemo(
      () => (
        <MarkerSVG
          fill={event.data.isPrivate ? COLORS.accent : "#1a1a1a"}
          stroke={event.data.isPrivate ? COLORS.accentDark : "white"}
          strokeWidth="3"
          highlightStrokeWidth="2.5"
          circleRadius="12"
          circleStroke={event.data.isPrivate ? COLORS.accentDark : "#E2E8F0"}
          circleStrokeWidth="1"
        />
      ),
      [event.data.isPrivate],
    );

    return (
      <View style={styles.container}>
        {/* Time popup */}
        <Animated.View style={[styles.popupContainer]}>
          <TimePopup
            time={event.data.eventDate || ""}
            endDate={event.data.endDate || ""}
            title={event.data.title || ""}
          />
        </Animated.View>

        {/* Shadow */}
        <Animated.View style={[styles.shadowContainer, shadowStyle]}>
          {ShadowSvg}
        </Animated.View>

        {/* Marker */}
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          style={styles.touchableArea}
        >
          <Animated.View style={[styles.markerContainer, markerStyle]}>
            {MarkerSvg}

            {/* Emoji */}
            <View style={styles.emojiContainer}>
              <Text style={styles.emojiText}>{event.data.emoji}</Text>
            </View>

            {/* Impact ripple */}
            <Animated.View style={[styles.rippleEffect, rippleStyle]} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.event.data.emoji === nextProps.event.data.emoji &&
      prevProps.event.data.title === nextProps.event.data.title
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
  emojiContainer: {
    position: "absolute",
    top: 10,
    width: MARKER_WIDTH,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    padding: 2,
  },
  rippleEffect: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "transparent",
    borderWidth: 2,
    opacity: 0.7,
    bottom: 12,
  },
  popupContainer: {
    position: "absolute",
    width: "100%",
    zIndex: 1,
  },
});
