import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

const SETTLE_FRAMES = 3;

/**
 * Tracks whether the app is in the active (foreground) state.
 * When the app returns from background, waits for the render loop to
 * actually be running (3 RAF frames) before signalling "active", so
 * heavy native views like MapboxGL remount only after the GL context
 * and compositor are provably ready — not after an arbitrary timeout.
 */
export function useAppActive(): boolean {
  const [isActive, setIsActive] = useState(AppState.currentState === "active");
  // Mutable flag lets us cancel an in-flight RAF chain without needing
  // to track every intermediate requestAnimationFrame id.
  const cancelled = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        // Cancel any in-flight RAF chain from a previous transition
        cancelled.current = true;

        if (nextState === "active") {
          cancelled.current = false;
          const token = cancelled; // capture ref

          let remaining = SETTLE_FRAMES;
          const tick = () => {
            if (token.current) return; // cancelled
            remaining--;
            if (remaining <= 0) {
              setIsActive(true);
            } else {
              requestAnimationFrame(tick);
            }
          };
          requestAnimationFrame(tick);
        } else {
          setIsActive(false);
        }
      },
    );

    return () => {
      subscription.remove();
      cancelled.current = true;
    };
  }, []);

  return isActive;
}
