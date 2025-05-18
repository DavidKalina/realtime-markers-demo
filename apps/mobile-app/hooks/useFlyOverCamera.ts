import { useCallback, useRef, useEffect } from "react";
import { Camera } from "@rnmapbox/maps";

interface FlyOverOptions {
  duration?: number;
  minPitch?: number;
  maxPitch?: number;
  minZoom?: number;
  maxZoom?: number;
  minBearing?: number;
  maxBearing?: number;
  speed?: number;
}

interface UseFlyOverCameraProps {
  cameraRef: React.RefObject<Camera>;
}

export const useFlyOverCamera = ({ cameraRef }: UseFlyOverCameraProps) => {
  const isAnimatingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const coordinatesRef = useRef<[number, number] | null>(null);
  const timeRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);

  // Helper function to get smooth value between min and max using sine wave
  const getSmoothValue = (
    min: number,
    max: number,
    time: number,
    speed: number,
  ) => {
    const range = max - min;
    const offset = (Math.sin(time * speed) + 1) / 2; // Normalize to 0-1
    return min + range * offset;
  };

  // Helper function to calculate orbit position that always faces the marker
  const getOrbitPosition = (
    center: [number, number],
    time: number,
    speed: number,
    zoom: number,
  ): { position: [number, number]; bearing: number } => {
    // Calculate radius based on zoom level (closer zoom = smaller radius)
    const baseRadius = 0.0005; // Base radius at zoom level 15
    const zoomFactor = Math.pow(0.8, zoom - 15); // Adjust radius based on zoom
    const radius = baseRadius * zoomFactor;

    const angle = time * speed;
    const [lon, lat] = center;

    // Calculate new camera position
    const newLon = lon + Math.cos(angle) * radius;
    const newLat = lat + Math.sin(angle) * radius;

    // Calculate bearing to always face the marker
    const bearing = (Math.atan2(lon - newLon, lat - newLat) * 180) / Math.PI;

    return {
      position: [newLon, newLat],
      bearing: bearing,
    };
  };

  const flyOver = useCallback(
    (coordinates: [number, number], options: FlyOverOptions = {}) => {
      if (!cameraRef.current) return;

      const {
        duration = 2000,
        minPitch = 45,
        maxPitch = 60, // Reduced max pitch to keep marker more visible
        minZoom = 15,
        maxZoom = 17,
        minBearing = -180, // Allow full rotation
        maxBearing = 180,
        speed = 0.5,
      } = options;

      coordinatesRef.current = coordinates;
      isAnimatingRef.current = true;
      lastUpdateTimeRef.current = performance.now();

      const animate = (currentTime: number) => {
        if (
          !isAnimatingRef.current ||
          !cameraRef.current ||
          !coordinatesRef.current
        )
          return;

        const deltaTime = (currentTime - lastUpdateTimeRef.current) / 1000; // Convert to seconds
        timeRef.current += deltaTime;
        lastUpdateTimeRef.current = currentTime;

        // Get current zoom for radius calculation
        const zoom = getSmoothValue(
          minZoom,
          maxZoom,
          timeRef.current,
          speed * 0.5,
        );

        // Calculate orbit position and bearing
        const { position, bearing } = getOrbitPosition(
          coordinatesRef.current,
          timeRef.current,
          speed,
          zoom,
        );

        // Calculate pitch that keeps marker in view
        const pitch = getSmoothValue(
          minPitch,
          maxPitch,
          timeRef.current,
          speed * 0.7,
        );

        cameraRef.current.setCamera({
          centerCoordinate: position,
          zoomLevel: zoom,
          pitch: pitch,
          heading: bearing,
          animationDuration: 0, // No animation duration for continuous movement
        });

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      // Start the animation loop
      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [cameraRef],
  );

  // Cleanup function
  const stopFlyOver = useCallback(() => {
    isAnimatingRef.current = false;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    timeRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFlyOver();
    };
  }, [stopFlyOver]);

  return {
    flyOver,
    stopFlyOver,
    isAnimating: isAnimatingRef.current,
  };
};
