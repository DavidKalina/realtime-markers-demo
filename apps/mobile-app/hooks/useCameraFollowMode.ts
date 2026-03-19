import { useCallback, useEffect, useRef, useState } from "react";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";
import MapboxGL from "@rnmapbox/maps";

interface UseCameraFollowModeOptions {
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  userLocation: [number, number] | null;
}

export function useCameraFollowMode({
  cameraRef,
  userLocation,
}: UseCameraFollowModeOptions) {
  // Start NOT following — useInitialLocation handles the first center.
  // Follow mode is only enabled explicitly via the recenter button.
  const [isFollowing, setIsFollowing] = useState(false);
  const { subscribe } = useEventBroker();

  // When user pans the map, disable follow mode
  useEffect(() => {
    const unsubscribe = subscribe(EventTypes.USER_PANNING_VIEWPORT, () => {
      setIsFollowing(false);
    });
    return unsubscribe;
  }, [subscribe]);

  // When a programmatic camera animation fires, disable follow mode
  // (follow mode moves the camera directly via cameraRef, never via events)
  useEffect(() => {
    const unsubscribe = subscribe(EventTypes.CAMERA_ANIMATE_TO_LOCATION, () => {
      setIsFollowing(false);
    });
    return unsubscribe;
  }, [subscribe]);

  // When following and location updates, move camera
  useEffect(() => {
    if (!isFollowing || !userLocation || !cameraRef.current) return;

    cameraRef.current.setCamera({
      centerCoordinate: userLocation,
      animationDuration: 500,
      animationMode: "easeTo",
    });
  }, [isFollowing, userLocation, cameraRef]);

  // Re-center: enable follow mode and fly to current location
  const recenter = useCallback(() => {
    setIsFollowing(true);
    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: userLocation,
        animationDuration: 500,
        animationMode: "flyTo",
      });
    }
  }, [userLocation, cameraRef]);

  return {
    isFollowing,
    recenter,
  };
}
