import { useEffect, useRef } from "react";
import { DeviceMotion } from "expo-sensors";
import {
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { spring } from "@/theme";

const CLAMP_DEG = 15;
const UPDATE_INTERVAL = 16; // ~60fps

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function radToDeg(rad: number): number {
  "worklet";
  return (rad * 180) / Math.PI;
}

interface DeviceMotionTiltResult {
  rotateX: SharedValue<number>;
  rotateY: SharedValue<number>;
  sheenTranslateX: SharedValue<number>;
}

export function useDeviceMotionTilt(active: boolean): DeviceMotionTiltResult {
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const sheenTranslateX = useSharedValue(0);
  const isAvailable = useRef<boolean | null>(null);
  const baselineRef = useRef<{ pitch: number; roll: number } | null>(null);

  useEffect(() => {
    if (!active) {
      rotateX.value = withSpring(0, spring.snappy);
      rotateY.value = withSpring(0, spring.snappy);
      sheenTranslateX.value = withSpring(0, spring.snappy);
      baselineRef.current = null;
      return;
    }

    let subscription: ReturnType<typeof DeviceMotion.addListener> | null = null;

    const start = async () => {
      if (isAvailable.current === null) {
        isAvailable.current = await DeviceMotion.isAvailableAsync();
      }
      if (!isAvailable.current) return;

      DeviceMotion.setUpdateInterval(UPDATE_INTERVAL);

      subscription = DeviceMotion.addListener((data) => {
        if (!data.rotation) return;

        const rawPitch = radToDeg(data.rotation.beta);
        const rawRoll = radToDeg(data.rotation.gamma);

        // Capture the first reading as the baseline so tilt is relative
        // to whatever orientation the device started in.
        if (baselineRef.current === null) {
          baselineRef.current = { pitch: rawPitch, roll: rawRoll };
        }

        const pitch = clamp(
          rawPitch - baselineRef.current.pitch,
          -CLAMP_DEG,
          CLAMP_DEG,
        );
        const roll = clamp(
          rawRoll - baselineRef.current.roll,
          -CLAMP_DEG,
          CLAMP_DEG,
        );

        rotateX.value = withSpring(pitch, spring.snappy);
        rotateY.value = withSpring(roll, spring.snappy);
        sheenTranslateX.value = withSpring(roll, spring.snappy);
      });
    };

    start();

    return () => {
      subscription?.remove();
    };
  }, [active, rotateX, rotateY, sheenTranslateX]);

  return { rotateX, rotateY, sheenTranslateX };
}
