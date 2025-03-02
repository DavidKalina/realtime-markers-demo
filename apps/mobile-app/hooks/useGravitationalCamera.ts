// hooks/useGravitationalCamera.ts
import { useRef, useState, useEffect, useCallback } from "react";
import { Marker } from "@/hooks/useMapWebsocket";
import { useUserLocationStore } from "@/stores/useUserLocationStore";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes, BaseEvent } from "@/services/EventBroker";
import MapboxGL from "@rnmapbox/maps";

interface GravitationConfig {
  // Minimum markers required to trigger a gravitational pull
  minMarkersForPull: number;
  // How long the pull animation should take (ms)
  animationDuration: number;
  // Faster animation duration for high-velocity panning (ms)
  highVelocityAnimationDuration: number;
  // Cooldown between gravitational pulls (ms)
  cooldownPeriod: number;
  // Zoom level to use when gravitating
  gravityZoomLevel: number;
  // Zoom level to use when gravitating with high velocity
  highVelocityZoomLevel: number;
  // Distance threshold (in degrees) to determine if we're already centered
  centeringThreshold: number;
  // Velocity threshold to trigger the more aggressive pull (degrees/ms)
  highVelocityThreshold: number;
  // How long to consider after a pan for velocity calculation (ms)
  velocityMeasurementWindow: number;
  // How many viewport samples to keep for velocity calculation
  velocitySampleSize: number;
}

interface ViewportSample {
  center: {
    longitude: number;
    latitude: number;
  };
  timestamp: number;
}

export function useGravitationalCamera(markers: Marker[], config: Partial<GravitationConfig> = {}) {
  // Create a ref for the camera
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Merge defaults with user config
  const gravitationConfig: GravitationConfig = {
    minMarkersForPull: 1, // Even one marker can trigger a pull
    animationDuration: 650, // Slightly longer for smoother regular transitions
    highVelocityAnimationDuration: 450, // Slightly longer for smoother high-velocity transitions
    cooldownPeriod: 2000, // Don't pull again for 2 seconds
    gravityZoomLevel: 14, // Regular zoom level when gravitating
    highVelocityZoomLevel: 14.5, // Slightly higher zoom for high velocity (show more detail)
    centeringThreshold: 0.002, // About 200m at the equator
    highVelocityThreshold: 0.001, // Degrees/ms (approx 100m/s at the equator)
    velocityMeasurementWindow: 300, // Look at pan movements in the last 300ms
    velocitySampleSize: 5, // Keep 5 recent viewport positions for velocity calculation
    ...config,
  };

  const [isGravitatingEnabled, setIsGravitatingEnabled] = useState(true);
  const [isGravitating, setIsGravitating] = useState(false);
  const [isHighVelocity, setIsHighVelocity] = useState(false);
  const { publish } = useEventBroker();
  const { userLocation } = useUserLocationStore();

  // Ref to store the last time we applied a gravitational pull
  const lastPullTimeRef = useRef<number>(0);
  // Ref to track if a pull is currently in progress
  const isPullingRef = useRef<boolean>(false);
  // Store current viewport bounds
  const currentViewportRef = useRef<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  // Store currently visible markers
  const visibleMarkersRef = useRef<Marker[]>([]);
  // Track if we had zero markers in the previous check
  const hadZeroMarkersRef = useRef<boolean>(true);
  // Store recent viewport positions for velocity calculation
  const viewportSamplesRef = useRef<ViewportSample[]>([]);
  // Track if user is actively panning
  const isUserPanningRef = useRef<boolean>(false);
  // Timeout for detecting when panning stops
  const panningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate the center of the current viewport
  const getViewportCenter = useCallback(() => {
    if (!currentViewportRef.current) return null;

    const { north, south, east, west } = currentViewportRef.current;
    return {
      latitude: (north + south) / 2,
      longitude: (east + west) / 2,
    };
  }, []);

  // Calculate panning velocity based on recent viewport samples
  const calculatePanningVelocity = useCallback(() => {
    const samples = viewportSamplesRef.current;
    if (samples.length < 2) return 0;

    // Get the most recent sample and the oldest sample within our time window
    const now = Date.now();
    const recentSample = samples[samples.length - 1];

    // Find the oldest sample within our measurement window
    let oldestValidSample = samples[0];
    for (let i = 0; i < samples.length; i++) {
      if (now - samples[i].timestamp <= gravitationConfig.velocityMeasurementWindow) {
        oldestValidSample = samples[i];
        break;
      }
    }

    // Calculate time difference in milliseconds
    const timeDiff = recentSample.timestamp - oldestValidSample.timestamp;
    if (timeDiff <= 0) return 0;

    // Calculate distance between viewport centers
    const distanceX = Math.abs(recentSample.center.longitude - oldestValidSample.center.longitude);
    const distanceY = Math.abs(recentSample.center.latitude - oldestValidSample.center.latitude);
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // Return velocity in degrees per millisecond
    return distance / timeDiff;
  }, [gravitationConfig.velocityMeasurementWindow]);

  // Find markers that are visible in the current viewport
  const findVisibleMarkers = useCallback(() => {
    if (!currentViewportRef.current || markers.length < 1) {
      return [];
    }

    const { north, south, east, west } = currentViewportRef.current;

    // Find markers that are in the current viewport
    return markers.filter((marker) => {
      const [lng, lat] = marker.coordinates;

      // Check if marker is in current viewport
      return lat <= north && lat >= south && lng <= east && lng >= west;
    });
  }, [markers]);

  // Calculate the marker centroid (simply the center of all visible markers)
  const calculateMarkersCentroid = useCallback(() => {
    const visibleMarkers = findVisibleMarkers();
    visibleMarkersRef.current = visibleMarkers;

    if (visibleMarkers.length < gravitationConfig.minMarkersForPull) {
      return null;
    }

    // Calculate pure centroid (average position of all markers)
    const centroid: [number, number] = visibleMarkers.reduce(
      (acc, marker) => {
        return [acc[0] + marker.coordinates[0], acc[1] + marker.coordinates[1]];
      },
      [0, 0]
    );

    centroid[0] /= visibleMarkers.length;
    centroid[1] /= visibleMarkers.length;

    return centroid;
  }, [findVisibleMarkers, gravitationConfig.minMarkersForPull]);

  // Check if we need to center the camera on the markers
  const needsCentering = useCallback(
    (markersCentroid: [number, number]) => {
      const viewportCenter = getViewportCenter();
      if (!viewportCenter) return false;

      // Calculate distance between viewport center and markers centroid
      const distance = Math.sqrt(
        Math.pow(viewportCenter.longitude - markersCentroid[0], 2) +
          Math.pow(viewportCenter.latitude - markersCentroid[1], 2)
      );

      // Only center if the distance is greater than our threshold
      return distance > gravitationConfig.centeringThreshold;
    },
    [getViewportCenter, gravitationConfig.centeringThreshold]
  );

  // Handle panning state
  const handlePanningStart = useCallback(() => {
    isUserPanningRef.current = true;

    // Clear any existing timeout
    if (panningTimeoutRef.current) {
      clearTimeout(panningTimeoutRef.current);
    }
  }, []);

  const handlePanningEnd = useCallback(() => {
    // Set a timeout to mark panning as ended after a short delay
    // This helps distinguish between separate pan gestures
    if (panningTimeoutRef.current) {
      clearTimeout(panningTimeoutRef.current);
    }

    panningTimeoutRef.current = setTimeout(() => {
      isUserPanningRef.current = false;
      // Clear viewport samples when panning ends
      viewportSamplesRef.current = [];
    }, 100);
  }, []);

  // Apply the gravitational pull if conditions are met
  const applyGravitationalPull = useCallback(() => {
    // Skip if gravity is disabled or already pulling or in cooldown period
    const now = Date.now();
    if (
      !isGravitatingEnabled ||
      isPullingRef.current ||
      now - lastPullTimeRef.current < gravitationConfig.cooldownPeriod
    ) {
      return;
    }

    // Calculate the visible markers and update ref
    const visibleMarkers = findVisibleMarkers();
    visibleMarkersRef.current = visibleMarkers;

    // Check if we've transitioned from zero markers to some markers
    const hasMarkers = visibleMarkers.length >= gravitationConfig.minMarkersForPull;
    const shouldApplyPull = hasMarkers && hadZeroMarkersRef.current;

    // Update the zero markers ref for next time
    hadZeroMarkersRef.current = !hasMarkers;

    // If we haven't transitioned from zero to some markers, don't pull
    if (!shouldApplyPull) return;

    // Calculate panning velocity for adaptive gravitational strength
    const velocity = calculatePanningVelocity();
    const isHighVelocityPan = velocity >= gravitationConfig.highVelocityThreshold;
    setIsHighVelocity(isHighVelocityPan);

    // Calculate the center of visible markers
    const centroid = calculateMarkersCentroid();
    if (!centroid) return;

    // Check if we need to center (avoid small adjustments if already centered)
    if (!needsCentering(centroid)) return;

    // We have a valid centering target, apply the pull
    // Only set isGravitating once to prevent overlay flashing
    if (!isPullingRef.current) {
      isPullingRef.current = true;
      setIsGravitating(true);
      setIsHighVelocity(isHighVelocityPan);
    }

    // Select animation parameters based on velocity
    const animationDuration = isHighVelocityPan
      ? gravitationConfig.highVelocityAnimationDuration
      : gravitationConfig.animationDuration;

    const zoomLevel = isHighVelocityPan
      ? gravitationConfig.highVelocityZoomLevel
      : gravitationConfig.gravityZoomLevel;

    // Publish event about gravitational pull
    publish<BaseEvent & { target: [number, number]; isHighVelocity: boolean }>(
      EventTypes.GRAVITATIONAL_PULL_STARTED,
      {
        timestamp: Date.now(),
        source: "GravitationalCamera",
        target: centroid,
        isHighVelocity: isHighVelocityPan,
      }
    );

    // Use camera ref to animate to the target with smoother transitions
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: centroid,
        zoomLevel: zoomLevel,
        animationDuration: animationDuration,
        animationMode: "easeTo",
      });

      // Reset pull state after animation completes
      const resetTimeout = setTimeout(() => {
        isPullingRef.current = false;
        setIsGravitating(false);
        setIsHighVelocity(false);
        lastPullTimeRef.current = Date.now();

        publish<BaseEvent>(EventTypes.GRAVITATIONAL_PULL_COMPLETED, {
          timestamp: Date.now(),
          source: "GravitationalCamera",
        });
      }, animationDuration + 50);

      // Clean up timeout if component unmounts during animation
      return () => clearTimeout(resetTimeout);
    }
  }, [
    isGravitatingEnabled,
    findVisibleMarkers,
    calculateMarkersCentroid,
    calculatePanningVelocity,
    needsCentering,
    gravitationConfig,
    publish,
  ]);

  // Handle viewport change
  const handleViewportChange = useCallback(
    (feature: any) => {
      // Mark the start of panning if not already panning
      if (!isUserPanningRef.current) {
        handlePanningStart();
      }

      // Update current viewport bounds reference
      if (
        feature?.properties?.visibleBounds &&
        Array.isArray(feature.properties.visibleBounds) &&
        feature.properties.visibleBounds.length === 2 &&
        Array.isArray(feature.properties.visibleBounds[0]) &&
        Array.isArray(feature.properties.visibleBounds[1])
      ) {
        const [[west, north], [east, south]] = feature.properties.visibleBounds;

        // Store normalized bounds
        currentViewportRef.current = {
          north,
          south,
          east: Math.max(west, east),
          west: Math.min(west, east),
        };

        // Get viewport center
        const center = getViewportCenter();
        if (center) {
          // Add new viewport sample for velocity calculation
          const newSample = {
            center,
            timestamp: Date.now(),
          };

          // Add to samples, keeping only the most recent N samples
          viewportSamplesRef.current.push(newSample);
          if (viewportSamplesRef.current.length > gravitationConfig.velocitySampleSize) {
            viewportSamplesRef.current.shift();
          }
        }

        // After updating bounds, mark the end of panning
        // (this will be canceled if another change happens soon)
        handlePanningEnd();

        // Check for potential gravitational pull immediately after viewport changes
        applyGravitationalPull();
      }
    },
    [
      applyGravitationalPull,
      getViewportCenter,
      handlePanningStart,
      handlePanningEnd,
      gravitationConfig.velocitySampleSize,
    ]
  );

  // Effect to detect new markers (trigger when markers array changes)
  useEffect(() => {
    // Only run if we have markers and aren't currently animating
    if (markers.length > 0 && !isPullingRef.current && isGravitatingEnabled) {
      applyGravitationalPull();
    }

    // When there are no markers, make sure we reset the hadZeroMarkers flag
    if (markers.length === 0) {
      hadZeroMarkersRef.current = true;
    }
  }, [markers, applyGravitationalPull, isGravitatingEnabled]);

  // Toggle gravitational effect on/off
  const toggleGravitation = useCallback(() => {
    setIsGravitatingEnabled((prev) => !prev);

    publish<BaseEvent & { enabled: boolean }>(EventTypes.GRAVITATIONAL_PULL_TOGGLED, {
      timestamp: Date.now(),
      source: "GravitationalCamera",
      enabled: !isGravitatingEnabled,
    });
  }, [isGravitatingEnabled, publish]);

  // Camera animation methods using the camera ref
  const animateToLocation = useCallback(
    (coordinates: [number, number], duration = 1000, zoom?: number) => {
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: coordinates,
          zoomLevel: zoom || gravitationConfig.gravityZoomLevel,
          animationDuration: duration,
          animationMode: "easeTo",
        });
      }
    },
    [gravitationConfig.gravityZoomLevel]
  );

  // The returned API
  return {
    cameraRef,
    isGravitatingEnabled,
    isGravitating,
    isHighVelocity,
    toggleGravitation,
    handleViewportChange,
    animateToLocation,
    visibleMarkers: visibleMarkersRef.current,
    updateConfig: (newConfig: Partial<GravitationConfig>) => {
      Object.assign(gravitationConfig, newConfig);
    },
  };
}
