import React, { useEffect, useRef, memo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Mapbox from "@rnmapbox/maps";

// 3D map camera configuration
const CAMERA_UPDATE_INTERVAL = 16; // ms (approximately 60fps for smoother animation)
const BASE_PITCH = 60; // High pitch angle for 3D effect
const BASE_ZOOM = 15; // Closer zoom for urban detail
const BASE_BEARING = 45; // Angled view for better 3D perspective

// Default locations for camera to move between
const LOCATIONS = [
  { center: [-122.4194, 37.7749], name: "San Francisco" }, // San Francisco
  { center: [-74.006, 40.7128], name: "New York" }, // New York
  { center: [-0.1278, 51.5074], name: "London" }, // London
  { center: [139.6917, 35.6895], name: "Tokyo" }, // Tokyo
  { center: [2.3522, 48.8566], name: "Paris" }, // Paris
  { center: [28.9784, 41.0082], name: "Istanbul" }, // Istanbul
  { center: [121.4737, 31.2304], name: "Shanghai" }, // Shanghai
  { center: [77.1025, 28.7041], name: "Delhi" }, // Delhi
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
  // Refs
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Animation control refs
  const animationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const currentLocationIndexRef = useRef(0);
  const transitioningRef = useRef(false);

  // Camera state refs
  const zoomRef = useRef(BASE_ZOOM);
  const pitchRef = useRef(BASE_PITCH);
  const bearingRef = useRef(BASE_BEARING);
  const centerRef = useRef(LOCATIONS[0].center);

  // Mounted ref to prevent memory leaks
  const isMountedRef = useRef(true);

  // Store initial settings in a ref to avoid dependency changes
  const initialSettingsRef = useRef(settings);

  // Set up 3D map animation once and only once
  useEffect(() => {
    // Use the initial settings captured on first render
    const currentSettings = initialSettingsRef.current;

    // First update to establish initial position
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: LOCATIONS[0].center,
        zoomLevel: BASE_ZOOM,
        pitch: BASE_PITCH,
        animationDuration: 0,
      });
    }

    // Animation timing
    const LOCATION_DURATION = 30000; // Stay at each location for 30 seconds
    const TRANSITION_DURATION = 10000; // Transition between locations over 10 seconds
    let lastLocationChange = 0;

    // Start the animation at high framerate
    animationIntervalRef.current = setInterval(() => {
      // Skip animation updates if component is unmounting
      if (!isMountedRef.current || !cameraRef.current) return;

      // Increment time reference
      timeRef.current += CAMERA_UPDATE_INTERVAL;

      // Calculate elapsed time since last location change
      const elapsedSinceLocationChange = timeRef.current - lastLocationChange;

      // Check if it's time to move to a new location
      if (elapsedSinceLocationChange >= LOCATION_DURATION && !transitioningRef.current) {
        // Start transition to next location
        transitioningRef.current = true;

        // Update to next location
        const nextLocationIndex = (currentLocationIndexRef.current + 1) % LOCATIONS.length;
        const nextLocation = LOCATIONS[nextLocationIndex];

        // Log transition (remove in production)
        console.log(`Transitioning to ${nextLocation.name}`);

        // Update reference
        currentLocationIndexRef.current = nextLocationIndex;

        // Reset transition timer
        lastLocationChange = timeRef.current;
      }

      // Handle active transition
      if (transitioningRef.current) {
        const transitionProgress = elapsedSinceLocationChange / TRANSITION_DURATION;

        // End transition when complete
        if (transitionProgress >= 1) {
          transitioningRef.current = false;
        } else {
          // Calculate transition parameters
          const currentLocation = LOCATIONS[currentLocationIndexRef.current];
          const prevIndex =
            (currentLocationIndexRef.current - 1 + LOCATIONS.length) % LOCATIONS.length;
          const prevLocation = LOCATIONS[prevIndex];

          // Interpolate between locations
          const newCenter: [number, number] = [
            prevLocation.center[0] +
              (currentLocation.center[0] - prevLocation.center[0]) * transitionProgress,
            prevLocation.center[1] +
              (currentLocation.center[1] - prevLocation.center[1]) * transitionProgress,
          ];

          // Update center reference
          centerRef.current = newCenter;
        }
      }

      // Add subtle camera movements even when not transitioning

      // Subtle zoom breathing
      const zoomVariation = Math.sin(timeRef.current * 0.0003) * 0.2;
      zoomRef.current = BASE_ZOOM + zoomVariation;

      // Subtle pitch variation
      const pitchVariation = Math.sin(timeRef.current * 0.0002) * 3;
      pitchRef.current = BASE_PITCH + pitchVariation;

      // Subtle bearing rotation
      const bearingVariation = Math.sin(timeRef.current * 0.0001) * 5;
      bearingRef.current = BASE_BEARING + bearingVariation;

      // Apply micro movements to make the static locations feel alive
      if (!transitioningRef.current) {
        // Subtle coordinate variations around the center point
        const longitudeOffset = Math.sin(timeRef.current * 0.0002) * 0.002;
        const latitudeOffset = Math.cos(timeRef.current * 0.0003) * 0.002;

        centerRef.current = [
          LOCATIONS[currentLocationIndexRef.current].center[0] + longitudeOffset,
          LOCATIONS[currentLocationIndexRef.current].center[1] + latitudeOffset,
        ];
      }

      // Apply the camera update
      cameraRef.current.setCamera({
        centerCoordinate: centerRef.current,
        zoomLevel: zoomRef.current,
        pitch: pitchRef.current,
        animationDuration: CAMERA_UPDATE_INTERVAL, // Match interval for smooth motion
      });
    }, CAMERA_UPDATE_INTERVAL);

    // Cleanup for this specific effect
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once

  // Single cleanup effect when component unmounts
  useEffect(() => {
    // Set mounted flag to true initially
    isMountedRef.current = true;

    // Return cleanup function
    return () => {
      // Set mounted flag to false to prevent memory leaks
      isMountedRef.current = false;

      // Handle any Mapbox-specific cleanup if needed
      if (mapRef.current) {
        // Any Mapbox-specific cleanup could be done here if needed
      }

      // Ensure interval is cleared
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, []);

  // Use the initial settings captured on first render
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
    zIndex: -1, // Ensure it stays behind other elements
    position: "absolute",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(51, 51, 51, 0.7)", // Dark overlay that lets map details show through
  },
});

// Use React.memo to prevent re-renders when props haven't changed
// Combined with a custom comparison function to always return true,
// this effectively makes the component render only once
const AnimatedMapBackground = memo(
  AnimatedMapBackgroundComponent,
  () => true // This always returns true, meaning props are always considered equal
);

export default AnimatedMapBackground;
