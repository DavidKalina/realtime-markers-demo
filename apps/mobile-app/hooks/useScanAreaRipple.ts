import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import type MapboxGL from "@rnmapbox/maps";
import type { Router } from "expo-router";

interface UseScanAreaRippleOptions {
  mapRef: React.RefObject<MapboxGL.MapView | null>;
  userLocation: [number, number] | null;
  zoomLevel: number;
  router: Router;
}

/**
 * Scan-area FAB press handler, ripple effect state, and navigation logic.
 */
export function useScanAreaRipple({
  mapRef,
  userLocation,
  zoomLevel,
  router,
}: UseScanAreaRippleOptions) {
  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
  const [showRipple, setShowRipple] = useState(false);
  const scanAreaRef = useRef<View>(null);

  const handleScanArea = useCallback(async () => {
    // Trigger ripple from the button's screen position
    scanAreaRef.current?.measureInWindow((x, y, width, height) => {
      setRipplePosition({ x: x + width / 2, y: y + height / 2 });
      setShowRipple(true);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Capture map center now, navigate after ripple plays
    let navUrl: string | null = null;
    try {
      const center = await mapRef.current?.getCenter();
      const zoom = await mapRef.current?.getZoom();
      if (center) {
        const [lng, lat] = center;
        navUrl = `/area-scan?lat=${lat}&lng=${lng}&zoom=${Math.round(zoom ?? zoomLevel)}`;
      }
    } catch {
      if (userLocation) {
        navUrl = `/area-scan?lat=${userLocation[1]}&lng=${userLocation[0]}&zoom=${zoomLevel}`;
      }
    }
    if (navUrl) {
      const url = navUrl;
      setTimeout(() => router.push(url), 600);
    }
  }, [userLocation, zoomLevel, router, mapRef]);

  const handleRippleComplete = useCallback(() => {
    setShowRipple(false);
  }, []);

  return {
    scanAreaRef,
    showRipple,
    ripplePosition,
    handleScanArea,
    handleRippleComplete,
  };
}
