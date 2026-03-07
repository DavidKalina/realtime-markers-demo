import React, { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { useColors, type Colors } from "@/theme";

interface MapRippleEffectProps {
  isVisible: boolean;
  position: {
    x: number;
    y: number;
  };
  onAnimationComplete?: () => void;
  zoomLevel?: number;
}

const RING_COUNT = 3;
const RING_SIZE = 140;
const RING_DELAY = 300;
const RING_DURATION = 1200;
const DEFAULT_PEAK_SCALE = 2.0;
const RING_OPACITIES = [0.8, 0.6, 0.4];

function getPeakScaleForZoom(zoom?: number): number {
  if (zoom == null) return DEFAULT_PEAK_SCALE;
  if (zoom >= 15) return 1.5;
  if (zoom >= 12) return 2.0;
  if (zoom >= 10) return 2.5;
  return 3.0;
}

// Custom comparison function for React.memo
const arePropsEqual = (
  prevProps: MapRippleEffectProps,
  nextProps: MapRippleEffectProps,
): boolean => {
  if (prevProps.isVisible !== nextProps.isVisible) return false;
  if (!nextProps.isVisible) return true;
  if (
    prevProps.position.x !== nextProps.position.x ||
    prevProps.position.y !== nextProps.position.y
  )
    return false;
  if (prevProps.onAnimationComplete !== nextProps.onAnimationComplete)
    return false;
  if (prevProps.zoomLevel !== nextProps.zoomLevel) return false;
  return true;
};

const MapRippleEffectComponent: React.FC<MapRippleEffectProps> = ({
  isVisible,
  position,
  onAnimationComplete,
  zoomLevel,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Hooks must be called at top level — one pair per ring
  const scale0 = useSharedValue(0);
  const opacity0 = useSharedValue(0);
  const scale1 = useSharedValue(0);
  const opacity1 = useSharedValue(0);
  const scale2 = useSharedValue(0);
  const opacity2 = useSharedValue(0);

  const rings = useMemo(
    () => [
      { scale: scale0, opacity: opacity0 },
      { scale: scale1, opacity: opacity1 },
      { scale: scale2, opacity: opacity2 },
    ],
    [scale0, opacity0, scale1, opacity1, scale2, opacity2],
  );

  const handleAnimationComplete = () => {
    "worklet";
    if (onAnimationComplete) {
      scheduleOnRN(onAnimationComplete);
    }
  };

  useEffect(() => {
    if (isVisible) {
      const easing = Easing.out(Easing.cubic);
      const peakScale = getPeakScaleForZoom(zoomLevel);

      rings.forEach((ring, i) => {
        ring.scale.value = 0;
        ring.opacity.value = 0;

        const delay = i * RING_DELAY;
        const isLast = i === RING_COUNT - 1;

        ring.scale.value = withDelay(
          delay,
          withTiming(peakScale, { duration: RING_DURATION, easing }),
        );

        ring.opacity.value = withDelay(
          delay,
          withSequence(
            withTiming(RING_OPACITIES[i], { duration: 100 }),
            withTiming(
              0,
              { duration: RING_DURATION - 100 },
              isLast ? handleAnimationComplete : undefined,
            ),
          ),
        );
      });
    }

    return () => {
      rings.forEach((ring) => {
        cancelAnimation(ring.scale);
        cancelAnimation(ring.opacity);
      });
    };
  }, [isVisible]);

  // Animated styles for each ring
  const ringStyle0 = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ scale: scale0.value }],
      opacity: opacity0.value,
    };
  });

  const ringStyle1 = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ scale: scale1.value }],
      opacity: opacity1.value,
    };
  });

  const ringStyle2 = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ scale: scale2.value }],
      opacity: opacity2.value,
    };
  });

  const ringStyles = [ringStyle0, ringStyle1, ringStyle2];

  if (!isVisible) return null;

  const half = RING_SIZE / 2;

  return (
    <>
      {ringStyles.map((style, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            style,
            {
              left: position.x - half,
              top: position.y - half,
            },
          ]}
        />
      ))}
    </>
  );
};

// Export the memoized component
export const MapRippleEffect = React.memo(
  MapRippleEffectComponent,
  arePropsEqual,
);

const createStyles = (colors: Colors) => StyleSheet.create({
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: colors.accent.primary,
  },
});
