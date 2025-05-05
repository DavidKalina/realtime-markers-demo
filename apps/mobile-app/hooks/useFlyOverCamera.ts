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
  const getSmoothValue = (min: number, max: number, time: number, speed: number) => {
    const range = max - min;
    const offset = (Math.sin(time * speed) + 1) / 2; // Normalize to 0-1
    return min + range * offset;
  };

  // Helper function to get smooth circular coordinates
  const getSmoothCoordinates = (
    center: [number, number],
    time: number,
    speed: number,
    radius: number = 0.0005
  ): [number, number] => {
    const [lon, lat] = center;
    const angle = time * speed;

    return [lon + Math.cos(angle) * radius, lat + Math.sin(angle) * radius];
  };

  const flyOver = useCallback(
    (coordinates: [number, number], options: FlyOverOptions = {}) => {
      if (!cameraRef.current) return;

      const {
        duration = 2000,
        minPitch = 45,
        maxPitch = 75,
        minZoom = 15,
        maxZoom = 17,
        minBearing = -30,
        maxBearing = 30,
        speed = 0.5,
      } = options;

      coordinatesRef.current = coordinates;
      isAnimatingRef.current = true;
      lastUpdateTimeRef.current = performance.now();

      const animate = (currentTime: number) => {
        if (!isAnimatingRef.current || !cameraRef.current || !coordinatesRef.current) return;

        const deltaTime = (currentTime - lastUpdateTimeRef.current) / 1000; // Convert to seconds
        timeRef.current += deltaTime;
        lastUpdateTimeRef.current = currentTime;

        const randomCoordinates = getSmoothCoordinates(
          coordinatesRef.current,
          timeRef.current,
          speed
        );

        const randomPitch = getSmoothValue(minPitch, maxPitch, timeRef.current, speed * 0.7);
        const randomZoom = getSmoothValue(minZoom, maxZoom, timeRef.current, speed * 0.5);
        const randomBearing = getSmoothValue(minBearing, maxBearing, timeRef.current, speed * 0.3);

        cameraRef.current.setCamera({
          centerCoordinate: randomCoordinates,
          zoomLevel: randomZoom,
          pitch: randomPitch,
          heading: randomBearing,
          animationDuration: 0, // No animation duration for continuous movement
        });

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      // Start the animation loop
      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [cameraRef]
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
