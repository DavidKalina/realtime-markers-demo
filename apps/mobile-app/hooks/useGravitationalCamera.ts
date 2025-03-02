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
  // Cooldown between gravitational pulls (ms)
  cooldownPeriod: number;
  // Zoom level to use when gravitating
  gravityZoomLevel: number;
  // Distance threshold (in degrees) to determine if we're already centered
  centeringThreshold: number;
}

export function useGravitationalCamera(markers: Marker[], config: Partial<GravitationConfig> = {}) {
  // Create a ref for the camera
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Merge defaults with user config
  const gravitationConfig: GravitationConfig = {
    minMarkersForPull: 1, // Even one marker can trigger a pull
    animationDuration: 500, // Faster animation for immediacy
    cooldownPeriod: 500, // Don't pull again for 2 seconds
    gravityZoomLevel: 14, // Zoom level when gravitating
    centeringThreshold: 0.002, // About 200m at the equator
    ...config,
  };

  const [isGravitatingEnabled, setIsGravitatingEnabled] = useState(true);
  const [isGravitating, setIsGravitating] = useState(false);
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

  // Calculate the center of the current viewport
  const getViewportCenter = useCallback(() => {
    if (!currentViewportRef.current) return null;

    const { north, south, east, west } = currentViewportRef.current;
    return {
      latitude: (north + south) / 2,
      longitude: (east + west) / 2,
    };
  }, []);

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

    // Calculate the center of visible markers
    const centroid = calculateMarkersCentroid();
    if (!centroid) return;

    // Check if we need to center (avoid small adjustments if already centered)
    if (!needsCentering(centroid)) return;

    // We have a valid centering target, apply the pull
    isPullingRef.current = true;
    setIsGravitating(true);

    // Publish event about gravitational pull
    publish<BaseEvent & { target: [number, number] }>(EventTypes.GRAVITATIONAL_PULL_STARTED, {
      timestamp: Date.now(),
      source: "GravitationalCamera",
      target: centroid,
    });

    // Use camera ref to animate to the target
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: centroid,
        zoomLevel: gravitationConfig.gravityZoomLevel,
        animationDuration: gravitationConfig.animationDuration,
      });

      // Reset pull state after animation completes
      setTimeout(() => {
        isPullingRef.current = false;
        setIsGravitating(false);
        lastPullTimeRef.current = Date.now();

        publish<BaseEvent>(EventTypes.GRAVITATIONAL_PULL_COMPLETED, {
          timestamp: Date.now(),
          source: "GravitationalCamera",
        });
      }, gravitationConfig.animationDuration + 100);
    }
  }, [
    isGravitatingEnabled,
    findVisibleMarkers,
    calculateMarkersCentroid,
    needsCentering,
    gravitationConfig,
    publish,
  ]);

  // Handle viewport change
  const handleViewportChange = useCallback(
    (feature: any) => {
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

        // Check for potential gravitational pull immediately after viewport changes
        applyGravitationalPull();
      }
    },
    [applyGravitationalPull]
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
    toggleGravitation,
    handleViewportChange,
    animateToLocation,
    visibleMarkers: visibleMarkersRef.current,
    updateConfig: (newConfig: Partial<GravitationConfig>) => {
      Object.assign(gravitationConfig, newConfig);
    },
  };
}
