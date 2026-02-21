import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapboxGL from "@rnmapbox/maps";
import { DEFAULT_CAMERA_SETTINGS } from "@/config/cameraConfig";
import { MapboxViewport } from "@/types/types";

interface UseInitialLocationOptions {
  userLocation: [number, number] | null;
  isLoadingLocation: boolean;
  getUserLocation: () => void;
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  currentViewport: MapboxViewport | null;
}

export function useInitialLocation({
  userLocation,
  isLoadingLocation,
  getUserLocation,
  cameraRef,
  currentViewport,
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
      currentViewport &&
      cameraRef.current &&
      !hasCenteredOnUserRef.current
    ) {
      hasCenteredOnUserRef.current = true;
      cameraRef.current.setCamera({
        ...DEFAULT_CAMERA_SETTINGS,
        centerCoordinate: userLocation,
      });
    }
  }, [userLocation, isLoadingLocation, currentViewport]);
}
