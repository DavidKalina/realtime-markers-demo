// hooks/useUserLocation.ts
import * as Location from "expo-location";
import { useLocationStore } from "@/stores/useLocationStore";
import { useEventBroker } from "@/hooks/useEventBroker";
import { BaseEvent, EventTypes } from "@/services/EventBroker";
import { Alert } from "react-native";
import { useUserLocationStore } from "@/stores/useUserLocationStore";

export const useUserLocation = () => {
  const { userLocation, setUserLocation, setLocationPermissionGranted, setIsLoadingLocation } =
    useUserLocationStore();

  const { publish } = useEventBroker();

  // Function to refresh the user's location
  const refreshUserLocation = async (options?: Location.LocationOptions) => {
    try {
      setIsLoadingLocation(true);

      // Use any provided options or fall back to high accuracy
      const locationOptions = options || {
        accuracy: Location.Accuracy.High,
      };

      // Get current location
      const location = await Location.getCurrentPositionAsync(locationOptions);

      // Update state with user coordinates in [longitude, latitude] format for Mapbox
      const userCoords: [number, number] = [location.coords.longitude, location.coords.latitude];
      setUserLocation(userCoords);

      // Emit user location updated event
      publish<BaseEvent & { coordinates: [number, number] }>(EventTypes.USER_LOCATION_UPDATED, {
        timestamp: Date.now(),
        source: "useUserLocation",
        coordinates: userCoords,
      });

      return userCoords;
    } catch (error) {
      console.error("Error refreshing location:", error);

      // Only show alert if we don't already have a location
      if (!userLocation) {
        Alert.alert(
          "Location Error",
          "Couldn't update your location. Using the last known location instead.",
          [{ text: "OK" }]
        );
      }

      // Emit error event
      publish<BaseEvent & { error: string }>(EventTypes.ERROR_OCCURRED, {
        timestamp: Date.now(),
        source: "useUserLocation",
        error: "Failed to refresh user location",
      });

      return userLocation;
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Function to request permission and get initial location
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocationPermissionGranted(false);
        return false;
      }

      setLocationPermissionGranted(true);
      return true;
    } catch (error) {
      console.error("Error requesting location permission:", error);
      setLocationPermissionGranted(false);
      return false;
    }
  };

  return {
    userLocation,
    refreshUserLocation,
    requestLocationPermission,
  };
};
