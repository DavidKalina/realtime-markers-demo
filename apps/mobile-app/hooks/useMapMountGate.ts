import { useCallback, useEffect, useState } from "react";

/**
 * Module-scoped gates for safely mounting MapView on different screens.
 *
 * The Mapbox MapView registers a native component descriptor on mount.
 * If that registration races with reanimated layout animations (which use the
 * same ComponentDescriptorRegistry mutex on Fabric), the app deadlocks.
 * See: https://github.com/facebook/react-native/issues/53128
 *
 * Each gate ensures MapView only mounts after:
 *   1. The host container has completed its first layout pass (`onLayout`)
 *   2. Three animation frames have elapsed, giving reanimated time to finish
 *      scheduling any entering layout animations from the first commit.
 *
 * Once a gate opens it stays open forever — re-renders, unmounts, and
 * navigating back to the screen won't re-close it.
 */

interface GateState {
  open: boolean;
  listeners: Array<() => void>;
}

const gates = new Map<string, GateState>();

function getGate(name: string): GateState {
  let gate = gates.get(name);
  if (!gate) {
    gate = { open: false, listeners: [] };
    gates.set(name, gate);
  }
  return gate;
}

function openGate(name: string) {
  const gate = getGate(name);
  if (gate.open) return;
  gate.open = true;
  for (const listener of gate.listeners) {
    listener();
  }
  gate.listeners = [];
}

/** Wait N requestAnimationFrame ticks, then open the gate. */
function waitFramesThenOpen(name: string, frames: number) {
  if (frames <= 0) {
    openGate(name);
    return;
  }
  requestAnimationFrame(() => waitFramesThenOpen(name, frames - 1));
}

const SETTLE_FRAMES = 3;
const FALLBACK_TIMEOUT_MS = 5000;

/**
 * Returns `{ isMapSafeToMount, onContainerLayout }`.
 *
 * - Attach `onContainerLayout` to the `<View>` wrapping the map.
 * - Render `<MapboxGL.MapView>` only when `isMapSafeToMount` is `true`.
 *
 * @param name  Unique gate name per screen (e.g. "home", "login").
 *              Each screen gets its own independent, once-only gate.
 */
export function useMapMountGate(name = "default") {
  const gate = getGate(name);
  const [safe, setSafe] = useState(gate.open);

  useEffect(() => {
    const g = getGate(name);
    if (g.open) {
      setSafe(true);
      return;
    }

    const listener = () => setSafe(true);
    g.listeners.push(listener);

    // Safety fallback — if onLayout never fires (e.g. hidden screen, dev
    // client quirk), force-open the gate after a generous timeout.
    const fallback = setTimeout(() => {
      if (!getGate(name).open) {
        console.warn(
          `[useMapMountGate:${name}] Fallback timeout reached — forcing gate open`,
        );
        openGate(name);
      }
    }, FALLBACK_TIMEOUT_MS);

    return () => {
      clearTimeout(fallback);
      const current = getGate(name);
      current.listeners = current.listeners.filter((l) => l !== listener);
    };
  }, [name]);

  const onContainerLayout = useCallback(() => {
    if (getGate(name).open) return;
    // Container has laid out → wait a few frames for reanimated to settle.
    waitFramesThenOpen(name, SETTLE_FRAMES);
  }, [name]);

  return { isMapSafeToMount: safe, onContainerLayout } as const;
}
