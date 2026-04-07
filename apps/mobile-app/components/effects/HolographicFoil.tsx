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

  float sat = 0.35 + grain * 0.25;
  vec3 color = hsv2rgb(vec3(hue, sat, 1.0));
  float alpha = intensity * (0.4 + grain * 0.4);

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
  vec3 color = hsv2rgb(vec3(hue, 0.25, 1.0));

  float alpha = sparkle * intensity * 0.85;
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
  color += bands * 0.10;

  float alpha = intensity * (0.3 + reflection * 0.5);
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

  // Softer prismatic bands
  vec3 color = hsv2rgb(vec3(hue, 0.45, 1.0));

  // Noise-based shimmer on top
  float shimmer = noise(uv * 20.0 + seed * 100.0 + time * 0.6);

  float alpha = intensity * band * (0.4 + shimmer * 0.35);
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

  // Warm hue range per-card: seed picks a base from red/orange/gold/pink
  // seed 0..1 maps to hue anchors: 0.0 (red), 0.05 (orange), 0.10 (gold), 0.95 (pink)
  float baseHue = fract(seed * 4.7);
  // Clamp to warm region: allow 0.0–0.12 (red→gold) and 0.9–1.0 (pink/magenta)
  baseHue = baseHue < 0.5
    ? baseHue * 0.24            // 0..0.12
    : 0.90 + (baseHue - 0.5) * 0.2; // 0.90..1.0
  float hue = baseHue + (hueAccum / max(glow, 0.001)) * 0.06;
  vec3 color = hsv2rgb(vec3(hue, 0.6, 1.0));

  float alpha = glow * intensity * 0.85;
  return half4(color * alpha, alpha);
}
`;

// --- 6. AURORA: completed-tier — layered curtains of color that drift and pulse ---
const AURORA_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 197.3, seed * 311.1);

  float glow = 0.0;
  float hueSum = 0.0;

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float phase = seed * 17.0 + fi * 1.57;
    float wave = sin(uv.x * (3.0 + fi * 2.0) + time * (0.1 + fi * 0.05) + phase);
    wave += noise(uv * (4.0 + fi * 3.0) + offset + time * 0.08) * 0.5;

    float band = smoothstep(0.0, 0.4, 1.0 - abs(uv.y - (0.3 + wave * 0.25)));
    band *= 0.5 + 0.5 * sin(time * (0.3 + fi * 0.2) + fi * 2.0 + seed * 7.0);

    glow += band * (0.4 - fi * 0.06);
    hueSum += (fi * 0.15 + seed) * band;
  }

  glow = min(glow, 1.2);
  float hue = fract(hueSum / max(glow, 0.01) + time * 0.02 + seed);
  vec3 color = hsv2rgb(vec3(hue, 0.5, 1.0));

  float alpha = glow * intensity;
  return half4(color * alpha, alpha);
}
`;

// --- 7. STARDUST: gentle twinkling field with soft color drift ---
const STARDUST_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;

  float glow = 0.0;
  float hueAccum = 0.0;

  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float scale = 20.0 + fl * 12.0;
    float drift = time * (0.03 + fl * 0.02);

    vec2 p = uv * scale + vec2(drift, -drift * 0.7);
    vec2 cell = floor(p);
    vec2 local = fract(p);

    float rnd = hash(cell + fl * 200.0 + seed * 431.0);
    float rnd2 = hash(cell + vec2(31.7, 73.1) + fl * 200.0 + seed * 613.0);
    float rnd3 = hash(cell + vec2(97.3, 11.9) + fl * 200.0 + seed * 271.0);

    // Sparser — ~30% of cells active
    float active = step(0.70, rnd);

    vec2 center = vec2(rnd2, rnd3) * 0.6 + 0.2;
    float dist = length(local - center);

    // Softer falloff, no outer glow ring
    float sparkle = smoothstep(0.12, 0.02, dist) * active;

    float twinkle = sin(time * (1.5 + rnd * 3.0) + rnd2 * 6.283 + seed * 31.0);
    twinkle = twinkle * 0.35 + 0.65;
    sparkle *= twinkle;

    glow += sparkle;
    hueAccum += rnd * sparkle;
  }

  glow = min(glow, 1.0);
  float hue = fract(hueAccum / max(glow, 0.001) + seed + time * 0.02);
  vec3 color = hsv2rgb(vec3(hue, 0.3, 1.0));

  float alpha = glow * intensity * 0.7;
  return half4(color * alpha, alpha);
}
`;

// --- 8. MYTHIC: completed-tier — swirling vortex with layered energy rings ---
const MYTHIC_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 center = vec2(0.5, 0.5);
  vec2 delta = uv - center;

  float dist = length(delta);
  float angle = atan(delta.y, delta.x);

  // Swirling distortion
  float swirl = angle + dist * 4.0 + time * 0.15 + seed * 6.283;

  // Concentric energy rings
  float rings = sin(dist * 25.0 - time * 0.8 + seed * 11.0) * 0.5 + 0.5;
  rings *= smoothstep(0.6, 0.1, dist);

  // Spiral arms
  float arms = sin(swirl * 3.0 + noise(uv * 5.0 + seed * 100.0 + time * 0.2) * 2.0);
  arms = smoothstep(0.0, 0.5, arms) * smoothstep(0.7, 0.0, dist);

  // Noise-based color variation
  float n = noise(uv * 8.0 + vec2(seed * 137.0, seed * 249.0) + time * 0.15);

  float glow = rings * 0.5 + arms * 0.6 + n * 0.2;
  glow = min(glow, 1.0);

  float hue = fract(angle / 6.283 + dist * 0.5 + seed + time * 0.03);
  float sat = 0.5 + n * 0.2;
  vec3 color = hsv2rgb(vec3(hue, sat, 1.0));

  // Bright center pulse
  float pulse = sin(time * 0.5 + seed * 5.0) * 0.3 + 0.7;
  float centerGlow = smoothstep(0.25, 0.0, dist) * pulse * 0.4;
  color += centerGlow;

  float alpha = glow * intensity;
  return half4(color * alpha, alpha);
}
`;

// --- 9. COSMIC_OCEAN: space bubbles drifting through bioluminescent nebula currents ---
const COSMIC_OCEAN_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 213.7, seed * 167.3);

  // Layered warping currents
  float warp1 = noise(uv * 2.5 + offset + vec2(time * 0.06, time * 0.04));
  float warp2 = noise(uv * 4.0 + offset * 1.3 - vec2(time * 0.05, time * 0.07));
  vec2 warped = uv + vec2(warp1, warp2) * 0.15;

  // Deep color pools — slow drifting nebula blobs
  float pool1 = noise(warped * 3.0 + time * 0.04 + seed * 50.0);
  float pool2 = noise(warped * 5.0 - time * 0.03 + seed * 90.0);
  float pool3 = noise(warped * 7.0 + vec2(time * 0.02, -time * 0.05) + seed * 130.0);
  float depth = pool1 * 0.5 + pool2 * 0.3 + pool3 * 0.2;

  // Bioluminescent hue: deep blue → teal → violet cycle
  float hue = fract(0.55 + depth * 0.15 + seed * 0.3 + time * 0.01);
  float sat = 0.55 + pool2 * 0.2;
  vec3 color = hsv2rgb(vec3(hue, sat, 0.9 + depth * 0.1));

  // --- Cosmic bubble orbs ---
  float bubbleGlow = 0.0;
  float bubbleHue = 0.0;

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float scale = 5.0 + fi * 3.0;
    float rise = time * (0.04 + fi * 0.02);

    // Bubbles drift upward with gentle horizontal wobble
    vec2 bp = warped * scale;
    bp.y -= rise;
    bp.x += sin(time * (0.15 + fi * 0.08) + fi * 3.0 + seed * 11.0) * 0.4;

    vec2 cell = floor(bp);
    vec2 local = fract(bp);

    float rnd = hash(cell + fi * 300.0 + seed * 517.0);
    float rnd2 = hash(cell + vec2(41.3, 83.7) + fi * 300.0 + seed * 613.0);
    float rnd3 = hash(cell + vec2(67.1, 29.3) + fi * 300.0 + seed * 397.0);

    // ~20% of cells have a bubble
    float active = step(0.80, rnd);

    // Bubble center + varying radius (smaller)
    vec2 center = vec2(rnd2, rnd3) * 0.5 + 0.25;
    float bubbleRadius = 0.08 + rnd * 0.06;
    float dist = length(local - center);

    // Hollow orb: bright rim + translucent interior
    float rim = smoothstep(bubbleRadius + 0.03, bubbleRadius - 0.01, dist)
              - smoothstep(bubbleRadius - 0.01, bubbleRadius - 0.05, dist);
    rim *= active;

    // Soft inner glow — faint fill inside the bubble
    float inner = smoothstep(bubbleRadius, 0.0, dist) * active * 0.2;

    // Specular highlight — small bright spot offset toward top-left
    vec2 specOff = center + vec2(-0.03, -0.04);
    float spec = smoothstep(0.04, 0.0, length(local - specOff)) * active * 0.6;

    // Gentle wobble in brightness
    float wobble = sin(time * (1.0 + rnd * 2.0) + rnd2 * 6.283 + seed * 19.0) * 0.2 + 0.8;

    float orb = (rim * 0.7 + inner + spec) * wobble;
    bubbleGlow += orb;
    bubbleHue += rnd * orb;
  }

  bubbleGlow = min(bubbleGlow, 1.0);

  // Bubble color: iridescent shift — each orb catches a different hue from the nebula
  float bHue = fract(0.5 + bubbleHue / max(bubbleGlow, 0.001) * 0.3 + time * 0.015 + seed);
  vec3 bubbleColor = hsv2rgb(vec3(bHue, 0.4, 1.0));
  color += bubbleColor * bubbleGlow * 0.5;

  // Plankton sparks in the background
  float sparkGrid = 30.0;
  vec2 sCell = floor(warped * sparkGrid);
  float sRnd = hash(sCell + seed * 371.0);
  float spark = step(0.92, sRnd) * smoothstep(0.1, 0.0, length(fract(warped * sparkGrid) - 0.5));
  spark *= sin(time * (2.0 + sRnd * 4.0) + sRnd * 6.283) * 0.4 + 0.6;
  color += spark * 0.3;

  float alpha = intensity * (0.35 + depth * 0.4 + bubbleGlow * 0.25);
  return half4(color * alpha, alpha);
}
`;

// --- 10. GRAINY_SAHARA: aerial flyover of endless dunes with sand grain ---
const GRAINY_SAHARA_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 157.9, seed * 283.1);

  // Scrolling terrain — slow drift downward like flying over dunes
  vec2 fly = uv + vec2(time * 0.015 + seed * 3.0, time * 0.04);

  // Layered dune ridges from above — curved parallel lines with noise warp
  float warp = noise(fly * 2.0 + offset) * 0.4;
  float dune1 = sin((fly.x + warp) * 12.0 + noise(fly * 3.5 + offset) * 4.0);
  float dune2 = sin((fly.x * 0.7 + fly.y * 0.3 + warp) * 18.0 + noise(fly * 6.0 + offset * 1.5) * 3.0 + seed * 5.0);
  float dune3 = sin((fly.x * 0.4 - fly.y * 0.6) * 8.0 + noise(fly * 2.0 + offset * 2.0) * 5.0 + seed * 11.0);

  // Combine: sharp crests + soft valleys
  float ridges = dune1 * 0.45 + dune2 * 0.35 + dune3 * 0.2;
  float dunes = ridges * 0.5 + 0.5;
  // Sharpen the ridge crests
  float crest = smoothstep(0.7, 0.9, dunes);

  // Shadow in the valleys (wind-shadow side of dunes)
  float shadow = smoothstep(0.5, 0.2, dunes) * 0.3;

  // Heat shimmer — fast subtle distortion
  float shimmer = noise(vec2(fly.x * 25.0, fly.y * 4.0 + time * 1.2) + seed * 100.0);
  shimmer = shimmer * shimmer * 0.12;

  // Dense film grain at multiple frequencies — sand texture everywhere
  float grain1 = hash(floor(uv * resolution + time * 7.0 + seed * 200.0));
  float grain2 = hash(floor(uv * resolution * 0.5 + time * 5.0 + seed * 300.0));
  float grain3 = hash(floor(uv * resolution * 0.25 + time * 3.0 + seed * 400.0));
  float grain = grain1 * 0.45 + grain2 * 0.35 + grain3 * 0.2;

  // Warm palette: sunlit gold on crests, deeper amber in valleys
  float hue = 0.07 + dunes * 0.05 + seed * 0.02 + shimmer * 0.01;
  float sat = 0.45 + grain * 0.15 - crest * 0.1;
  float val = 0.5 + dunes * 0.35 + crest * 0.2 + grain * 0.08;
  vec3 color = hsv2rgb(vec3(hue, sat, val));

  // Sand grain texture blend
  vec3 sandGrain = vec3(grain * 0.9 + 0.1, grain * 0.75 + 0.1, grain * 0.45);
  color = mix(color, sandGrain, 0.35);

  // Bright sunlit ridge highlights
  color += crest * vec3(0.25, 0.2, 0.1);
  // Darken valleys
  color -= shadow;

  float alpha = intensity * (0.35 + dunes * 0.3 + grain * 0.15);
  return half4(color * alpha, alpha);
}
`;

// --- 11. EMBER_FOREST: fireflies drifting through dark canopy ---
const EMBER_FOREST_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 191.3, seed * 347.7);

  // Dark canopy base — layered noise for foliage depth
  float canopy1 = noise(uv * 4.0 + offset + time * 0.02);
  float canopy2 = noise(uv * 8.0 + offset * 1.4 - time * 0.03);
  float canopy = canopy1 * 0.6 + canopy2 * 0.4;

  // Deep green base tone
  float baseHue = 0.30 + canopy * 0.05 + seed * 0.03;
  vec3 baseColor = hsv2rgb(vec3(baseHue, 0.5, 0.2 + canopy * 0.15));

  // Firefly particles — multiple layers at different scales/speeds
  float flyGlow = 0.0;
  float flyHue = 0.0;

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float scale = 12.0 + fi * 8.0;
    float speed = 0.08 + fi * 0.04;

    // Gentle drift — mostly upward with horizontal wander
    vec2 p = uv * scale;
    p.y -= time * speed;
    p.x += sin(time * 0.2 + fi * 2.0 + seed * 5.0) * 0.5;

    vec2 cell = floor(p);
    vec2 local = fract(p);

    float rnd = hash(cell + fi * 150.0 + seed * 419.0);
    float rnd2 = hash(cell + vec2(23.1, 67.9) + fi * 150.0 + seed * 557.0);
    float rnd3 = hash(cell + vec2(89.3, 13.7) + fi * 150.0 + seed * 331.0);

    // Sparse — ~20% of cells
    float active = step(0.80, rnd);

    vec2 center = vec2(rnd2, rnd3) * 0.5 + 0.25;
    float dist = length(local - center);

    // Soft glow radius
    float fly = smoothstep(0.18, 0.0, dist) * active;

    // Slow pulse — fireflies blink gently
    float blink = sin(time * (0.8 + rnd * 2.0) + rnd2 * 6.283 + seed * 13.0);
    blink = smoothstep(-0.3, 0.8, blink);
    fly *= blink;

    flyGlow += fly;
    flyHue += rnd * fly;
  }

  flyGlow = min(flyGlow, 1.0);

  // Warm firefly color: yellow-green to soft amber
  float fHue = 0.15 + (flyHue / max(flyGlow, 0.001)) * 0.08 + seed * 0.04;
  vec3 flyColor = hsv2rgb(vec3(fHue, 0.5, 1.0));

  vec3 color = baseColor + flyColor * flyGlow;

  float alpha = intensity * (0.25 + canopy * 0.25 + flyGlow * 0.5);
  return half4(color * alpha, alpha);
}
`;

// --- 12. NOISY_CAVERN: thin crystal cracks in dark rock with faint gem light ---
const NOISY_CAVERN_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 237.1, seed * 179.3);

  // Dark rock base — subtle low-frequency texture
  float rock1 = noise(uv * 8.0 + offset);
  float rock2 = noise(uv * 16.0 + offset * 1.7 + time * 0.01);
  float rock = rock1 * 0.6 + rock2 * 0.4;
  vec3 rockColor = vec3(0.06 + rock * 0.06);

  // Thin crystal veins via cell-edge distance (Voronoi cracks)
  float vein = 0.0;
  float veinHue = 0.0;

  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float scale = 6.0 + fl * 5.0;
    vec2 p = uv * scale + offset * (1.0 + fl * 0.5) + time * 0.008;

    vec2 cell = floor(p);
    vec2 local = fract(p);

    // Find two closest cell centers for crack line
    float minDist1 = 1.0;
    float minDist2 = 1.0;
    float cellRnd = 0.0;

    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 neighbor = vec2(float(dx), float(dy));
        vec2 nc = cell + neighbor;
        float rnd = hash(nc + fl * 100.0 + seed * 317.0);
        float rnd2 = hash(nc + vec2(71.3, 43.7) + fl * 100.0 + seed * 491.0);
        vec2 pt = neighbor + vec2(rnd, rnd2) * 0.8 + 0.1 - local;
        float d = dot(pt, pt);
        if (d < minDist1) {
          minDist2 = minDist1;
          minDist1 = d;
          cellRnd = rnd;
        } else if (d < minDist2) {
          minDist2 = d;
        }
      }
    }

    // Crack = where two cells are nearly equidistant (thin edge)
    float edgeDist = minDist2 - minDist1;
    float crack = 1.0 - smoothstep(0.0, 0.08 - fl * 0.02, edgeDist);

    vein = max(vein, crack * (0.8 - fl * 0.2));
    veinHue += cellRnd * crack;
  }

  // Gem hue along cracks — cool tones: teal, blue, violet
  float hue = fract(0.5 + veinHue * 0.3 + seed * 0.4);
  float sat = 0.35 + vein * 0.2;
  vec3 veinColor = hsv2rgb(vec3(hue, sat, 0.7));

  // Slow glint that travels along the veins
  float n = noise(uv * 6.0 + offset + time * 0.015);
  float glint = sin(time * 0.3 + n * 15.0 + seed * 9.0) * 0.5 + 0.5;
  glint = glint * glint * vein * 0.3;

  vec3 color = rockColor + veinColor * vein * 0.5 + glint;

  float alpha = intensity * (0.15 + rock * 0.15 + vein * 0.5);
  return half4(color * alpha, alpha);
}
`;

// --- 13. ROLE_STRETCH: hot amber pulsing glow — pushing limits ---
const ROLE_STRETCH_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 113.7, seed * 271.3);

  float n1 = noise(uv * 4.0 + offset + time * 0.3);
  float n2 = noise(uv * 8.0 + offset * 1.5 - time * 0.2);
  float warp = n1 * 0.6 + n2 * 0.4;

  // Rising heat distortion
  float heat = noise(vec2(uv.x * 3.0, uv.y * 2.0 - time * 0.4) + offset);
  float pulse = sin(time * 0.8 + warp * 6.0 + seed * 5.0) * 0.5 + 0.5;

  // Amber to orange gradient
  vec3 amber = vec3(1.0, 0.75, 0.2);
  vec3 orange = vec3(1.0, 0.5, 0.1);
  vec3 color = mix(amber, orange, heat * 0.6 + pulse * 0.4);

  // Sparkle scatter — two layers for density
  float sparkle = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float sparkScale = 22.0 + float(layer) * 12.0;
    vec2 lOff = offset + vec2(float(layer) * 71.3, float(layer) * 43.9);
    vec2 sparkCell = floor(uv * sparkScale);
    vec2 sparkLocal = fract(uv * sparkScale);
    float sr = hash(sparkCell + lOff);
    float sr2 = hash(sparkCell + lOff + vec2(53.1, 17.9));
    float sparkActive = step(0.62, sr);
    vec2 sparkCenter = vec2(sr, sr2) * 0.5 + 0.25;
    float sparkDist = length(sparkLocal - sparkCenter);
    float s = smoothstep(0.12, 0.01, sparkDist) * sparkActive;
    float twinkle = sin(time * (1.5 + sr * 4.0) + sr2 * 6.283) * 0.5 + 0.5;
    s *= 0.3 + twinkle * 0.7;
    sparkle = max(sparkle, s);
  }
  color += sparkle * vec3(1.0, 0.95, 0.75) * 0.7;

  float glow = warp * 0.5 + heat * 0.3 + pulse * 0.2 + sparkle * 0.4;
  float alpha = intensity * glow * 0.9;
  return half4(color * alpha, alpha);
}
`;

// --- 14. ROLE_EXPLORE: cool blue sweeping bands — new territory ---
const ROLE_EXPLORE_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 197.1, seed * 89.3);

  // Sweeping diagonal bands
  float angle = uv.x * 2.0 + uv.y * 3.0 + time * 0.12 + seed * 7.0;
  float band = sin(angle * 6.283) * 0.5 + 0.5;
  band = smoothstep(0.3, 0.7, band);

  float shimmer = noise(uv * 12.0 + offset + time * 0.4);

  // Cool blue to cyan
  vec3 blue = vec3(0.3, 0.6, 1.0);
  vec3 cyan = vec3(0.2, 0.85, 0.9);
  vec3 color = mix(blue, cyan, band * 0.6 + shimmer * 0.4);

  float alpha = intensity * (band * 0.5 + shimmer * 0.25) * 0.7;
  return half4(color * alpha, alpha);
}
`;

// --- 15. ROLE_DISCOVER: soft green shimmer — first contact ---
const ROLE_DISCOVER_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 67.3, seed * 193.7);

  float n = noise(uv * 6.0 + offset + time * 0.25);
  float sparkle = noise(uv * 30.0 + offset * 2.0 + time * 0.8);
  sparkle = smoothstep(0.65, 0.85, sparkle);

  // Soft pulse
  float pulse = sin(time * 0.6 + n * 4.0 + seed * 3.0) * 0.5 + 0.5;

  // Green to emerald
  vec3 green = vec3(0.2, 0.85, 0.5);
  vec3 emerald = vec3(0.1, 0.7, 0.6);
  vec3 color = mix(emerald, green, n * 0.5 + pulse * 0.5);
  color += sparkle * vec3(0.8, 1.0, 0.9) * 0.3;

  float alpha = intensity * (n * 0.4 + sparkle * 0.4 + pulse * 0.15) * 0.75;
  return half4(color * alpha, alpha);
}
`;

// --- 16. ROLE_DEEPEN: warm purple/violet depth waves ---
const ROLE_DEEPEN_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 157.3, seed * 223.1);

  // Concentric ripples from center
  float cx = 0.5 + sin(time * 0.3 + seed * 5.0) * 0.05;
  float cy = 0.5 + cos(time * 0.25 + seed * 3.0) * 0.05;
  float dist = length(uv - vec2(cx, cy));
  float ripple = sin(dist * 20.0 - time * 0.8 + seed * 9.0) * 0.5 + 0.5;

  float n = noise(uv * 5.0 + offset + time * 0.15);

  // Purple to violet
  vec3 purple = vec3(0.6, 0.3, 0.9);
  vec3 violet = vec3(0.8, 0.4, 1.0);
  vec3 color = mix(purple, violet, ripple * 0.5 + n * 0.5);

  float glow = ripple * 0.4 + n * 0.3;
  float fade = 1.0 - smoothstep(0.0, 0.6, dist);
  float alpha = intensity * glow * fade * 0.85;
  return half4(color * alpha, alpha);
}
`;

// --- 17. ROLE_ENJOY: golden warm sparkle — pure fun ---
const ROLE_ENJOY_SKSL = `
${UNIFORM_HEADER}
${GLSL_HELPERS}

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  vec2 offset = vec2(seed * 143.7, seed * 97.1);

  // Scattered golden sparkles
  float scale = 35.0;
  vec2 cell = floor(uv * scale);
  vec2 local = fract(uv * scale);

  float rnd = hash(cell + offset);
  float rnd2 = hash(cell + vec2(17.3, 53.7) + offset);
  float rnd3 = hash(cell + vec2(41.1, 89.3) + offset);

  float active = step(0.65, rnd);
  vec2 center = vec2(rnd2, rnd3) * 0.6 + 0.2;
  float d = length(local - center);
  float sparkle = smoothstep(0.14, 0.02, d) * active;

  // Twinkle
  float twinkle = sin(time * (1.5 + rnd * 2.5) + rnd2 * 6.283 + seed * 11.0) * 0.5 + 0.5;
  sparkle *= 0.5 + twinkle * 0.5;

  // Soft background warmth
  float warmth = noise(uv * 4.0 + offset + time * 0.15) * 0.3;

  // Gold to warm yellow
  vec3 gold = vec3(1.0, 0.85, 0.3);
  vec3 warm = vec3(1.0, 0.7, 0.2);
  vec3 color = mix(warm, gold, sparkle * 0.6 + warmth);

  float alpha = intensity * (sparkle * 0.7 + warmth * 0.3) * 0.8;
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
  aurora: Skia.RuntimeEffect.Make(AURORA_SKSL),
  stardust: Skia.RuntimeEffect.Make(STARDUST_SKSL),
  mythic: Skia.RuntimeEffect.Make(MYTHIC_SKSL),
  cosmic_ocean: Skia.RuntimeEffect.Make(COSMIC_OCEAN_SKSL),
  grainy_sahara: Skia.RuntimeEffect.Make(GRAINY_SAHARA_SKSL),
  ember_forest: Skia.RuntimeEffect.Make(EMBER_FOREST_SKSL),
  noisy_cavern: Skia.RuntimeEffect.Make(NOISY_CAVERN_SKSL),
  role_stretch: Skia.RuntimeEffect.Make(ROLE_STRETCH_SKSL),
  role_explore: Skia.RuntimeEffect.Make(ROLE_EXPLORE_SKSL),
  role_discover: Skia.RuntimeEffect.Make(ROLE_DISCOVER_SKSL),
  role_deepen: Skia.RuntimeEffect.Make(ROLE_DEEPEN_SKSL),
  role_enjoy: Skia.RuntimeEffect.Make(ROLE_ENJOY_SKSL),
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
