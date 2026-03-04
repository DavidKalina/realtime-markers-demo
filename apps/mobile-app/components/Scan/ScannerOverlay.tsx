import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { DeviceMotion } from "expo-sensors";
import { colors, fontFamily, fontSize } from "@/theme";

// --- Constants ---

const BRACKET_INSET = 40;
const BRACKET_ARM = 40;
const BRACKET_THICKNESS = 2;
const SCAN_LINE_DURATION = 3000;
const MOTION_INTERVAL = 32; // ~30fps
const JITTER_WINDOW = 10;
const JITTER_THRESHOLD = 1.2; // degrees — below this = "steady"
const STABLE_COLOR = colors.status.success.text; // #10b981

// --- Motion hook ---

function useScannerMotion(active: boolean) {
  const stableProgress = useSharedValue(0);
  const [isStable, setIsStable] = useState(false);
  const isAvailable = useRef<boolean | null>(null);
  const samplesRef = useRef<{ pitch: number; roll: number }[]>([]);

  useEffect(() => {
    if (!active) {
      stableProgress.value = withTiming(0, { duration: 300 });
      setIsStable(false);
      samplesRef.current = [];
      return;
    }

    let subscription: ReturnType<typeof DeviceMotion.addListener> | null = null;

    const start = async () => {
      if (isAvailable.current === null) {
        isAvailable.current = await DeviceMotion.isAvailableAsync();
      }
      if (!isAvailable.current) return;

      DeviceMotion.setUpdateInterval(MOTION_INTERVAL);

      subscription = DeviceMotion.addListener((data) => {
        if (!data.rotation) return;

        const pitch = (data.rotation.beta * 180) / Math.PI;
        const roll = (data.rotation.gamma * 180) / Math.PI;

        const samples = samplesRef.current;
        samples.push({ pitch, roll });
        if (samples.length > JITTER_WINDOW) {
          samples.shift();
        }
        if (samples.length < JITTER_WINDOW) return;

        // Compute jitter as max delta across the window
        let maxDeltaPitch = 0;
        let maxDeltaRoll = 0;
        for (let i = 1; i < samples.length; i++) {
          maxDeltaPitch = Math.max(
            maxDeltaPitch,
            Math.abs(samples[i].pitch - samples[i - 1].pitch),
          );
          maxDeltaRoll = Math.max(
            maxDeltaRoll,
            Math.abs(samples[i].roll - samples[i - 1].roll),
          );
        }

        const jitter = Math.max(maxDeltaPitch, maxDeltaRoll);
        const stable = jitter < JITTER_THRESHOLD;

        stableProgress.value = withTiming(stable ? 1 : 0, { duration: 300 });
        setIsStable(stable);
      });
    };

    start();

    return () => {
      subscription?.remove();
    };
  }, [active, stableProgress]);

  return { stableProgress, isStable };
}

// --- Component ---

interface ScannerOverlayProps {
  active: boolean;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({ active }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isMounted = useRef(true);

  // Shared values
  const cornerScale = useSharedValue(1);
  const scanLineY = useSharedValue(0);
  const hintOpacity = useSharedValue(0);

  // Motion
  const { stableProgress, isStable } = useScannerMotion(active);

  // Layout — bracket area centered, leaving room for bottom controls (~180px)
  const controlsHeight = 180;
  const areaTop = BRACKET_INSET;
  const areaBottom = screenHeight - controlsHeight - BRACKET_INSET;
  const areaHeight = areaBottom - areaTop;
  const areaLeft = BRACKET_INSET;
  const areaRight = screenWidth - BRACKET_INSET;

  const cleanupAnimations = () => {
    cancelAnimation(cornerScale);
    cancelAnimation(scanLineY);
    cancelAnimation(hintOpacity);
    cancelAnimation(stableProgress);
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isMounted.current) return;

    cleanupAnimations();

    if (!active) {
      cornerScale.value = withTiming(1, { duration: 200 });
      scanLineY.value = 0;
      hintOpacity.value = withTiming(0, { duration: 200 });
      return cleanupAnimations;
    }

    // Breathing pulse on corners
    cornerScale.value = withRepeat(
      withTiming(1.02, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );

    // Scan line sweep
    scanLineY.value = 0;
    scanLineY.value = withRepeat(
      withTiming(areaHeight, {
        duration: SCAN_LINE_DURATION,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );

    // Hint fade in
    hintOpacity.value = withTiming(1, { duration: 500 });

    return cleanupAnimations;
  }, [active, areaHeight]); // cornerScale, scanLineY, hintOpacity are stable refs

  // --- Animated styles ---

  const cornerAnimatedStyle = useAnimatedStyle(() => {
    // When stable, tighten inward (0.97); idle pulse drives scale
    const stableScale = 1 - stableProgress.value * 0.03; // 1.0 → 0.97
    return {
      transform: [{ scale: cornerScale.value * stableScale }],
    };
  });

  const cornerColorStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      stableProgress.value,
      [0, 1],
      [colors.fixed.white, STABLE_COLOR],
    );
    return { borderColor: color };
  });

  const scanLineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: scanLineY.value }],
      opacity: active ? 0.3 : 0,
    };
  });

  const hintTextStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      stableProgress.value,
      [0, 1],
      [colors.fixed.white, STABLE_COLOR],
    );
    return {
      opacity: hintOpacity.value,
      color,
    };
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Corner brackets container */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: areaTop,
            left: areaLeft,
            right: screenWidth - areaRight,
            height: areaHeight,
          },
          cornerAnimatedStyle,
        ]}
      >
        {/* Top-left corner */}
        <Animated.View style={[styles.cornerTL, cornerColorStyle]} />
        {/* Top-right corner */}
        <Animated.View style={[styles.cornerTR, cornerColorStyle]} />
        {/* Bottom-left corner */}
        <Animated.View style={[styles.cornerBL, cornerColorStyle]} />
        {/* Bottom-right corner */}
        <Animated.View style={[styles.cornerBR, cornerColorStyle]} />

        {/* Scan line */}
        <Animated.View style={[styles.scanLine, scanLineStyle]} />
      </Animated.View>

      {/* Hint text */}
      <Animated.Text
        style={[styles.hintText, { top: areaBottom + 16 }, hintTextStyle]}
      >
        {isStable ? "Ready" : "Hold steady over flyer"}
      </Animated.Text>
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: BRACKET_ARM,
    height: BRACKET_ARM,
    borderTopWidth: BRACKET_THICKNESS,
    borderLeftWidth: BRACKET_THICKNESS,
    borderColor: colors.fixed.white,
  },
  cornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: BRACKET_ARM,
    height: BRACKET_ARM,
    borderTopWidth: BRACKET_THICKNESS,
    borderRightWidth: BRACKET_THICKNESS,
    borderColor: colors.fixed.white,
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: BRACKET_ARM,
    height: BRACKET_ARM,
    borderBottomWidth: BRACKET_THICKNESS,
    borderLeftWidth: BRACKET_THICKNESS,
    borderColor: colors.fixed.white,
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: BRACKET_ARM,
    height: BRACKET_ARM,
    borderBottomWidth: BRACKET_THICKNESS,
    borderRightWidth: BRACKET_THICKNESS,
    borderColor: colors.fixed.white,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.fixed.white,
  },
  hintText: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: colors.fixed.white,
  },
});
