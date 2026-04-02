/**
 * Tests for useGyroTilt — ensures tilt values are output in degrees
 * so the Skia sheen shader (which normalizes by dividing by 18.0) works.
 *
 * The shader's intensity calculation:
 *   float normX = tiltX / 18.0;
 *   float tiltMag = length(vec2(normX, normY));
 *   float intensity = smoothstep(0.05, 0.5, tiltMag);
 *
 * If tilt values are in radians (~0.3) instead of degrees (~17),
 * normX ≈ 0.017 → tiltMag < 0.05 → intensity = 0 → no sheen.
 */

import { renderHook, act } from "@testing-library/react-native";
import { DeviceMotion } from "expo-sensors";
import { useGyroTilt } from "../useGyroTilt";

// ── Mocks ────────────────────────────────────────────────────────────────

// Track the listener callback so we can simulate sensor events
let motionListener: ((data: { rotation: { alpha: number; beta: number; gamma: number } }) => void) | null = null;

jest.mock("expo-sensors", () => ({
  DeviceMotion: {
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((cb) => {
      motionListener = cb;
      return { remove: jest.fn() };
    }),
  },
}));

jest.mock("react-native-reanimated", () => {
  // Minimal shared value mock that stores .value directly
  const makeSharedValue = (initial: number) => ({ value: initial });
  return {
    useSharedValue: (v: number) => makeSharedValue(v),
    withTiming: (v: number, _config?: unknown) => v,
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────

/** Simulate a DeviceMotion event with rotation in radians (as the real API delivers). */
function emitRotation(betaRad: number, gammaRad: number) {
  motionListener?.({ rotation: { alpha: 0, beta: betaRad, gamma: gammaRad } });
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  motionListener = null;
  jest.clearAllMocks();
});

describe("useGyroTilt", () => {
  it("outputs tilt values in degrees, not radians", async () => {
    const { result } = renderHook(() => useGyroTilt(true));

    // Wait for isAvailableAsync to resolve
    await act(async () => {});

    // First event sets the baseline (returned early, tilt stays 0)
    act(() => emitRotation(0.5, 0.3));
    expect(result.current.tiltX.value).toBe(0);
    expect(result.current.tiltY.value).toBe(0);

    // Second event: 10° of tilt from baseline in both axes
    const tenDegRad = 10 * (Math.PI / 180); // ~0.1745 rad
    act(() => emitRotation(0.5 + tenDegRad, 0.3 + tenDegRad));

    // Values must be in degrees (≈10), NOT radians (≈0.17)
    expect(result.current.tiltX.value).toBeGreaterThan(1);
    expect(result.current.tiltY.value).toBeGreaterThan(1);
  });

  it("clamps tilt to ±18 degrees", async () => {
    const { result } = renderHook(() => useGyroTilt(true));
    await act(async () => {});

    // Baseline
    act(() => emitRotation(0, 0));

    // Huge tilt: 45° in radians
    const fortyFiveDegRad = 45 * (Math.PI / 180);
    act(() => emitRotation(fortyFiveDegRad, fortyFiveDegRad));

    // Should be clamped — after smoothing the value won't reach 18 on
    // the first sample, but it must not exceed 18.
    expect(Math.abs(result.current.tiltX.value)).toBeLessThanOrEqual(18);
    expect(Math.abs(result.current.tiltY.value)).toBeLessThanOrEqual(18);
  });

  it("produces values that keep the shader sheen visible", async () => {
    const { result } = renderHook(() => useGyroTilt(true));
    await act(async () => {});

    // Baseline
    act(() => emitRotation(0, 0));

    // Moderate tilt of 8° — should definitely produce visible sheen
    const eightDegRad = 8 * (Math.PI / 180);
    act(() => emitRotation(eightDegRad, eightDegRad));

    // Simulate the shader's normalization: normX = tiltX / 18
    const normX = result.current.tiltX.value / 18;
    const normY = result.current.tiltY.value / 18;
    const tiltMag = Math.sqrt(normX * normX + normY * normY);

    // The shader uses smoothstep(0.05, 0.5, tiltMag)
    // tiltMag must be > 0.05 for any sheen to appear
    expect(tiltMag).toBeGreaterThan(0.05);
  });
});
