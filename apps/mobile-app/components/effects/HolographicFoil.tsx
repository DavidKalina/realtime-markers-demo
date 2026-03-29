import React, { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Hash a string (UUID) into a stable float 0..1 */
export function hashString(str: string | undefined): number {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  // Map to 0..1 range
  return Math.abs(h % 10000) / 10000;
}

// --- Shared GLSL helpers ---
const GLSL_HELPERS = `
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`;

const UNIFORM_HEADER = `
uniform float time;
uniform float2 resolution;
uniform float intensity;
uniform float seed;
`;

// --- 1. HOLOGRAPHIC: rainbow iridescent + noise grain ---
const HOLOGRAPHIC_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 137.3, seed * 249.7);

  float n1 = noise(uv * 6.0 + offset + time * 0.5);
  float n2 = noise(uv * 14.0 + offset * 2.0 - time * 0.3);
  float grain = n1 * 0.6 + n2 * 0.4;

  float hue = fract(
    uv.x * 0.8 +
    uv.y * 0.5 +
    seed +
    time * 0.07 +
    grain * 0.3
  );

  float sat = 0.45 + grain * 0.35;
  vec3 color = hsv2rgb(vec3(hue, sat, 1.0));
  float alpha = intensity * (0.5 + grain * 0.5);

  return half4(color * alpha, alpha);
}
`;

// --- 2. SPECKLED: glitter dots scattered across the surface ---
const SPECKLED_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 173.1, seed * 311.7);

  // Grid of potential sparkle cells
  float scale = 40.0;
  vec2 cell = floor(uv * scale);
  vec2 local = fract(uv * scale);

  // Per-cell random — offset by seed so each card has unique sparkle placement
  float rnd = hash(cell + offset);
  float rnd2 = hash(cell + vec2(13.7, 91.1) + offset);
  float rnd3 = hash(cell + vec2(73.1, 37.9) + offset);

  // Only ~30% of cells have a sparkle
  float active = step(0.70, rnd);

  // Sparkle center offset within cell
  vec2 center = vec2(rnd2, rnd3) * 0.6 + 0.2;
  float dist = length(local - center);

  // Sparkle shape: sharp falloff
  float sparkle = smoothstep(0.12, 0.02, dist) * active;

  // Twinkle: each sparkle pulses at its own phase (seed offsets the phase)
  float twinkle = sin(time * (2.0 + rnd * 3.0) + rnd2 * 6.283 + seed * 17.0) * 0.5 + 0.5;
  sparkle *= 0.4 + twinkle * 0.6;

  // Per-sparkle hue
  float hue = fract(rnd * 3.7 + seed + time * 0.05);
  vec3 color = hsv2rgb(vec3(hue, 0.3, 1.0));

  float alpha = sparkle * intensity;
  return half4(color * alpha, alpha);
}
`;

// --- 3. CHROME: smooth metallic mirror reflection ---
const CHROME_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 91.7, seed * 197.3);

  // Warped reflection — seed offsets the warp so each card reflects differently
  float warp1 = noise(uv * 3.0 + offset + vec2(time * 0.2, time * 0.15));
  float warp2 = noise(uv * 5.0 + offset * 1.5 - vec2(time * 0.15, time * 0.25));
  float reflection = warp1 * 0.6 + warp2 * 0.4;

  // Chrome: high value, very low saturation, slight cool tint
  float luminance = 0.3 + reflection * 0.7;
  vec3 color = mix(
    vec3(0.7, 0.75, 0.85),  // cool silver
    vec3(1.0, 1.0, 1.0),     // bright white
    luminance
  );

  // Subtle highlight bands — seed shifts band phase
  float bands = sin(uv.y * 60.0 + reflection * 8.0 + time * 0.5 + seed * 43.0) * 0.5 + 0.5;
  color += bands * 0.15;

  float alpha = intensity * (0.4 + reflection * 0.6);
  return half4(color * alpha, alpha);
}
`;

// --- 4. PRISMATIC: sharp geometric rainbow bands ---
const PRISMATIC_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;

  // Seed shifts band angle and phase
  float angle = 3.0 + seed * 2.0;
  float band = sin((uv.x * angle + uv.y * 5.0 + time * 0.15 + seed * 11.0) * 6.283 * 2.0);
  band = smoothstep(-0.2, 0.2, band);

  // Each band gets a distinct hue — seed offsets the hue wheel
  float hue = fract(
    (uv.x + uv.y) * 0.8 +
    seed +
    time * 0.04
  );

  // Sharper, more saturated than holographic
  vec3 color = hsv2rgb(vec3(hue, 0.7, 1.0));

  // Noise-based shimmer on top
  float shimmer = noise(uv * 20.0 + seed * 100.0 + time * 0.6);

  float alpha = intensity * band * (0.6 + shimmer * 0.4);
  return half4(color * alpha, alpha);
}
`;

// --- 5. EMBER: warm glowing particles drifting upward ---
const EMBER_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;

  // Multiple layers of rising embers
  float glow = 0.0;
  float hueAccum = 0.0;

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float scale = 15.0 + fi * 10.0;
    float speed = 0.3 + fi * 0.15;

    vec2 p = uv * scale;
    p.y -= time * speed;

    vec2 cell = floor(p);
    vec2 local = fract(p);

    // Seed offsets the cell hash so each card has unique ember placement
    float rnd = hash(cell + fi * 100.0 + seed * 371.0);
    float rnd2 = hash(cell + vec2(17.3, 43.7) + fi * 100.0 + seed * 529.0);

    float active = step(0.82, rnd);

    vec2 center = vec2(rnd * 0.6 + 0.2, rnd2 * 0.6 + 0.2);
    float dist = length(local - center);

    // Soft glow falloff
    float ember = smoothstep(0.18, 0.0, dist) * active;

    // Flicker — seed offsets phase
    float flicker = sin(time * (3.0 + rnd * 4.0) + rnd2 * 6.283 + seed * 23.0) * 0.3 + 0.7;
    ember *= flicker;

    glow += ember;
    hueAccum += rnd * ember;
  }

  glow = min(glow, 1.0);

  // Warm hue range: orange to gold
  float hue = 0.05 + (hueAccum / max(glow, 0.001)) * 0.08;
  vec3 color = hsv2rgb(vec3(hue, 0.8, 1.0));

  float alpha = glow * intensity;
  return half4(color * alpha, alpha);
}
`;

// --- Compile all shaders ---
const SHADERS = {
  holographic: Skia.RuntimeEffect.Make(HOLOGRAPHIC_SKSL),
  speckled: Skia.RuntimeEffect.Make(SPECKLED_SKSL),
  chrome: Skia.RuntimeEffect.Make(CHROME_SKSL),
  prismatic: Skia.RuntimeEffect.Make(PRISMATIC_SKSL),
  ember: Skia.RuntimeEffect.Make(EMBER_SKSL),
};

export type FoilVariant = keyof typeof SHADERS;

interface HolographicFoilProps {
  width: number;
  height: number;
  /** Foil opacity/strength — 0.0 (invisible) to ~0.25 (very strong). */
  intensity?: number;
  /** Visual style of the foil effect. Default: "holographic" */
  variant?: FoilVariant;
  /** Unique seed for this card's noise pattern (0..1). Use hashString(uuid). */
  seed?: number;
}

const HolographicFoil: React.FC<HolographicFoilProps> = React.memo(
  ({ width, height, intensity = 0.12, variant = "holographic", seed = 0 }) => {
    const clock = useSharedValue(0);

    useEffect(() => {
      // Ramp to a large value over ~27 hours so it never visibly resets.
      // All shaders use sin/fract/noise which wrap naturally.
      clock.value = 0;
      clock.value = withTiming(100000, {
        duration: 100000 * 1000,
        easing: Easing.linear,
      });
    }, []);

    const uniforms = useDerivedValue(() => ({
      time: clock.value,
      resolution: vec(width, height),
      intensity,
      seed,
    }));

    const source = SHADERS[variant];
    if (!source) return null;

    return (
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill>
          <Shader source={source} uniforms={uniforms} />
        </Fill>
      </Canvas>
    );
  },
);

HolographicFoil.displayName = "HolographicFoil";

export default HolographicFoil;
