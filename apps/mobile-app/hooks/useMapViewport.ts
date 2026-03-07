import { useCallback, useRef, useState } from "react";
import { useLocationStore } from "@/stores/useLocationStore";
import { MapboxViewport } from "@/types/types";

interface UseMapViewportOptions {
  updateViewport: (viewport: MapboxViewport) => void;
  isPitched: boolean;
}

/**
 * Zoom-aware client-side debounce: at high zoom individual markers are visible
 * so we want snappy updates; at low zoom everything is clustered so we can
 * afford a wider debounce window, reducing WebSocket churn and re-clustering.
 */
function getClientDebounceMs(zoom: number): number {
  if (zoom >= 14) return 50;
  if (zoom >= 10) return 120;
  return 250;
}

export function useMapViewport({
  updateViewport,
  isPitched,
}: UseMapViewportOptions) {
  const { setZoomLevel } = useLocationStore();
  const [viewportRectangle, setViewportRectangle] =
    useState<MapboxViewport | null>(null);

  // Zoom-aware debounce: fires once at the start (leading) and once after the
  // last call (trailing). The debounce window scales with zoom — tight at high
  // zoom where individual markers matter, wider at low zoom where everything
  // is clustered.
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingViewportRef = useRef<MapboxViewport | null>(null);
  const hasFiredLeadingRef = useRef(false);

  const debouncedUpdateViewport = useCallback(
    (viewport: MapboxViewport) => {
      const zoom = useLocationStore.getState().zoomLevel;
      const wait = getClientDebounceMs(zoom);

      pendingViewportRef.current = viewport;

      // Leading edge: fire immediately on first call
      if (!hasFiredLeadingRef.current) {
        hasFiredLeadingRef.current = true;
        updateViewport(viewport);
      }

      // Reset trailing timer
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
      }

      viewportTimerRef.current = setTimeout(() => {
        hasFiredLeadingRef.current = false;
        viewportTimerRef.current = null;
        if (pendingViewportRef.current) {
          updateViewport(pendingViewportRef.current);
          pendingViewportRef.current = null;
        }
      }, wait);
    },
    [updateViewport],
  );

  const processViewportBounds = useCallback(
    (
      bounds: unknown,
    ): { north: number; south: number; east: number; west: number } | null => {
      if (!bounds || !Array.isArray(bounds) || bounds.length !== 2) return null;

      const [northWest, southEast] = bounds;
      if (!Array.isArray(northWest) || !Array.isArray(southEast)) return null;

      const [west, north] = northWest;
      const [east, south] = southEast;

      if (
        typeof west !== "number" ||
        typeof north !== "number" ||
        typeof east !== "number" ||
        typeof south !== "number"
      )
        return null;

      return {
        north,
        south,
        east: Math.max(west, east),
        west: Math.min(west, east),
      };
    },
    [],
  );

  const calculateViewportRectangle = useCallback(
    (viewport: MapboxViewport, pitched: boolean): MapboxViewport => {
      const geoWidth = viewport.east - viewport.west;
      const geoHeight = viewport.north - viewport.south;

      let scaleFactor = 1.25;
      let verticalOffsetFactor = -0;

      if (pitched) {
        scaleFactor = 1.35;
        verticalOffsetFactor = -0;
      }

      const newWidth = geoWidth * scaleFactor;
      const newHeight = geoHeight * scaleFactor;

      const centerX = (viewport.east + viewport.west) / 2;
      let centerY = (viewport.north + viewport.south) / 2;

      const verticalOffset = newHeight * verticalOffsetFactor;
      centerY += verticalOffset;

      return {
        north: centerY + newHeight / 2,
        south: centerY - newHeight / 2,
        east: centerX + newWidth / 2,
        west: centerX - newWidth / 2,
      };
    },
    [],
  );

  const handleMapViewportChange = useCallback(
    (feature: unknown) => {
      try {
        if (!feature || typeof feature !== "object") return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const properties = (feature as any).properties;
        if (!properties) return;

        const viewport = processViewportBounds(properties.visibleBounds);
        if (viewport) {
          const rectangle = calculateViewportRectangle(viewport, isPitched);
          setViewportRectangle(rectangle);
          debouncedUpdateViewport(rectangle);
        }
      } catch (error) {
        console.error("Error processing viewport change:", error);
      }
    },
    [
      debouncedUpdateViewport,
      processViewportBounds,
      calculateViewportRectangle,
      isPitched,
    ],
  );

  const handleRegionChanging = useCallback(
    (feature: unknown) => {
      try {
        if (!feature || typeof feature !== "object") return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const properties = (feature as any).properties;
        if (!properties) return;

        const zoomLevel = properties.zoomLevel;
        if (typeof zoomLevel === "number") {
          setZoomLevel(zoomLevel);
        }

        handleMapViewportChange(feature);
      } catch (error) {
        console.error("Error handling region change:", error);
      }
    },
    [handleMapViewportChange, setZoomLevel],
  );

  return {
    viewportRectangle,
    handleRegionChanging,
  };
}
