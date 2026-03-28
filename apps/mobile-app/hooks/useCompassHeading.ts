import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Magnetometer } from "expo-sensors";
import { useSharedValue, withTiming } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

const UPDATE_INTERVAL_MS = 60;
const SMOOTHING_FACTOR = 0.3;
const TIMING_DURATION_MS = 100;

/**
 * Compute the shortest angular delta between two angles in degrees.
 * Returns a value in [-180, 180].
 */
function shortestAngleDelta(from: number, to: number): number {
  const delta = to - from;
  return Math.atan2(Math.sin((delta * Math.PI) / 180), Math.cos((delta * Math.PI) / 180)) * (180 / Math.PI);
}

/**
 * Compute magnetic heading from raw magnetometer {x, y} data.
 * iOS: x-axis points right, y points up in portrait → heading = atan2(-x, y)
 * Android: same convention via expo-sensors normalization.
 */
function computeHeading(x: number, y: number): number {
  const rad = Math.atan2(-x, y);
  const deg = rad * (180 / Math.PI);
  return ((deg % 360) + 360) % 360;
}

export interface UseCompassHeadingResult {
  heading: SharedValue<number>;
  isAvailable: boolean;
}

/**
 * Hook that subscribes to the device magnetometer and returns a smoothed
 * heading (0-360, 0 = magnetic north) as a Reanimated SharedValue.
 *
 * The shared value is driven via `withTiming` so compass needle animations
 * stay on the UI thread without bridge crossings per sensor tick.
 *
 * @param active  Subscribe only when true (e.g. overlay is visible).
 */
export function useCompassHeading(active: boolean): UseCompassHeadingResult {
  const heading = useSharedValue(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const lastHeading = useRef(0);

  // Check availability once on mount
  useEffect(() => {
    let mounted = true;
    Magnetometer.isAvailableAsync().then((available) => {
      if (mounted) setIsAvailable(available);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe / unsubscribe based on `active`
  useEffect(() => {
    if (!active || !isAvailable) return;

    Magnetometer.setUpdateInterval(UPDATE_INTERVAL_MS);

    const subscription = Magnetometer.addListener(({ x, y }) => {
      const raw = computeHeading(x, y);

      // Low-pass filter using shortest-path angular interpolation
      const delta = shortestAngleDelta(lastHeading.current, raw);
      const smoothed = ((lastHeading.current + SMOOTHING_FACTOR * delta) % 360 + 360) % 360;
      lastHeading.current = smoothed;

      // Drive shared value with short timing for additional UI-thread smoothing
      heading.value = withTiming(smoothed, { duration: TIMING_DURATION_MS });
    });

    return () => {
      subscription.remove();
    };
  }, [active, isAvailable, heading]);

  return { heading, isAvailable };
}
