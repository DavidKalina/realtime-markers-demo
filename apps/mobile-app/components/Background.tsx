import React, { useEffect, useRef, memo, useState } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Mapbox from "@rnmapbox/maps";

// 3D map camera configuration - Adjusted for better performance
const CAMERA_UPDATE_INTERVAL = Platform.select({ ios: 16, android: 32 }) ?? 32; // Reduced frequency on Android
const ANIMATION_BATCH_SIZE = 3; // Number of frames to skip between major updates
const BASE_PITCH = 60;
const BASE_ZOOM = 15;
const BASE_BEARING = 45;

// Animation timing constants
const INITIAL_DELAY = 1000; // Wait 1 second before starting animations
const LOCATION_DURATION = 30000;
const TRANSITION_DURATION = 10000;

// Default locations for camera to move between
const LOCATIONS = [
  { center: [-122.4194, 37.7749], name: "San Francisco" },
  { center: [-74.006, 40.7128], name: "New York" },
  { center: [-0.1278, 51.5074], name: "London" },
  { center: [139.6917, 35.6895], name: "Tokyo" },
  { center: [2.3522, 48.8566], name: "Paris" },
  { center: [28.9784, 41.0082], name: "Istanbul" },
  { center: [121.4737, 31.2304], name: "Shanghai" },
  { center: [77.1025, 28.7041], name: "Delhi" },
];

// Default style settings
const DEFAULT_SETTINGS = {
  styleURL: Mapbox.StyleURL.Dark,
};

interface AnimatedMapBackgroundProps {
  settings?: {
    styleURL: string;
  };
}

// The actual component implementation
const AnimatedMapBackgroundComponent: React.FC<AnimatedMapBackgroundProps> = ({
  settings = DEFAULT_SETTINGS,
}) => {
  // Component state
  const [isMapReady, setIsMapReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const frameCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());

  // Animation control refs
  const animationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeRef = useRef(0);
  const currentLocationIndexRef = useRef(0);
  const transitioningRef = useRef(false);
  const isPerformingUpdateRef = useRef(false);

  // Camera state refs
  const zoomRef = useRef(BASE_ZOOM);
  const pitchRef = useRef(BASE_PITCH);
  const bearingRef = useRef(BASE_BEARING);
  const centerRef = useRef(LOCATIONS[0].center);

  // Mounted ref to prevent memory leaks
  const isMountedRef = useRef(true);

  // Store initial settings in a ref to avoid dependency changes
  const initialSettingsRef = useRef(settings);

  // Handle map ready state
  const handleMapReady = () => {
    if (!isMountedRef.current) return;
    setIsMapReady(true);
  };

  // Throttled camera update function
  const updateCamera = (force = false) => {
    if (!isMountedRef.current || !cameraRef.current || isPerformingUpdateRef.current || !isInitialized) {
      return;
    }

    frameCountRef.current++;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    // Only update if forced, enough frames have passed, or enough time has elapsed
    if (!force && frameCountRef.current % ANIMATION_BATCH_SIZE !== 0 && timeSinceLastUpdate < 100) {
      return;
    }

    isPerformingUpdateRef.current = true;

    try {
      cameraRef.current.setCamera({
        centerCoordinate: centerRef.current,
        zoomLevel: zoomRef.current,
        pitch: pitchRef.current,
        animationDuration: CAMERA_UPDATE_INTERVAL,
      });
    } catch (error) {
      console.warn('Camera update failed:', error);
    } finally {
      isPerformingUpdateRef.current = false;
      lastUpdateTimeRef.current = now;
      frameCountRef.current = 0;
    }
  };

  // Initialize map and camera
  useEffect(() => {
    if (!isMapReady || !isMountedRef.current) return;

    // Set initial camera position
    if (cameraRef.current) {
      try {
        cameraRef.current.setCamera({
          centerCoordinate: LOCATIONS[0].center,
          zoomLevel: BASE_ZOOM,
          pitch: BASE_PITCH,
          animationDuration: 0,
        });
      } catch (error) {
        console.warn('Initial camera setup failed:', error);
      }
    }

    // Wait for initial delay before starting animations
    initializationTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsInitialized(true);
      }
    }, INITIAL_DELAY);

    return () => {
      if (initializationTimerRef.current) {
        clearTimeout(initializationTimerRef.current);
        initializationTimerRef.current = null;
      }
    };
  }, [isMapReady]);

  // Set up animation loop
  useEffect(() => {
    if (!isInitialized || !isMountedRef.current) return;

    let lastLocationChange = 0;

    animationIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) {
        if (animationIntervalRef.current) {
          clearInterval(animationIntervalRef.current);
          animationIntervalRef.current = null;
        }
        return;
      }

      timeRef.current += CAMERA_UPDATE_INTERVAL;
      const elapsedSinceLocationChange = timeRef.current - lastLocationChange;

      // Check if it's time to move to a new location
      if (elapsedSinceLocationChange >= LOCATION_DURATION && !transitioningRef.current) {
        transitioningRef.current = true;
        const nextLocationIndex = (currentLocationIndexRef.current + 1) % LOCATIONS.length;
        currentLocationIndexRef.current = nextLocationIndex;
        lastLocationChange = timeRef.current;
      }

      // Handle active transition
      if (transitioningRef.current) {
        const transitionProgress = elapsedSinceLocationChange / TRANSITION_DURATION;

        if (transitionProgress >= 1) {
          transitioningRef.current = false;
        } else {
          const currentLocation = LOCATIONS[currentLocationIndexRef.current];
          const prevIndex = (currentLocationIndexRef.current - 1 + LOCATIONS.length) % LOCATIONS.length;
          const prevLocation = LOCATIONS[prevIndex];

          centerRef.current = [
            prevLocation.center[0] + (currentLocation.center[0] - prevLocation.center[0]) * transitionProgress,
            prevLocation.center[1] + (currentLocation.center[1] - prevLocation.center[1]) * transitionProgress,
          ];
        }
      }

      // Subtle animations with reduced intensity
      zoomRef.current = BASE_ZOOM + Math.sin(timeRef.current * 0.0002) * 0.15;
      pitchRef.current = BASE_PITCH + Math.sin(timeRef.current * 0.0001) * 2;
      bearingRef.current = BASE_BEARING + Math.sin(timeRef.current * 0.00005) * 3;

      if (!transitioningRef.current) {
        const longitudeOffset = Math.sin(timeRef.current * 0.0001) * 0.001;
        const latitudeOffset = Math.cos(timeRef.current * 0.00015) * 0.001;

        centerRef.current = [
          LOCATIONS[currentLocationIndexRef.current].center[0] + longitudeOffset,
          LOCATIONS[currentLocationIndexRef.current].center[1] + latitudeOffset,
        ];
      }

      updateCamera();
    }, CAMERA_UPDATE_INTERVAL);

    return () => {
      isMountedRef.current = false;

      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }

      if (initializationTimerRef.current) {
        clearTimeout(initializationTimerRef.current);
        initializationTimerRef.current = null;
      }

      // Reset all refs
      timeRef.current = 0;
      frameCountRef.current = 0;
      lastUpdateTimeRef.current = 0;
      transitioningRef.current = false;
      isPerformingUpdateRef.current = false;
      currentLocationIndexRef.current = 0;

      // Reset camera values
      zoomRef.current = BASE_ZOOM;
      pitchRef.current = BASE_PITCH;
      bearingRef.current = BASE_BEARING;
      centerRef.current = LOCATIONS[0].center;

      // Force final update to reset camera
      if (cameraRef.current) {
        try {
          cameraRef.current.setCamera({
            centerCoordinate: LOCATIONS[0].center,
            zoomLevel: BASE_ZOOM,
            pitch: BASE_PITCH,
            animationDuration: 0,
          });
        } catch (error) {
          console.warn('Final camera reset failed:', error);
        }
      }
    };
  }, [isInitialized]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Set mounted flag to false first to prevent any new operations
      isMountedRef.current = false;

      // Clear all timers and intervals
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }

      if (initializationTimerRef.current) {
        clearTimeout(initializationTimerRef.current);
        initializationTimerRef.current = null;
      }

      // Reset all animation and state refs
      timeRef.current = 0;
      frameCountRef.current = 0;
      lastUpdateTimeRef.current = 0;
      transitioningRef.current = false;
      isPerformingUpdateRef.current = false;
      currentLocationIndexRef.current = 0;

      // Reset camera values
      zoomRef.current = BASE_ZOOM;
      pitchRef.current = BASE_PITCH;
      centerRef.current = LOCATIONS[0].center;

      // Reset camera to initial position with no animation
      if (cameraRef.current) {
        try {
          cameraRef.current.setCamera({
            centerCoordinate: LOCATIONS[0].center,
            zoomLevel: BASE_ZOOM,
            pitch: BASE_PITCH,
            animationDuration: 0,
          });
        } catch (error) {
          console.warn('Final camera reset failed:', error);
        }
      }

      // Clean up map resources
      if (mapRef.current) {
        try {
          // Remove any listeners or custom layers if they exist
          mapRef.current.setCamera = () => { }; // Nullify the function to prevent late calls
        } catch (error) {
          console.warn('Map cleanup failed:', error);
        }
      }

      // Force a state reset
      setIsMapReady(false);
      setIsInitialized(false);
    };
  }, []);

  const currentSettings = initialSettingsRef.current;

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        scaleBarEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        ref={mapRef}
        style={styles.map}
        styleURL={currentSettings.styleURL}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onDidFinishLoadingMap={handleMapReady}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={BASE_ZOOM}
          pitch={BASE_PITCH}
          centerCoordinate={LOCATIONS[0].center}
          animationMode="easeTo"
          animationDuration={CAMERA_UPDATE_INTERVAL}
        />
      </Mapbox.MapView>

      <View style={styles.overlay} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    position: "absolute",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(51, 51, 51, 0.7)",
  },
});

const AnimatedMapBackground = memo(
  AnimatedMapBackgroundComponent,
  () => true
);

export default AnimatedMapBackground;
