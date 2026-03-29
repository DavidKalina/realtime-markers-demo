import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Skia-based diagonal sheen sweep.
 *
 * A soft, glowing band sweeps corner-to-corner across the card.
 * Driven by `progress` (0→1). Fires on mount (staggered) and
 * on each `sheenTrigger` bump (swipe snap).
 */

const SHEEN_SKSL = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float progress;   // 0..1 sweep position
uniform float colorR;
uniform float colorG;
uniform float colorB;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;

  // Diagonal axis: bottom-left → top-right
  float diag = uv.x + (1.0 - uv.y);  // 0..2

  // Map progress to a sweep center along the diagonal
  float center = progress * 2.4 - 0.2; // overshoot slightly for clean entry/exit

  float dist = abs(diag - center);

  // Soft gaussian-ish falloff — narrow bright core + wide dim halo
  float core = exp(-dist * dist * 60.0);  // tight bright band
  float halo = exp(-dist * dist * 8.0);   // wider soft glow

  float band = core * 0.7 + halo * 0.3;

  // Fade in/out at edges of sweep
  float edgeFade = smoothstep(0.0, 0.15, progress) * smoothstep(1.0, 0.85, progress);
  band *= edgeFade;

  // Tint with tier color, boost to white at the core
  vec3 color = vec3(colorR, colorG, colorB);
  vec3 col = mix(color, vec3(1.0), core * 0.6);

  float alpha = band * 0.25;
  return half4(col * alpha, alpha);
}
`);

interface CardSheenProps {
  width: number;
  height: number;
  /** Tier color as hex string (#rrggbb) */
  tierColor: string;
  /** Shared value that increments on each swipe snap */
  sheenTrigger: SharedValue<number>;
  /** Card index for staggering */
  index: number;
}

/** Parse #rrggbb into [r, g, b] floats 0..1 */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

const CardSheen: React.FC<CardSheenProps> = React.memo(
  ({ width, height, tierColor, sheenTrigger, index }) => {
    const progress = useSharedValue(0);
    const lastTrigger = useSharedValue(-1);
    const rgb = hexToRgb(tierColor);

    // Fire on mount (staggered)
    useEffect(() => {
      progress.value = withDelay(
        300 + index * 400,
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      );
    }, [index]);

    const uniforms = useDerivedValue(() => {
      // Detect new trigger (swipe snap)
      if (sheenTrigger.value !== lastTrigger.value) {
        lastTrigger.value = sheenTrigger.value;
        if (sheenTrigger.value > 0) {
          progress.value = 0;
          progress.value = withDelay(
            index * 150,
            withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          );
        }
      }

      return {
        resolution: vec(width, height),
        progress: progress.value,
        colorR: rgb[0],
        colorG: rgb[1],
        colorB: rgb[2],
      };
    });

    if (!SHEEN_SKSL) return null;

    return (
      <Canvas
        style={[StyleSheet.absoluteFill, { zIndex: 5 }]}
        pointerEvents="none"
      >
        <Fill>
          <Shader source={SHEEN_SKSL} uniforms={uniforms} />
        </Fill>
      </Canvas>
    );
  },
);

CardSheen.displayName = "CardSheen";

export default CardSheen;
