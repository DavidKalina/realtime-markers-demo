import { useCallback, useEffect, useRef } from "react";
import { Camera, CameraStop } from "@rnmapbox/maps";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  EventTypes,
  CameraAnimateToLocationEvent,
  CameraAnimateToBoundsEvent,
} from "@/services/EventBroker";

interface UseMapCameraProps {
  cameraRef: React.RefObject<Camera>;
}

export const useMapCamera = ({ cameraRef }: UseMapCameraProps) => {
  const { subscribe } = useEventBroker();
  const isAnimatingRef = useRef(false);

  const animateToLocation = useCallback(
    (coordinates: [number, number], duration = 1000, zoomLevel?: number) => {
      if (!cameraRef.current) return;

      isAnimatingRef.current = true;
      const cameraSettings: CameraStop = {
        centerCoordinate: coordinates,
        animationDuration: duration,
        animationMode: "flyTo",
      };

      if (zoomLevel !== undefined) {
        cameraSettings.zoomLevel = zoomLevel;
      }

      cameraRef.current.setCamera(cameraSettings);

      setTimeout(() => {
        isAnimatingRef.current = false;
      }, duration + 50); // Small buffer for animation completion
    },
    [cameraRef],
  );

  const animateToBounds = useCallback(
    (
      bounds: { north: number; south: number; east: number; west: number },
      padding = 50,
      duration = 1000,
    ) => {
      if (!cameraRef.current) return;

      isAnimatingRef.current = true;
      cameraRef.current.fitBounds(
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
        padding,
        duration,
      );

      setTimeout(() => {
        isAnimatingRef.current = false;
      }, duration + 50); // Small buffer for animation completion
    },
    [cameraRef],
  );

  // Subscribe to camera animation events
  useEffect(() => {
    const unsubscribeAnimateToLocation =
      subscribe<CameraAnimateToLocationEvent>(
        EventTypes.CAMERA_ANIMATE_TO_LOCATION,
        (event) => {
          const duration = event.duration ?? 1000;
          const cameraSettings: CameraStop = {
            centerCoordinate: event.coordinates,
            animationDuration: duration,
            animationMode: "flyTo",
          };

          // Only include zoomLevel if explicitly allowed and provided
          if (
            event.allowZoomChange === true &&
            typeof event.zoomLevel === "number"
          ) {
            cameraSettings.zoomLevel = event.zoomLevel;
          }

          if (cameraRef.current) {
            isAnimatingRef.current = true;
            cameraRef.current.setCamera(cameraSettings);
            setTimeout(() => {
              isAnimatingRef.current = false;
            }, duration + 50);
          }
        },
      );

    const unsubscribeAnimateToBounds = subscribe<CameraAnimateToBoundsEvent>(
      EventTypes.CAMERA_ANIMATE_TO_BOUNDS,
      (event) =>
        animateToBounds(
          event.bounds,
          event.padding ?? 50,
          event.duration ?? 1000,
        ),
    );

    return () => {
      unsubscribeAnimateToLocation();
      unsubscribeAnimateToBounds();
    };
  }, [subscribe, animateToBounds, cameraRef]);

  return {
    animateToLocation,
    animateToBounds,
    isAnimating: isAnimatingRef.current,
  };
};
