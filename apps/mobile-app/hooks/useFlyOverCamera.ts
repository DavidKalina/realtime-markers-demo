import { useCallback, useRef, useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
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
  const optionsRef = useRef<FlyOverOptions>({});
  const wasPausedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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
        minPitch = 45,
        maxPitch = 60, // Reduced max pitch to keep marker more visible
        minZoom = 15,
        maxZoom = 17,
        speed = 0.5,
      } = options;

      coordinatesRef.current = coordinates;
      optionsRef.current = options;
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

        try {
          cameraRef.current.setCamera({
            centerCoordinate: position,
            zoomLevel: zoom,
            pitch: pitch,
            heading: bearing,
            animationDuration: 0, // No animation duration for continuous movement
          });
        } catch {
          // Camera ref may be invalidated after background — stop gracefully
          isAnimatingRef.current = false;
          return;
        }

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

  // Pause animation (keeps time position so it can resume smoothly)
  const pauseFlyOver = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    isAnimatingRef.current = false;
  }, []);

  // Resume animation from where it left off
  const resumeFlyOver = useCallback(() => {
    if (!coordinatesRef.current || !cameraRef.current) return;
    isAnimatingRef.current = true;
    lastUpdateTimeRef.current = performance.now();

    const {
      minPitch = 45,
      maxPitch = 60,
      minZoom = 15,
      maxZoom = 17,
      speed = 0.5,
    } = optionsRef.current;

    const animate = (currentTime: number) => {
      if (
        !isAnimatingRef.current ||
        !cameraRef.current ||
        !coordinatesRef.current
      )
        return;

      const deltaTime = (currentTime - lastUpdateTimeRef.current) / 1000;
      timeRef.current += deltaTime;
      lastUpdateTimeRef.current = currentTime;

      const zoom = getSmoothValue(
        minZoom,
        maxZoom,
        timeRef.current,
        speed * 0.5,
      );

      const { position, bearing } = getOrbitPosition(
        coordinatesRef.current,
        timeRef.current,
        speed,
        zoom,
      );

      const pitch = getSmoothValue(
        minPitch,
        maxPitch,
        timeRef.current,
        speed * 0.7,
      );

      try {
        cameraRef.current.setCamera({
          centerCoordinate: position,
          zoomLevel: zoom,
          pitch: pitch,
          heading: bearing,
          animationDuration: 0,
        });
      } catch {
        // Camera ref may be invalidated after background — stop gracefully
        isAnimatingRef.current = false;
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [cameraRef]);

  // Pause/resume on app background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        const wasBackground =
          appStateRef.current === "background" ||
          appStateRef.current === "inactive";
        const isActive = nextAppState === "active";

        if (!isActive && appStateRef.current === "active") {
          // Going to background — pause immediately
          if (coordinatesRef.current) {
            wasPausedRef.current = true;
            pauseFlyOver();
          }
        } else if (isActive && wasBackground && wasPausedRef.current) {
          // Returning to foreground — resume after a brief delay to let the
          // native MapView re-initialize its GL context
          wasPausedRef.current = false;
          setTimeout(() => {
            if (coordinatesRef.current && cameraRef.current) {
              resumeFlyOver();
            }
          }, 500);
        }

        appStateRef.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [pauseFlyOver, resumeFlyOver, cameraRef]);

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
