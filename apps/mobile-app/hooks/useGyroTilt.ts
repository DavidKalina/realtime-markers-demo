import { useEffect, useRef, useState } from "react";
import { DeviceMotion } from "expo-sensors";
import { useSharedValue, withTiming } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

const UPDATE_INTERVAL_MS = 32;
const SMOOTHING = 0.25;
const TIMING_MS = 60;
/** Clamp tilt to ±MAX_DEG so the card doesn't go crazy. */
const MAX_DEG = 18;

export interface UseGyroTiltResult {
  tiltX: SharedValue<number>; // pitch — tilt forward/back (degrees, ±MAX_DEG)
  tiltY: SharedValue<number>; // roll  — tilt left/right  (degrees, ±MAX_DEG)
  isAvailable: boolean;
}

function clamp(v: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, v));
}

/**
 * Hook that subscribes to DeviceMotion and returns smoothed tilt angles
 * as Reanimated SharedValues suitable for driving 3D card perspective.
 *
 * @param active  Subscribe only when true (e.g. inspect overlay is open).
 */
export function useGyroTilt(active: boolean): UseGyroTiltResult {
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  // Baseline: the device orientation when the overlay opened
  const baseX = useRef<number | null>(null);
  const baseY = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    DeviceMotion.isAvailableAsync().then((ok) => {
      if (mounted) setIsAvailable(ok);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active || !isAvailable) return;

    // Reset baseline so the first reading becomes "neutral"
    baseX.current = null;
    baseY.current = null;
    lastX.current = 0;
    lastY.current = 0;

    DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);

    const sub = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;

      const absX = (rotation.beta * 180) / Math.PI;
      const absY = (rotation.gamma * 180) / Math.PI;

      // Capture first reading as the zero-point
      if (baseX.current === null) {
        baseX.current = absX;
        baseY.current = absY;
        return;
      }

      // Relative to where the user was holding the phone when they opened inspect
      const rawX = clamp(absX - baseX.current, -MAX_DEG, MAX_DEG);
      const rawY = clamp(absY - (baseY.current ?? 0), -MAX_DEG, MAX_DEG);

      // Low-pass filter
      lastX.current += SMOOTHING * (rawX - lastX.current);
      lastY.current += SMOOTHING * (rawY - lastY.current);

      tiltX.value = withTiming(lastX.current, { duration: TIMING_MS });
      tiltY.value = withTiming(lastY.current, { duration: TIMING_MS });
    });

    return () => {
      sub.remove();
      tiltX.value = withTiming(0, { duration: 200 });
      tiltY.value = withTiming(0, { duration: 200 });
    };
  }, [active, isAvailable, tiltX, tiltY]);

  return { tiltX, tiltY, isAvailable };
}
