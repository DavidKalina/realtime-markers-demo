import { useCallback, useRef, useState } from "react";
import { useLocationStore } from "@/stores/useLocationStore";
import { useEventBroker } from "@/hooks/useEventBroker";
import { BaseEvent, EventTypes } from "@/services/EventBroker";
import { MapboxViewport } from "@/types/types";

interface UseMapViewportOptions {
  isPitched: boolean;
  /** When true, viewport updates are suppressed (e.g. during orbit animation) */
  paused?: boolean;
  /** Synchronous ref for paused state — checked before React re-render flushes */
  pausedRef?: React.RefObject<boolean>;
}

export function useMapViewport({
  isPitched,
  paused,
  pausedRef: externalPausedRef,
}: UseMapViewportOptions) {
  const { setZoomLevel } = useLocationStore();
  const { publish } = useEventBroker();
  const [viewportRectangle, setViewportRectangle] =
    useState<MapboxViewport | null>(null);
  const internalPausedRef = useRef(paused);
  internalPausedRef.current = paused;

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
          useLocationStore.getState().updateMapViewport(rectangle);
        }
      } catch (error) {
        console.error("Error processing viewport change:", error);
      }
    },
    [processViewportBounds, calculateViewportRectangle, isPitched],
  );

  const handleRegionChanging = useCallback(
    (feature: unknown) => {
      try {
        if (!feature || typeof feature !== "object") return;

        if (internalPausedRef.current || externalPausedRef?.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const properties = (feature as any).properties;
        if (!properties) return;

        const zoomLevel = properties.zoomLevel;
        if (typeof zoomLevel === "number") {
          setZoomLevel(zoomLevel);
        }

        if (properties.isUserInteraction) {
          publish<BaseEvent>(EventTypes.USER_PANNING_VIEWPORT, {
            timestamp: Date.now(),
            source: "MapRegionChange",
          });
        }

        handleMapViewportChange(feature);
      } catch (error) {
        console.error("Error handling region change:", error);
      }
    },
    [handleMapViewportChange, setZoomLevel, publish],
  );

  return {
    viewportRectangle,
    handleRegionChanging,
  };
}
