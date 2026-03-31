import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  debugOverride: boolean;
  setDebugOverride: (v: boolean) => void;
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
  const [debugOverride, setDebugOverride] = useState(false);
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
    if (!active || !isAvailable || debugOverride) return;

    // Reset baseline so the first reading becomes "neutral"
    baseX.current = null;
    baseY.current = null;
    lastX.current = 0;
    lastY.current = 0;

    DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);

    const sub = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;

      if (__DEV__) {
        console.log(
          "[GyroTilt] raw beta:",
          rotation.beta.toFixed(4),
          "gamma:",
          rotation.gamma.toFixed(4),
        );
      }

      // expo-sensors 55+ returns rotation in degrees (not radians)
      const absX = rotation.beta;
      const absY = rotation.gamma;

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
  }, [active, isAvailable, debugOverride, tiltX, tiltY]);

  return { tiltX, tiltY, isAvailable, debugOverride, setDebugOverride };
}

// ── Debug panel (only rendered in __DEV__) ────────────────────────────

export interface GyroTiltDebugPanelProps {
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  debugOverride: boolean;
  setDebugOverride: (v: boolean) => void;
}

const DebugSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
}> = ({ value, min, max, onValueChange }) => {
  const trackWidth = useRef(1);
  const layoutXRef = useRef(0);
  const cbRef = useRef(onValueChange);
  cbRef.current = onValueChange;

  const toValue = useCallback(
    (pageX: number) => {
      const ratio = Math.max(
        0,
        Math.min(1, (pageX - layoutXRef.current) / trackWidth.current),
      );
      return min + ratio * (max - min);
    },
    [min, max],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        cbRef.current(toValue(e.nativeEvent.pageX));
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        cbRef.current(toValue(e.nativeEvent.pageX));
      },
    }),
  ).current;

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <View
      style={debugStyles.track}
      onLayout={(e) => {
        trackWidth.current = e.nativeEvent.layout.width;
      }}
      ref={(ref) => {
        ref?.measureInWindow((x) => {
          layoutXRef.current = x;
        });
      }}
      {...panResponder.panHandlers}
    >
      <View style={[debugStyles.trackFill, { width: `${pct}%` }]} />
      <View style={[debugStyles.thumb, { left: `${pct}%` }]} />
    </View>
  );
};

export const GyroTiltDebugPanel: React.FC<GyroTiltDebugPanelProps> = __DEV__
  ? ({ tiltX, tiltY, debugOverride, setDebugOverride }) => {
      const [localX, setLocalX] = useState(0);
      const [localY, setLocalY] = useState(0);

      const onToggle = useCallback(() => {
        const next = !debugOverride;
        setDebugOverride(next);
        if (!next) {
          tiltX.value = withTiming(0, { duration: 200 });
          tiltY.value = withTiming(0, { duration: 200 });
          setLocalX(0);
          setLocalY(0);
        }
      }, [debugOverride, setDebugOverride, tiltX, tiltY]);

      const onChangeX = useCallback(
        (v: number) => {
          setLocalX(v);
          tiltX.value = v;
        },
        [tiltX],
      );

      const onChangeY = useCallback(
        (v: number) => {
          setLocalY(v);
          tiltY.value = v;
        },
        [tiltY],
      );

      return (
        <View style={debugStyles.container}>
          <Pressable onPress={onToggle} style={debugStyles.toggle}>
            <Text style={debugStyles.toggleText}>
              {debugOverride ? "GYRO: MANUAL" : "GYRO: SENSOR"}
            </Text>
          </Pressable>
          {debugOverride && (
            <View style={debugStyles.sliders}>
              <View style={debugStyles.row}>
                <Text style={debugStyles.label}>
                  PITCH {localX.toFixed(1)}°
                </Text>
                <DebugSlider
                  value={localX}
                  min={-MAX_DEG}
                  max={MAX_DEG}
                  onValueChange={onChangeX}
                />
              </View>
              <View style={debugStyles.row}>
                <Text style={debugStyles.label}>
                  ROLL {"  "}
                  {localY.toFixed(1)}°
                </Text>
                <DebugSlider
                  value={localY}
                  min={-MAX_DEG}
                  max={MAX_DEG}
                  onValueChange={onChangeY}
                />
              </View>
            </View>
          )}
        </View>
      );
    }
  : () => null;

const debugStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 100,
  },
  toggle: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.4)",
  },
  toggleText: {
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
    color: "#86efac",
    letterSpacing: 1,
  },
  sliders: {
    marginTop: 6,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.8,
    width: 80,
  },
  track: {
    flex: 1,
    height: 28,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#86efac",
  },
  thumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#86efac",
    marginLeft: -8,
    top: 6,
  },
});
