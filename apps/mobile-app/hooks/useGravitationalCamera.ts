// hooks/useGravitationalCamera.ts
import { useRef, useState, useEffect, useCallback } from "react";
import { Marker } from "@/hooks/useMapWebsocket";
import { useUserLocationStore } from "@/stores/useUserLocationStore";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  EventTypes,
  BaseEvent,
  CameraAnimateToLocationEvent,
  CameraAnimateToBoundsEvent,
} from "@/services/EventBroker";
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
  // Max zoom out adjustment for widely spread markers
  maxZoomOutAdjustment: number;
  // Max zoom in adjustment for closely clustered markers
  maxZoomInAdjustment: number;
  // Whether to preserve user's zoom level during gravitational pull
  preserveUserZoomLevel: boolean;
}

interface ViewportSample {
  center: {
    longitude: number;
    latitude: number;
  };
  timestamp: number;
}

export function useGravitationalCamera(markers: Marker[], config: Partial<GravitationConfig> = {}) {
  const didMountRef = useRef(false);

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
    maxZoomOutAdjustment: 2, // Maximum amount to zoom out for spread out markers
    maxZoomInAdjustment: 1, // Maximum amount to zoom in for clustered markers
    preserveUserZoomLevel: true, // NEW: Preserve user's current zoom level during gravitational pull
    ...config,
  };

  const [isGravitatingEnabled, setIsGravitatingEnabled] = useState(true);
  const [isGravitating, setIsGravitating] = useState(false);
  const [isHighVelocity, setIsHighVelocity] = useState(false);
  const { publish, subscribe } = useEventBroker();

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
  // NEW: Store current zoom level
  const currentZoomLevelRef = useRef<number | null>(null);
  // NEW: Track if user is actively zooming
  const isUserZoomingRef = useRef<boolean>(false);
  // NEW: Timeout for detecting when zooming stops
  const zoomingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // MODIFIED: Calculate the target marker to gravitate toward
  // Now prioritizes the nearest marker to the viewport center
  const calculateMarkersCentroid = useCallback(() => {
    const visibleMarkers = findVisibleMarkers();
    visibleMarkersRef.current = visibleMarkers;

    if (visibleMarkers.length < gravitationConfig.minMarkersForPull) {
      return null;
    }

    // If there's only one marker, return its coordinates
    if (visibleMarkers.length === 1) {
      return visibleMarkers[0].coordinates;
    }

    // Get current viewport center
    const viewportCenter = getViewportCenter();
    if (!viewportCenter) {
      // Fallback to regular centroid if we can't get viewport center
      const centroid: [number, number] = visibleMarkers.reduce(
        (acc, marker) => {
          return [acc[0] + marker.coordinates[0], acc[1] + marker.coordinates[1]];
        },
        [0, 0]
      );
      centroid[0] /= visibleMarkers.length;
      centroid[1] /= visibleMarkers.length;
      return centroid;
    }

    // Find the nearest marker to the current viewport center
    let nearestMarker = visibleMarkers[0];
    let minDistance = Infinity;

    visibleMarkers.forEach((marker) => {
      const [lng, lat] = marker.coordinates;
      const distance = Math.sqrt(
        Math.pow(viewportCenter.longitude - lng, 2) + Math.pow(viewportCenter.latitude - lat, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestMarker = marker;
      }
    });

    // Return the coordinates of the nearest marker
    return nearestMarker.coordinates;
  }, [findVisibleMarkers, getViewportCenter, gravitationConfig.minMarkersForPull]);

  // NEW: Determine appropriate zoom level based on marker distribution
  const determineZoomLevel = useCallback(
    (targetCoordinates: [number, number]) => {
      // NEW: If we should preserve the user's zoom level and we have a current zoom level, use it
      if (gravitationConfig.preserveUserZoomLevel && currentZoomLevelRef.current !== null) {
        return currentZoomLevelRef.current;
      }

      const visibleMarkers = visibleMarkersRef.current;

      // Default zoom level from config
      let zoomLevel = gravitationConfig.gravityZoomLevel;

      // If there's only one marker, use the standard zoom level
      if (visibleMarkers.length <= 1) {
        return zoomLevel;
      }

      // Calculate the maximum distance between the target marker and any other marker
      const maxDistance = visibleMarkers.reduce((maxDist, marker) => {
        if (
          marker.coordinates[0] === targetCoordinates[0] &&
          marker.coordinates[1] === targetCoordinates[1]
        ) {
          return maxDist; // Skip the target marker itself
        }

        const distance = Math.sqrt(
          Math.pow(targetCoordinates[0] - marker.coordinates[0], 2) +
            Math.pow(targetCoordinates[1] - marker.coordinates[1], 2)
        );

        return Math.max(maxDist, distance);
      }, 0);

      // Adjust zoom level based on maximum distance
      // These thresholds would need tuning based on your specific map usage
      if (maxDistance > 0.05) {
        // Markers are very spread out (approx 5km)
        zoomLevel = Math.max(
          gravitationConfig.gravityZoomLevel - gravitationConfig.maxZoomOutAdjustment,
          10 // Don't zoom out too far
        );
      } else if (maxDistance > 0.02) {
        // Spread out markers (approx 2km)
        zoomLevel = Math.max(
          gravitationConfig.gravityZoomLevel - gravitationConfig.maxZoomOutAdjustment / 2,
          12 // Moderate zoom out
        );
      } else if (maxDistance < 0.001) {
        // Very close markers (approx 100m)
        zoomLevel = Math.min(
          gravitationConfig.gravityZoomLevel + gravitationConfig.maxZoomInAdjustment,
          16 // Don't zoom in too far
        );
      }

      return zoomLevel;
    },
    [
      gravitationConfig.gravityZoomLevel,
      gravitationConfig.maxZoomOutAdjustment,
      gravitationConfig.maxZoomInAdjustment,
      gravitationConfig.preserveUserZoomLevel,
    ]
  );

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

  // NEW: Handle zooming state
  const handleZoomingStart = useCallback(() => {
    isUserZoomingRef.current = true;

    // Clear any existing timeout
    if (zoomingTimeoutRef.current) {
      clearTimeout(zoomingTimeoutRef.current);
    }
  }, []);

  const handleZoomingEnd = useCallback(() => {
    // Set a timeout to mark zooming as ended after a short delay
    if (zoomingTimeoutRef.current) {
      clearTimeout(zoomingTimeoutRef.current);
    }

    zoomingTimeoutRef.current = setTimeout(() => {
      isUserZoomingRef.current = false;
    }, 100);
  }, []);

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

    // Get the current marker count
    const currentMarkerCount = visibleMarkers.length;
    const previousMarkerCount = visibleMarkersRef.current.length;

    // Update visible markers ref after checking previous count
    visibleMarkersRef.current = visibleMarkers;

    // Improved transition detection logic
    const isTransitionToMarkersArea =
      currentMarkerCount >= gravitationConfig.minMarkersForPull &&
      previousMarkerCount < gravitationConfig.minMarkersForPull;

    // Don't pull if we haven't transitioned to an area with markers
    if (!isTransitionToMarkersArea) {
      return;
    }

    // Calculate the nearest marker as our target
    const centroid = calculateMarkersCentroid();
    if (!centroid) return;

    // Check if we need to center (avoid small adjustments if already centered)
    if (!needsCentering(centroid)) return;

    // Use our dynamic zoom calculation
    const zoomLevel = determineZoomLevel(centroid);

    // We have a valid centering target, apply the pull
    if (!isPullingRef.current) {
      isPullingRef.current = true;
      setIsGravitating(true);

      // Calculate velocity for adaptive behavior
      const velocity = calculatePanningVelocity();
      const isHighVelocityPan = velocity >= gravitationConfig.highVelocityThreshold;
      setIsHighVelocity(isHighVelocityPan);

      // Select animation parameters based on velocity
      const animationDuration = isHighVelocityPan
        ? gravitationConfig.highVelocityAnimationDuration
        : gravitationConfig.animationDuration;

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

      // Use camera ref to animate to the target
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
    }
  }, [
    isGravitatingEnabled,
    findVisibleMarkers,
    calculateMarkersCentroid,
    calculatePanningVelocity,
    needsCentering,
    determineZoomLevel,
    gravitationConfig,
    publish,
  ]);

  // MODIFIED: Handle viewport change to detect zoom changes
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
        const previousBounds = currentViewportRef.current;
        currentViewportRef.current = {
          north,
          south,
          east: Math.max(west, east),
          west: Math.min(west, east),
        };

        // NEW: Detect zoom changes
        // Get the current zoom level if available in the feature
        if (feature.properties.zoomLevel !== undefined) {
          if (currentZoomLevelRef.current !== feature.properties.zoomLevel) {
            // Zoom level has changed
            handleZoomingStart();
            handleZoomingEnd(); // Start the timer to reset zooming state
          }
          currentZoomLevelRef.current = feature.properties.zoomLevel;
        } else {
          // If zoomLevel is not directly available, try to detect zoom by comparing bounds size
          if (previousBounds) {
            const oldWidth = previousBounds.east - previousBounds.west;
            const oldHeight = previousBounds.north - previousBounds.south;

            const newWidth = currentViewportRef.current.east - currentViewportRef.current.west;
            const newHeight = currentViewportRef.current.north - currentViewportRef.current.south;

            // If the bounds size has changed significantly, assume a zoom operation
            if (
              Math.abs(newWidth / oldWidth - 1) > 0.1 ||
              Math.abs(newHeight / oldHeight - 1) > 0.1
            ) {
              handleZoomingStart();
              handleZoomingEnd(); // Start the timer to reset zooming state
            }
          }
        }

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
      handleZoomingStart,
      handleZoomingEnd,
      gravitationConfig.velocitySampleSize,
    ]
  );

  // Modified useEffect to handle marker array changes more reliably
  useEffect(() => {
    // Don't try to apply gravitational pull right when component mounts
    // This avoids unwanted initial animations
    if (!didMountRef.current) {
      didMountRef.current = true;

      // Initialize previous marker state on first mount
      visibleMarkersRef.current = findVisibleMarkers();
      return;
    }

    // Only attempt gravitational pull after initial mount
    // and when we're not already animating
    if (!isPullingRef.current && isGravitatingEnabled) {
      // Use a small delay to avoid race conditions with viewport updates
      const timeoutId = setTimeout(() => {
        applyGravitationalPull();
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [markers, applyGravitationalPull, isGravitatingEnabled, findVisibleMarkers]);

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

  // Camera animation methods to animate to bounds
  const animateToBounds = useCallback(
    (
      bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
      },
      padding = 50,
      duration = 1000
    ) => {
      if (cameraRef.current) {
        cameraRef.current.fitBounds(
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
          padding,
          duration
        );
      }
    },
    []
  );

  // Event listeners for camera commands
  useEffect(() => {
    // Subscribe to camera:animate:to:location events
    const unsubscribeAnimateToLocation = subscribe<CameraAnimateToLocationEvent>(
      EventTypes.CAMERA_ANIMATE_TO_LOCATION,
      (event) => {
        // Use default values if not provided in the event
        const duration = event.duration || 1000;
        const zoomLevel = event.zoomLevel || gravitationConfig.gravityZoomLevel;

        // Animate to the requested location
        animateToLocation(event.coordinates, duration, zoomLevel);
      }
    );

    // Subscribe to camera:animate:to:bounds events
    const unsubscribeAnimateToBounds = subscribe<CameraAnimateToBoundsEvent>(
      EventTypes.CAMERA_ANIMATE_TO_BOUNDS,
      (event) => {
        // Use default values if not provided in the event
        const duration = event.duration || 1000;
        const padding = event.padding || 50;

        // Animate to the requested bounds
        animateToBounds(event.bounds, padding, duration);
      }
    );

    // Clean up listeners on unmount
    return () => {
      unsubscribeAnimateToLocation();
      unsubscribeAnimateToBounds();
    };
  }, [subscribe, animateToLocation, animateToBounds, gravitationConfig.gravityZoomLevel]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (panningTimeoutRef.current) {
        clearTimeout(panningTimeoutRef.current);
      }
      if (zoomingTimeoutRef.current) {
        clearTimeout(zoomingTimeoutRef.current);
      }
    };
  }, []);

  // The returned API
  return {
    cameraRef,
    isGravitatingEnabled,
    isGravitating,
    isHighVelocity,
    toggleGravitation,
    handleViewportChange,
    animateToLocation,
    animateToBounds,
    visibleMarkers: visibleMarkersRef.current,
    updateConfig: (newConfig: Partial<GravitationConfig>) => {
      Object.assign(gravitationConfig, newConfig);
    },
  };
}
