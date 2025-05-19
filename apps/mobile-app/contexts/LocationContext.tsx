import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes, BaseEvent } from "@/services/EventBroker";
import MapboxGL from "@rnmapbox/maps";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define the event types
interface UserLocationEvent extends BaseEvent {
  coordinates: [number, number];
}

// Define the cached location type
interface CachedLocation {
  coordinates: [number, number];
  timestamp: number;
}

// Define the context type
type LocationContextType = {
  // User location state
  userLocation: [number, number] | null;

  // Location permission state
  locationPermissionGranted: boolean;

  // Location loading state
  isLoadingLocation: boolean;

  // Get user location method
  getUserLocation: () => Promise<void>;

  // Start foreground location tracking
  startLocationTracking: () => Promise<void>;

  // Stop foreground location tracking
  stopLocationTracking: () => void;

  // Is actively tracking location
  isTrackingLocation: boolean;
};

// Create the context with default values
const LocationContext = createContext<LocationContextType | null>(null);

// Props for the provider component
type LocationProviderProps = {
  children: ReactNode;
};

// Create the provider component
export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  // State for user location
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );

  // State for location permissions
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState<boolean>(false);

  // State for loading status
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);

  // State for tracking if we have an active subscription
  const [locationSubscription, setLocationSubscription] =
    useState<Location.LocationSubscription | null>(null);

  // Get the event broker
  const { publish } = useEventBroker();

  // Load cached location on mount
  const loadCachedLocation = useCallback(async () => {
    try {
      console.log("[LocationContext] Attempting to load cached location...");
      const cachedLocationStr = await AsyncStorage.getItem("cachedLocation");
      console.log(
        "[LocationContext] Raw cached location string:",
        cachedLocationStr,
      );

      if (cachedLocationStr) {
        try {
          const cachedLocation: CachedLocation = JSON.parse(cachedLocationStr);
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          const isCacheValid = cachedLocation.timestamp > oneHourAgo;

          // Additional validation for physical devices
          const isValidCoordinates =
            Array.isArray(cachedLocation.coordinates) &&
            cachedLocation.coordinates.length === 2 &&
            typeof cachedLocation.coordinates[0] === "number" &&
            typeof cachedLocation.coordinates[1] === "number" &&
            !isNaN(cachedLocation.coordinates[0]) &&
            !isNaN(cachedLocation.coordinates[1]);

          console.log("[LocationContext] Parsed cached location:", {
            hasCache: true,
            cacheAge:
              Math.round((Date.now() - cachedLocation.timestamp) / 1000 / 60) +
              " minutes",
            isValid: isCacheValid,
            isValidCoordinates,
            coordinates: cachedLocation.coordinates,
            timestamp: new Date(cachedLocation.timestamp).toISOString(),
          });

          if (isCacheValid && isValidCoordinates) {
            // Batch state updates together
            Promise.all([
              new Promise<void>((resolve) => {
                setUserLocation(cachedLocation.coordinates);
                resolve();
              }),
              new Promise<void>((resolve) => {
                setLocationPermissionGranted(true);
                resolve();
              }),
            ]).then(() => {
              publish<UserLocationEvent>(EventTypes.USER_LOCATION_UPDATED, {
                timestamp: Date.now(),
                source: "LocationContext",
                coordinates: cachedLocation.coordinates,
              });
            });
            return true;
          } else {
            console.log("[LocationContext] Cache is invalid:", {
              isCacheValid,
              isValidCoordinates,
              reason: !isCacheValid ? "Cache expired" : "Invalid coordinates",
            });
          }
        } catch (parseError) {
          console.error(
            "[LocationContext] Error parsing cached location:",
            parseError,
          );
        }
      } else {
        console.log(
          "[LocationContext] No cached location found in AsyncStorage",
        );
      }
      return false;
    } catch (error) {
      console.error("[LocationContext] Error loading cached location:", error);
      return false;
    }
  }, [publish]);

  useEffect(() => {
    loadCachedLocation();
  }, [loadCachedLocation]);

  // Cache location when it's updated
  const cacheLocation = useCallback(async (coordinates: [number, number]) => {
    try {
      // Validate coordinates before caching
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number" ||
        isNaN(coordinates[0]) ||
        isNaN(coordinates[1])
      ) {
        console.error(
          "[LocationContext] Invalid coordinates received:",
          coordinates,
        );
        return;
      }

      const cachedLocation: CachedLocation = {
        coordinates,
        timestamp: Date.now(),
      };
      const locationString = JSON.stringify(cachedLocation);
      console.log("[LocationContext] Attempting to cache location:", {
        coordinates,
        timestamp: new Date(cachedLocation.timestamp).toISOString(),
        stringLength: locationString.length,
      });

      await AsyncStorage.setItem("cachedLocation", locationString);

      // Verify the cache was written
      const verifyCache = await AsyncStorage.getItem("cachedLocation");
      console.log("[LocationContext] Cache verification:", {
        success: verifyCache !== null,
        cached: verifyCache === locationString,
        verificationTimestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[LocationContext] Error caching location:", error);
    }
  }, []);

  // Get user location function - using useCallback to memoize the function
  const getUserLocation = useCallback(async () => {
    try {
      setIsLoadingLocation(true);
      console.log("[LocationContext] Requesting new location...");

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("[LocationContext] Location permission denied");
        setLocationPermissionGranted(false);
        Alert.alert(
          "Permission Denied",
          "Allow location access to center the map on your position.",
          [{ text: "OK" }],
        );
        return;
      }

      setLocationPermissionGranted(true);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Location request timed out")),
          15000,
        );
      });

      try {
        // First try Expo Location
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const location: any = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          timeoutPromise,
        ]);

        const userCoords: [number, number] = [
          location.coords.longitude,
          location.coords.latitude,
        ];
        setUserLocation(userCoords);
        await cacheLocation(userCoords);

        publish<UserLocationEvent>(EventTypes.USER_LOCATION_UPDATED, {
          timestamp: Date.now(),
          source: "LocationContext",
          coordinates: userCoords,
        });
      } catch (expoError) {
        console.warn("Expo location failed, trying Mapbox:", expoError);

        // Fallback to Mapbox location
        try {
          const mapboxLocation =
            await MapboxGL.locationManager.getLastKnownLocation();

          if (mapboxLocation) {
            const userCoords: [number, number] = [
              mapboxLocation.coords.longitude,
              mapboxLocation.coords.latitude,
            ];
            setUserLocation(userCoords);
            await cacheLocation(userCoords);

            publish<UserLocationEvent>(EventTypes.USER_LOCATION_UPDATED, {
              timestamp: Date.now(),
              source: "LocationContext",
              coordinates: userCoords,
            });
          } else {
            throw new Error("No location available from Mapbox");
          }
        } catch (mapboxError) {
          console.error("Both location services failed:", {
            expoError,
            mapboxError,
          });
          throw new Error("Failed to get location from both services");
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);

      // Check if it's a timeout error
      const errorMessage =
        error instanceof Error && error.message === "Location request timed out"
          ? "Location request timed out. Using default location instead."
          : "Couldn't determine your location. Using default location instead.";

      Alert.alert("Location Error", errorMessage, [{ text: "OK" }]);

      // Emit error event
      publish<BaseEvent & { error: string }>(EventTypes.ERROR_OCCURRED, {
        timestamp: Date.now(),
        source: "LocationContext",
        error: `Failed to get user location: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      });
    } finally {
      setIsLoadingLocation(false);
    }
  }, [publish, cacheLocation]);

  // Function to start foreground location tracking - using useCallback
  const startLocationTracking = useCallback(async () => {
    // If we already have a subscription, no need to create another one
    if (locationSubscription) {
      return;
    }

    try {
      // Make sure we have permission first
      if (!locationPermissionGranted) {
        await getUserLocation();
        if (!locationPermissionGranted) {
          // If getUserLocation didn't successfully get permission, return
          return;
        }
      }

      // Start the location subscription
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10, // Update when the user moves at least 10 meters
          timeInterval: 5000, // Or update every 5 seconds, whichever comes first
        },
        (location) => {
          const userCoords: [number, number] = [
            location.coords.longitude,
            location.coords.latitude,
          ];

          // Update local state
          setUserLocation(userCoords);

          // Publish event for other components to react to
          publish<UserLocationEvent>(EventTypes.USER_LOCATION_UPDATED, {
            timestamp: Date.now(),
            source: "LocationContext",
            coordinates: userCoords,
          });
        },
      );

      // Save the subscription so we can remove it later
      setLocationSubscription(subscription);
    } catch (error) {
      console.error("Error starting location tracking:", error);

      // Publish error event
      publish<BaseEvent & { error: string }>(EventTypes.ERROR_OCCURRED, {
        timestamp: Date.now(),
        source: "LocationContext",
        error: `Failed to start location tracking: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      });
    }
  }, [
    locationSubscription,
    locationPermissionGranted,
    getUserLocation,
    publish,
  ]);

  // Function to stop foreground location tracking - using useCallback
  const stopLocationTracking = useCallback(() => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
  }, [locationSubscription]);

  // Clean up subscription when the component unmounts
  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
    };
  }, [locationSubscription]);

  // Request location permissions when the component mounts
  useEffect(() => {
    let isMounted = true;

    const initLocation = async () => {
      if (isMounted) {
        const hasValidCache = await loadCachedLocation();
        if (!hasValidCache) {
          await getUserLocation();
        }
      }
    };

    initLocation();

    return () => {
      isMounted = false;
    };
  }, [getUserLocation, loadCachedLocation]);

  // Create the context value object using useMemo to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      userLocation,
      locationPermissionGranted,
      isLoadingLocation,
      getUserLocation,
      startLocationTracking,
      stopLocationTracking,
      isTrackingLocation: locationSubscription !== null,
    }),
    [
      userLocation,
      locationPermissionGranted,
      isLoadingLocation,
      getUserLocation,
      startLocationTracking,
      stopLocationTracking,
      locationSubscription,
    ],
  );

  // Provide the context to child components
  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use the location context
export const useUserLocation = () => {
  const context = useContext(LocationContext);

  if (context === null) {
    throw new Error("useUserLocation must be used within a LocationProvider");
  }

  return context;
};
