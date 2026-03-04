import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapboxGL from "@rnmapbox/maps";
import { DEFAULT_CAMERA_SETTINGS } from "@/config/cameraConfig";
import { apiClient } from "@/services/ApiClient";
import { eventBroker, EventTypes } from "@/services/EventBroker";

const VIEWPORT_REQUEST_TIMEOUT_MS = 3000;

interface UseInitialLocationOptions {
  userLocation: [number, number] | null;
  isLoadingLocation: boolean;
  getUserLocation: () => void;
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
}

export function useInitialLocation({
  userLocation,
  isLoadingLocation,
  getUserLocation,
  cameraRef,
}: UseInitialLocationOptions) {
  const hasCenteredOnUserRef = useRef(false);
  const [hasRequestedInitialLocation, setHasRequestedInitialLocation] =
    useState(false);

  // Load initial location request state
  useEffect(() => {
    const loadInitialLocationState = async () => {
      try {
        const hasRequested = await AsyncStorage.getItem(
          "hasRequestedInitialLocation",
        );
        if (hasRequested === "true") {
          setHasRequestedInitialLocation(true);
        }
      } catch (error) {
        console.error(
          "[HomeScreen] Error loading initial location state:",
          error,
        );
      }
    };
    loadInitialLocationState();
  }, []);

  // Get user location only when needed
  useEffect(() => {
    const checkLocation = async () => {
      if (!userLocation && !isLoadingLocation && !hasRequestedInitialLocation) {
        if (!userLocation) {
          setHasRequestedInitialLocation(true);
          await AsyncStorage.setItem("hasRequestedInitialLocation", "true");
          getUserLocation();
        }
      }
    };

    // Debounce the effect to prevent multiple rapid triggers
    const timeoutId = setTimeout(checkLocation, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    userLocation,
    isLoadingLocation,
    getUserLocation,
    hasRequestedInitialLocation,
  ]);

  // Update camera position only once when user location becomes available
  useEffect(() => {
    if (
      userLocation &&
      !isLoadingLocation &&
      cameraRef.current &&
      !hasCenteredOnUserRef.current
    ) {
      hasCenteredOnUserRef.current = true;

      const fetchSmartViewport = async () => {
        try {
          const viewportPromise = apiClient.events.getInitialViewport(
            userLocation[1],
            userLocation[0],
          );
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Viewport request timeout")),
              VIEWPORT_REQUEST_TIMEOUT_MS,
            ),
          );

          const viewport = await Promise.race([
            viewportPromise,
            timeoutPromise,
          ]);

          // If the smart viewport moved the camera away from the user's
          // location (no nearby events), disable follow mode so it doesn't
          // snap the camera back to the user.
          if (!viewport.hasNearbyEvents) {
            eventBroker.emit(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
              timestamp: Date.now(),
              source: "useInitialLocation",
            });
          }

          cameraRef.current?.setCamera({
            centerCoordinate: viewport.center,
            zoomLevel: viewport.zoom,
            animationDuration: 0,
          });
        } catch {
          cameraRef.current?.setCamera({
            ...DEFAULT_CAMERA_SETTINGS,
            centerCoordinate: userLocation,
          });
        }
      };

      fetchSmartViewport();
    }
  }, [userLocation, isLoadingLocation]);
}
