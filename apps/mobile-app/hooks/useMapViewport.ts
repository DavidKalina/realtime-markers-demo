import { useCallback, useRef, useState } from "react";
import { useLocationStore } from "@/stores/useLocationStore";
import debounce from "lodash/debounce";
import { MapboxViewport } from "@/types/types";

interface UseMapViewportOptions {
  updateViewport: (viewport: MapboxViewport) => void;
  isPitched: boolean;
}

export function useMapViewport({
  updateViewport,
  isPitched,
}: UseMapViewportOptions) {
  const { setZoomLevel } = useLocationStore();
  const [viewportRectangle, setViewportRectangle] =
    useState<MapboxViewport | null>(null);

  // Track camera movement for clustering freeze.
  // Uses a ref gate so we only trigger 2 state updates per gesture (start + settle).
  const cameraMovingRef = useRef(false);
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const cameraSettledTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Debounce the expensive updateViewport cascade (state update → EventBroker
  // broadcast → WebSocket send → re-clustering). Fires once at the start
  // (leading) and once after the last call (trailing) — max 2 server
  // requests per gesture. Tight 50ms window is affordable at zoom 13+ where
  // marker density is low.
  const debouncedUpdateViewport = useRef(
    debounce((viewport: MapboxViewport) => updateViewport(viewport), 50, {
      leading: true,
      trailing: true,
    }),
  ).current;

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

        // Signal camera-moving (one state update at start of gesture)
        if (!cameraMovingRef.current) {
          cameraMovingRef.current = true;
          setIsCameraMoving(true);
        }
        // Reset the settle timer on every frame — 80ms after the last
        // onRegionIsChanging we consider the camera settled. Tighter window
        // unfreezes clustering faster so new markers appear sooner after a pan.
        if (cameraSettledTimeout.current) {
          clearTimeout(cameraSettledTimeout.current);
        }
        cameraSettledTimeout.current = setTimeout(() => {
          cameraMovingRef.current = false;
          setIsCameraMoving(false);
        }, 150);

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
    isCameraMoving,
  };
}
