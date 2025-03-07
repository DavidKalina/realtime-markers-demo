import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Mapbox from "@rnmapbox/maps";

// Globe camera configuration
const CAMERA_UPDATE_INTERVAL = 16; // ms (approximately 60fps for smoother animation)
const ROTATION_SPEED = 0.05; // Degrees per update for globe rotation
const PITCH_VARIATION = 10; // How much the pitch can vary from center
const BASE_PITCH = 45; // Increased base pitch for better globe view

// Default globe settings
const DEFAULT_LOCATION = {
  center: [0, 10], // Start more centered on the globe
  zoom: 1.4, // Zoomed out enough to see full globe
  styleURL: Mapbox.StyleURL.Dark,
};

interface AnimatedGlobeBackgroundProps {
  location?: {
    center: [number, number]; // [longitude, latitude]
    zoom: number;
    styleURL: string;
  };
}

const AnimatedGlobeBackground: React.FC<AnimatedGlobeBackgroundProps> = ({
  location = DEFAULT_LOCATION,
}) => {
  // Camera state
  const cameraPosition = {
    centerCoordinate: location.center,
    zoomLevel: location.zoom,
    pitch: BASE_PITCH,
    bearing: 0,
  };

  // Refs
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Animation control refs
  const globeAnimationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const bearingRef = useRef(0);
  const pitchRef = useRef(BASE_PITCH);

  // Mounted ref to prevent memory leaks
  const isMountedRef = useRef(true);

  // Set up continuous globe rotation
  useEffect(() => {
    // First update to establish initial position
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: location.center,
        zoomLevel: location.zoom,
        pitch: BASE_PITCH,
        animationDuration: 0,
      });
    }

    // For smoother movement, we'll use interpolation
    const INTERPOLATION_FACTOR = 0.03; // Lower = smoother but slower transitions

    // Start the globe animation at high framerate
    globeAnimationIntervalRef.current = setInterval(() => {
      // Skip animation updates if component is unmounting
      if (!isMountedRef.current || !cameraRef.current) return;

      // Increment time reference
      timeRef.current += CAMERA_UPDATE_INTERVAL;

      // Update bearing for continuous globe rotation (longitude)
      bearingRef.current = (bearingRef.current + ROTATION_SPEED) % 360;

      // Adjust zoom level with subtle breathing effect
      const zoomBreathing = Math.sin(timeRef.current * 0.0001) * 0.1;
      const newZoom = location.zoom + zoomBreathing;

      // Slightly vary pitch for more dynamic movement
      const pitchVariation = Math.sin(timeRef.current * 0.0002) * PITCH_VARIATION;
      pitchRef.current = BASE_PITCH + pitchVariation;

      // Gently move across latitudes (up and down the globe)
      const latitudeOffset = Math.sin(timeRef.current * 0.00015) * 15; // Move between -15 and +15 degrees latitude

      // Calculate new center position for the globe
      const newCenter: [number, number] = [
        // Adjust longitude as we rotate (smooth continuous movement around the globe)
        ((location.center[0] + timeRef.current * 0.0001) % 360) - 180,
        // Adjust latitude with sinusoidal pattern
        Math.max(-80, Math.min(80, location.center[1] + latitudeOffset)),
      ];

      // Apply the camera update with very short animation duration for smoothness
      cameraRef.current.setCamera({
        centerCoordinate: newCenter,
        zoomLevel: newZoom,
        pitch: pitchRef.current,
        animationDuration: CAMERA_UPDATE_INTERVAL, // Match interval for smooth motion
      });
    }, CAMERA_UPDATE_INTERVAL);

    // Cleanup for this specific effect
    return () => {
      if (globeAnimationIntervalRef.current) {
        clearInterval(globeAnimationIntervalRef.current);
        globeAnimationIntervalRef.current = null;
      }
    };
  }, [location]);

  // Single cleanup effect when component unmounts
  useEffect(() => {
    // Set mounted flag to true initially
    isMountedRef.current = true;

    // Return cleanup function
    return () => {
      // Set mounted flag to false to prevent memory leaks
      isMountedRef.current = false;

      // Handle any Mapbox-specific cleanup if needed
      // (Research suggests Mapbox components should clean up automatically,
      // but explicitly setting refs to null can help with garbage collection)
      if (mapRef.current) {
        // Any Mapbox-specific cleanup could be done here if needed
      }

      // This is redundant as the location effect should handle it, but kept as a safeguard
      if (globeAnimationIntervalRef.current) {
        clearInterval(globeAnimationIntervalRef.current);
        globeAnimationIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        scaleBarEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        ref={mapRef}
        style={styles.map}
        styleURL={location.styleURL}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // For globe projection
        projection="globe"
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={cameraPosition.zoomLevel}
          pitch={cameraPosition.pitch}
          centerCoordinate={cameraPosition.centerCoordinate}
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
    backgroundColor: "rgba(20, 20, 30, 0.75)", // Slightly darker overlay with blue tint for space feel
  },
});

export default AnimatedGlobeBackground;
