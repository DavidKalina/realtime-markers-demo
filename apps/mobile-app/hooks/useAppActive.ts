import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

/**
 * Tracks whether the app is in the active (foreground) state.
 * When the app returns from background, delays the "active" signal
 * to let the native side fully resume before re-mounting heavy views
 * like MapboxGL (whose GL context can become invalid after backgrounding).
 */
export function useAppActive(resumeDelayMs = 300): boolean {
  const [isActive, setIsActive] = useState(
    AppState.currentState === "active",
  );
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (resumeTimer.current) {
          clearTimeout(resumeTimer.current);
          resumeTimer.current = undefined;
        }

        if (nextState === "active") {
          resumeTimer.current = setTimeout(() => {
            setIsActive(true);
          }, resumeDelayMs);
        } else {
          setIsActive(false);
        }
      },
    );

    return () => {
      subscription.remove();
      if (resumeTimer.current) {
        clearTimeout(resumeTimer.current);
      }
    };
  }, [resumeDelayMs]);

  return isActive;
}
