import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Per-mount gate for safely mounting MapView.
 *
 * The Mapbox MapView registers a native component descriptor on mount.
 * If that registration races with reanimated's animation thread (which
 * holds the same ComponentDescriptorRegistry mutex on Fabric), the app
 * deadlocks.
 * See: https://github.com/facebook/react-native/issues/53128
 *
 * Each mount waits for:
 *   1. The host container to complete its first layout pass (`onLayout`)
 *   2. Several animation frames to elapse, giving reanimated time to finish
 *      any in-flight animation work from the screen transition.
 *
 * The gate re-closes on every fresh mount so navigating back to the map
 * (e.g. from onboarding) always waits for reanimated to settle.
 */

const SETTLE_FRAMES = 5;
const FALLBACK_TIMEOUT_MS = 5000;

export function useMapMountGate(_name = "default") {
  const [safe, setSafe] = useState(false);
  const layoutFired = useRef(false);
  const cancelled = useRef(false);

  // Reset on mount
  useEffect(() => {
    cancelled.current = false;
    layoutFired.current = false;
    setSafe(false);

    // Safety fallback — if onLayout never fires, force-open after timeout
    const fallback = setTimeout(() => {
      if (!cancelled.current) {
        setSafe(true);
      }
    }, FALLBACK_TIMEOUT_MS);

    return () => {
      cancelled.current = true;
      clearTimeout(fallback);
    };
  }, []);

  const onContainerLayout = useCallback(() => {
    if (layoutFired.current) return;
    layoutFired.current = true;

    // Wait several frames for reanimated to settle after the screen transition
    let remaining = SETTLE_FRAMES;
    const tick = () => {
      if (cancelled.current) return;
      remaining--;
      if (remaining <= 0) {
        setSafe(true);
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, []);

  return { isMapSafeToMount: safe, onContainerLayout } as const;
}
