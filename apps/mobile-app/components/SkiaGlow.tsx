import React, { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const GLOW_SKSL = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float reveal;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;

  float cx = 0.5 + sin(time * 6.2832) * 0.02;
  float cy = 0.38;

  float dx = uv.x - cx;
  float dy = (uv.y - cy) * (resolution.y / resolution.x);
  float dist = sqrt(dx * dx + dy * dy);

  float glow1 = exp(-dist * dist * 4.0);
  float glow2 = exp(-dist * dist * 12.0);
  float glow3 = exp(-dist * dist * 2.0) * 0.25;

  float pulse = 0.85 + 0.15 * sin(time * 6.2832);

  vec3 blue = vec3(0.3, 0.67, 0.97);
  vec3 cyan = vec3(0.4, 0.9, 0.85);
  vec3 warm = vec3(0.52, 0.38, 0.85);

  vec3 col = blue * glow1 + cyan * glow2 * 0.5 + warm * glow3;
  col *= pulse;

  float alpha = (glow1 * 0.25 + glow2 * 0.15 + glow3 * 0.08) * pulse * reveal;

  return half4(col * alpha, alpha);
}
`);

export const SkiaGlow: React.FC<{ revealDelay?: number }> = React.memo(
  ({ revealDelay = 300 }) => {
    const { width, height } = useWindowDimensions();
    const time = useSharedValue(0);
    const reveal = useSharedValue(0);

    useEffect(() => {
      reveal.value = withDelay(
        revealDelay,
        withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      );
      time.value = withDelay(
        revealDelay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        ),
      );
    }, []);

    const uniforms = useDerivedValue(() => ({
      resolution: vec(width, height),
      time: time.value,
      reveal: reveal.value,
    }));

    if (!GLOW_SKSL) return null;

    return (
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill>
          <Shader source={GLOW_SKSL} uniforms={uniforms} />
        </Fill>
      </Canvas>
    );
  },
);

SkiaGlow.displayName = "SkiaGlow";
