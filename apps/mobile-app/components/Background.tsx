import React, { useEffect, useRef, memo, useState } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Mapbox from "@rnmapbox/maps";

// 3D map camera configuration - Adjusted for better performance
const CAMERA_UPDATE_INTERVAL = Platform.select({ ios: 32, android: 64 }) ?? 64; // Further reduced frequency
const ANIMATION_BATCH_SIZE = 5; // Increased batch size to reduce updates
const BASE_PITCH = 60;
const BASE_ZOOM = 15;
const BASE_BEARING = 45;

// Animation timing constants
const INITIAL_DELAY = 2000; // Increased initial delay
const LOCATION_DURATION = 45000; // Increased duration for smoother transitions
const TRANSITION_DURATION = 15000; // Increased duration for smoother transitions

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

    // Clear any existing intervals
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
    }

    // Initialize camera with current values
    updateCamera();

    // Start animation loop with increased interval
    animationIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;

      // Skip frames based on batch size
      frameCountRef.current++;
      if (frameCountRef.current % ANIMATION_BATCH_SIZE !== 0) {
        return;
      }

      // Update time reference
      const currentTime = Date.now();
      const deltaTime = currentTime - lastUpdateTimeRef.current;
      lastUpdateTimeRef.current = currentTime;
      timeRef.current += deltaTime;

      // Check if it's time to transition to a new location
      if (timeRef.current >= LOCATION_DURATION && !transitioningRef.current) {
        transitioningRef.current = true;
        currentLocationIndexRef.current = (currentLocationIndexRef.current + 1) % LOCATIONS.length;

        // Reset time after transition
        timeRef.current = 0;
        transitioningRef.current = false;
      }

      // Calculate new camera position
      if (!transitioningRef.current) {
        const longitudeOffset = Math.sin(timeRef.current * 0.00005) * 0.0005; // Reduced movement range
        const latitudeOffset = Math.cos(timeRef.current * 0.000075) * 0.0005; // Reduced movement range

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
      // Prevent any new operations first
      isMountedRef.current = false;

      // Safely clear timers
      if (animationIntervalRef.current) {
        try {
          clearInterval(animationIntervalRef.current);
        } catch (e) {
          console.warn('Failed to clear animation interval:', e);
        }
        animationIntervalRef.current = null;
      }

      if (initializationTimerRef.current) {
        try {
          clearTimeout(initializationTimerRef.current);
        } catch (e) {
          console.warn('Failed to clear initialization timer:', e);
        }
        initializationTimerRef.current = null;
      }

      // Safely reset all refs
      try {
        // Reset animation and state refs
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
      } catch (e) {
        console.warn('Failed to reset refs:', e);
      }

      // Safely reset camera
      if (cameraRef.current) {
        try {
          // Check if the camera methods are still available
          if (typeof cameraRef.current.setCamera === 'function') {
            cameraRef.current.setCamera({
              centerCoordinate: LOCATIONS[0].center,
              zoomLevel: BASE_ZOOM,
              pitch: BASE_PITCH,
              animationDuration: 0,
            });
          }
        } catch (error) {
          console.warn('Camera reset failed, this is normal during unmount:', error);
        }
      }

      // Safely clean up map
      if (mapRef.current) {
        try {
          // Let the natural cleanup process handle the map disposal
          // We don't manually modify the map instance to avoid potential crashes
        } catch (error) {
          console.warn('Map cleanup failed, this is normal during unmount:', error);
        }
      }

      // Safely reset state
      try {
        setIsMapReady(false);
        setIsInitialized(false);
      } catch (e) {
        console.warn('State cleanup failed, this is normal during unmount:', e);
      }
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
