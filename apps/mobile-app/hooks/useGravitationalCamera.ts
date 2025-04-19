// hooks/useGravitationalCamera.ts
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { throttle } from "lodash"; // Import throttle
import { Marker } from "@/hooks/useMapWebsocket";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  EventTypes,
  BaseEvent,
  CameraAnimateToLocationEvent,
  CameraAnimateToBoundsEvent,
} from "@/services/EventBroker";
import MapboxGL from "@rnmapbox/maps";
import {
  DEFAULT_CONFIG,
  GravitationConfig,
  ANIMATION_CONSTANTS,
} from "./gravitationalCameraConfig";
import {
  calculatePanningVelocity,
  findNearestMarker, // Assuming this iterates through markers
  needsCentering,
  getDistanceSquared,
} from "./gravitationalCameraUtils";
import { createPanningHandlers, createZoomingHandlers } from "./gravitationalCameraHandlers";

interface ViewportSample {
  center: {
    longitude: number;
    latitude: number;
  };
  timestamp: number;
}

export function useGravitationalCamera(markers: Marker[], config: Partial<GravitationConfig> = {}) {
  // --- Refs for Core Components & State ---
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const isAnimatingRef = useRef<boolean>(false); // Is the camera *currently* animating due to this hook or events?
  const isPullingRef = useRef<boolean>(false); // Is a gravitational pull animation *currently* in progress?
  const configRef = useRef<GravitationConfig>(DEFAULT_CONFIG); // Holds the merged config
  const markersRef = useRef<Marker[]>(markers); // Ref to access latest markers in throttled func

  // --- Configuration ---
  const gravitationConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  // Update config ref whenever memoized config changes
  useEffect(() => {
    configRef.current = gravitationConfig;
  }, [gravitationConfig]);
  // Update markers ref whenever markers array changes
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // --- Component State (for external feedback/control) ---
  const [isGravitatingEnabled, setIsGravitatingEnabled] = useState(true); // Can be toggled externally
  const [isGravitating, setIsGravitating] = useState(false); // True only during the pull animation
  const [isHighVelocity, setIsHighVelocity] = useState(false); // True only during a high-vel pull animation

  // --- Event Broker ---
  const { publish, subscribe } = useEventBroker();

  // --- Internal State Refs ---
  const lastPullTimeRef = useRef<number>(0); // Timestamp of last pull completion
  const didMountRef = useRef<boolean>(false); // Track initial mount
  const currentViewportRef = useRef<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const viewportSamplesRef = useRef<ViewportSample[]>([]); // For velocity calculation
  const isUserPanningRef = useRef<boolean>(false); // Is user actively panning right now?
  const panningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout for end of panning
  const currentZoomLevelRef = useRef<number | null>(null); // Current map zoom
  const isUserZoomingRef = useRef<boolean>(false); // Is user actively zooming right now?
  const zoomingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout for end of zooming

  // --- Utility Functions ---
  const getViewportCenter = useCallback((): { latitude: number; longitude: number } | null => {
    if (!currentViewportRef.current) return null;
    const { north, south, east, west } = currentViewportRef.current;
    return { latitude: (north + south) / 2, longitude: (east + west) / 2 };
  }, []);

  // --- User Interaction Handlers ---
  const { handlePanningStart, handlePanningEnd } = useMemo(
    () => createPanningHandlers(isUserPanningRef, panningTimeoutRef, viewportSamplesRef),
    [] // These handlers have no external dependencies
  );
  const { handleZoomingStart, handleZoomingEnd } = useMemo(
    () => createZoomingHandlers(isUserZoomingRef, zoomingTimeoutRef),
    [] // These handlers have no external dependencies
  );

  // --- Core Logic: Function to trigger the animation ---
  const triggerGravitationalPullAnimation = useCallback(
    (targetCoordinates: [number, number], isCluster: boolean) => {
      const config = configRef.current;
      if (!cameraRef.current) return; // Camera must exist

      isPullingRef.current = true;
      isAnimatingRef.current = true; // Mark as animating
      setIsGravitating(true); // Update state for external feedback

      // Calculate velocity and determine duration
      const velocity = calculatePanningVelocity(
        viewportSamplesRef.current,
        config.velocityMeasurementWindow
      );
      const isHighVelocityPan = velocity >= config.highVelocityThreshold;
      setIsHighVelocity(isHighVelocityPan); // Update state
      const animationDuration = isHighVelocityPan
        ? config.highVelocityAnimationDuration
        : config.animationDuration;

      // Publish start event
      publish<
        BaseEvent & { target: [number, number]; isHighVelocity: boolean; isCluster: boolean }
      >(EventTypes.GRAVITATIONAL_PULL_STARTED, {
        timestamp: Date.now(),
        source: "GravitationalCamera",
        target: targetCoordinates,
        isHighVelocity: isHighVelocityPan,
        isCluster,
      });

      // Execute camera animation
      cameraRef.current.setCamera({
        centerCoordinate: targetCoordinates,
        animationDuration: animationDuration,
        animationMode: config.gravityAnimationMode,
        // Consider adding zoom level adjustment here if needed based on nearestItem type or distance
        // zoomLevel: determineZoomLevel(...), // If you reintroduce this logic
      });

      // Setup completion timeout
      setTimeout(() => {
        isPullingRef.current = false;
        setIsGravitating(false);
        setIsHighVelocity(false);
        lastPullTimeRef.current = Date.now(); // Update cooldown timer *after* animation
        isAnimatingRef.current = false; // Allow other animations/checks

        publish<BaseEvent>(EventTypes.GRAVITATIONAL_PULL_COMPLETED, {
          timestamp: Date.now(),
          source: "GravitationalCamera",
        });
      }, animationDuration + ANIMATION_CONSTANTS.ANIMATION_BUFFER); // Buffer ensures completion
    },
    [publish]
  ); // Depends only on publish

  // --- Core Logic: Throttled Check Function ---
  // This function performs the checks and decides *whether* to trigger the pull
  const throttledCheckAndPull = useMemo(() => {
    // Throttle ensures this logic runs at most once per interval during continuous calls
    return throttle(
      () => {
        const config = configRef.current;
        const now = Date.now();

        // --- Early Exit Checks ---
        if (
          !isGravitatingEnabled || // Feature disabled
          isPullingRef.current || // Already pulling
          isAnimatingRef.current || // Another animation is running
          isUserPanningRef.current || // User is actively panning
          isUserZoomingRef.current || // User is actively zooming
          now - lastPullTimeRef.current < config.cooldownPeriod // Within cooldown period
        ) {
          return;
        }

        const viewportCenter = getViewportCenter();
        if (!viewportCenter) return; // Need viewport center

        const currentMarkers = markersRef.current; // Get latest markers
        if (currentMarkers.length === 0) return; // No markers to pull towards

        // --- Find Nearest Marker (Potentially expensive O(N)) ---
        // This is the core calculation being throttled
        const nearestItem = findNearestMarker(currentMarkers, viewportCenter);
        if (!nearestItem) return; // No nearest marker found

        // Check distance threshold
        const distanceSq = getDistanceSquared(viewportCenter, nearestItem.coordinates);
        const maxDistanceSq = config.maxDistanceForPull * config.maxDistanceForPull;
        if (distanceSq > maxDistanceSq) {
          return; // Nearest marker is too far away
        }

        // Check if centering is needed
        if (!needsCentering(nearestItem.coordinates, viewportCenter, config.centeringThreshold)) {
          return; // Already centered enough
        }

        // --- Conditions met, trigger the pull animation ---
        triggerGravitationalPullAnimation(nearestItem.coordinates, nearestItem.isCluster);
      },
      // Throttle interval: Adjust based on desired responsiveness vs. performance
      ANIMATION_CONSTANTS.THROTTLE_INTERVAL,
      // Options: leading: false (don't run immediately), trailing: true (run after last call in interval)
      { leading: false, trailing: true }
    );
  }, [isGravitatingEnabled, getViewportCenter, triggerGravitationalPullAnimation]); // Recreate throttle func if these change

  // --- Main Viewport Change Handler ---
  const handleViewportChange = useCallback(
    (feature: any) => {
      // --- Update Interaction State ---
      if (!isUserPanningRef.current) {
        handlePanningStart(); // Detect start of pan immediately
      }
      handlePanningEnd(); // Schedule check for end of pan

      // --- Update Viewport & Zoom Refs ---
      if (
        feature?.properties?.visibleBounds &&
        Array.isArray(feature.properties.visibleBounds) &&
        feature.properties.visibleBounds.length === 2 // Basic validation
      ) {
        const [[west, north], [east, south]] = feature.properties.visibleBounds;
        currentViewportRef.current = {
          north,
          south,
          east: Math.max(west, east),
          west: Math.min(west, east),
        };

        // Update Zoom Level & Detect Zooming
        if (feature.properties.zoomLevel !== undefined) {
          const newZoom = feature.properties.zoomLevel;
          if (
            currentZoomLevelRef.current !== null &&
            Math.abs(currentZoomLevelRef.current - newZoom) > 0.01
          ) {
            if (!isUserZoomingRef.current) handleZoomingStart();
            handleZoomingEnd(); // Schedule check for end of zoom
          }
          currentZoomLevelRef.current = newZoom;
        }
        // else: Missing zoom level, might need fallback zoom detection if critical

        // --- Update Velocity Samples ---
        const center = getViewportCenter(); // Recalculate based on updated viewportRef
        if (center) {
          viewportSamplesRef.current.push({ center, timestamp: Date.now() });
          // Keep buffer size manageable
          if (viewportSamplesRef.current.length > configRef.current.velocitySampleSize) {
            viewportSamplesRef.current.shift();
          }
        }

        // --- Trigger Throttled Check ---
        // Call the throttled function. It will only execute if the throttle interval has passed.
        throttledCheckAndPull();
      }
    },
    [
      handlePanningStart,
      handlePanningEnd,
      handleZoomingStart,
      handleZoomingEnd,
      getViewportCenter,
      throttledCheckAndPull, // Include throttled func in deps
    ]
  );

  // --- Effect for Marker Data Changes ---
  useEffect(() => {
    // Check if gravitational pull should be applied after markers change,
    // but only after initial mount and after a small delay (debounced).
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const handler = setTimeout(() => {
      // Call the throttled check function in case the marker change
      // makes a pull necessary (e.g., nearest marker changed).
      throttledCheckAndPull();
    }, ANIMATION_CONSTANTS.MARKER_UPDATE_DEBOUNCE); // Debounce marker updates

    return () => clearTimeout(handler);
  }, [markers, throttledCheckAndPull]); // Depend on markers and the throttled function instance

  // --- External Control: Toggle ---
  const toggleGravitation = useCallback(() => {
    setIsGravitatingEnabled((prev) => {
      const newState = !prev;
      publish<BaseEvent & { enabled: boolean }>(EventTypes.GRAVITATIONAL_PULL_TOGGLED, {
        timestamp: Date.now(),
        source: "GravitationalCamera",
        enabled: newState,
      });
      return newState;
    });
  }, [publish]);

  // --- External Control: Camera Animations ---
  const animateToLocation = useCallback((coordinates: [number, number], duration = 1000) => {
    if (cameraRef.current) {
      isAnimatingRef.current = true;
      cameraRef.current.setCamera({
        centerCoordinate: coordinates,
        animationDuration: duration,
        animationMode: "flyTo",
      });
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, duration + ANIMATION_CONSTANTS.ANIMATION_BUFFER);
    }
  }, []);

  const animateToLocationWithZoom = useCallback(
    (coordinates: [number, number], duration = 3000, targetZoom?: number) => {
      if (cameraRef.current) {
        isAnimatingRef.current = true;
        const config = configRef.current; // Access via ref
        cameraRef.current.setCamera({
          centerCoordinate: coordinates,
          zoomLevel: Math.min(
            targetZoom ?? config.gravityZoomLevel,
            ANIMATION_CONSTANTS.SAFE_ZOOM_LEVEL
          ),
          animationDuration: duration,
          animationMode: "flyTo",
        });
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, duration + ANIMATION_CONSTANTS.ANIMATION_BUFFER);
      }
    },
    []
  ); // No dependency on config state needed

  const animateToBounds = useCallback(
    (
      bounds: { north: number; south: number; east: number; west: number },
      padding = 50,
      duration = 1000
    ) => {
      if (cameraRef.current) {
        isAnimatingRef.current = true;
        cameraRef.current.fitBounds(
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
          padding,
          duration
        );
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, duration + ANIMATION_CONSTANTS.ANIMATION_BUFFER);
      }
    },
    []
  );

  // --- Event Listener Subscriptions ---
  useEffect(() => {
    const unsubscribeAnimateToLocation = subscribe<CameraAnimateToLocationEvent>(
      EventTypes.CAMERA_ANIMATE_TO_LOCATION,
      (event) => {
        const duration = event.duration ?? 1000; // Use default if undefined
        const config = configRef.current; // Access via ref
        const cameraSettings: MapboxGL.CameraStop = {
          // Use correct type if possible
          centerCoordinate: event.coordinates,
          animationDuration: duration,
          animationMode: "flyTo",
        };
        if (event.allowZoomChange === true) {
          // Use ?? for default value
          cameraSettings.zoomLevel = event.zoomLevel ?? config.gravityZoomLevel;
        }
        if (cameraRef.current) {
          isAnimatingRef.current = true;
          cameraRef.current.setCamera(cameraSettings);
          setTimeout(() => {
            isAnimatingRef.current = false;
          }, duration + ANIMATION_CONSTANTS.ANIMATION_BUFFER);
        }
      }
    );

    const unsubscribeAnimateToBounds = subscribe<CameraAnimateToBoundsEvent>(
      EventTypes.CAMERA_ANIMATE_TO_BOUNDS,
      (event) => animateToBounds(event.bounds, event.padding ?? 50, event.duration ?? 1000)
    );

    return () => {
      unsubscribeAnimateToLocation();
      unsubscribeAnimateToBounds();
    };
  }, [subscribe, animateToBounds]); // `animateToBounds` is stable due to useCallback([])

  // --- Cleanup ---
  useEffect(() => {
    // Ensure throttle function is cancelled on unmount
    const cancelThrottle = throttledCheckAndPull.cancel;
    return () => {
      if (panningTimeoutRef.current) clearTimeout(panningTimeoutRef.current);
      if (zoomingTimeoutRef.current) clearTimeout(zoomingTimeoutRef.current);
      cancelThrottle(); // Cancel any pending throttled execution
    };
  }, [throttledCheckAndPull]); // Depend on the throttled function instance

  // --- Returned API ---
  const api = useMemo(
    () => ({
      cameraRef,
      // Note: mapViewRef is not used internally here, only passed through if needed externally
      // If you add logic needing it (like queryRenderedFeatures), pass it in as prop/arg
      isGravitatingEnabled,
      isGravitating, // Reflects pull animation state
      isHighVelocity, // Reflects pull animation state
      toggleGravitation,
      handleViewportChange, // The main callback for MapView's onRegionDidChange/onCameraChanged
      animateToLocation,
      animateToLocationWithZoom,
      animateToBounds,
      // No visibleMarkers exposed, as it's an internal detail now
      // Expose methods to update config if needed, but direct mutation via ref is simpler internally
      // updateConfig: (newConfig: Partial<GravitationConfig>) => { ... }, // Can be added if needed
    }),
    [
      // Dependencies should be stable values or state affecting the API shape/callbacks
      isGravitatingEnabled,
      isGravitating,
      isHighVelocity,
      toggleGravitation,
      handleViewportChange,
      animateToLocation,
      animateToLocationWithZoom,
      animateToBounds,
    ]
  );

  return api;
}
