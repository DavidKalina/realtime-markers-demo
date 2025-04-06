// hooks/useGravitationalCamera.ts
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Marker } from "@/hooks/useMapWebsocket";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  EventTypes,
  BaseEvent,
  CameraAnimateToLocationEvent,
  CameraAnimateToBoundsEvent,
} from "@/services/EventBroker";
import MapboxGL from "@rnmapbox/maps";
import { DEFAULT_CONFIG, GravitationConfig, ANIMATION_CONSTANTS } from "./gravitationalCameraConfig";
import {
  calculatePanningVelocity,
  findVisibleMarkers,
  calculateMarkersCentroid,
  determineZoomLevel,
  needsCentering,
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
  const didMountRef = useRef(false);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const isAnimatingRef = useRef<boolean>(false);

  // Memoize the config
  const gravitationConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
    [config]
  );

  // Store config in ref for use in callbacks
  const configRef = useRef(gravitationConfig);
  useEffect(() => {
    configRef.current = gravitationConfig;
  }, [gravitationConfig]);

  // State management
  const [isGravitatingEnabled, setIsGravitatingEnabled] = useState(true);
  const [isGravitating, setIsGravitating] = useState(false);
  const [isHighVelocity, setIsHighVelocity] = useState(false);
  const { publish, subscribe } = useEventBroker();

  // Refs for tracking state
  const lastPullTimeRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const currentViewportRef = useRef<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const visibleMarkersRef = useRef<Marker[]>([]);
  const hadZeroMarkersRef = useRef<boolean>(true);
  const viewportSamplesRef = useRef<ViewportSample[]>([]);
  const isUserPanningRef = useRef<boolean>(false);
  const panningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentZoomLevelRef = useRef<number | null>(null);
  const isUserZoomingRef = useRef<boolean>(false);
  const zoomingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get viewport center
  const getViewportCenter = useCallback(() => {
    if (!currentViewportRef.current) return null;
    const { north, south, east, west } = currentViewportRef.current;
    return {
      latitude: (north + south) / 2,
      longitude: (east + west) / 2,
    };
  }, []);

  // Create panning and zooming handlers
  const { handlePanningStart, handlePanningEnd } = useMemo(
    () => createPanningHandlers(isUserPanningRef, panningTimeoutRef, viewportSamplesRef),
    []
  );

  const { handleZoomingStart, handleZoomingEnd } = useMemo(
    () => createZoomingHandlers(isUserZoomingRef, zoomingTimeoutRef),
    []
  );

  // Apply gravitational pull
  const applyGravitationalPull = useCallback(() => {
    const now = Date.now();
    if (
      !isGravitatingEnabled ||
      isPullingRef.current ||
      now - lastPullTimeRef.current < gravitationConfig.cooldownPeriod ||
      isAnimatingRef.current
    ) {
      return;
    }

    const visibleMarkers = findVisibleMarkers(markers, currentViewportRef.current);
    const currentMarkerCount = visibleMarkers.length;
    const previousMarkerCount = visibleMarkersRef.current.length;
    visibleMarkersRef.current = visibleMarkers;

    const isTransitionToMarkersArea =
      currentMarkerCount >= gravitationConfig.minMarkersForPull &&
      previousMarkerCount < gravitationConfig.minMarkersForPull;

    if (!isTransitionToMarkersArea) {
      return;
    }

    const viewportCenter = getViewportCenter();
    const centroid = calculateMarkersCentroid(
      visibleMarkers,
      viewportCenter,
      gravitationConfig.minMarkersForPull
    );

    if (!centroid || !needsCentering(centroid, viewportCenter, gravitationConfig.centeringThreshold)) {
      return;
    }

    const zoomLevel = determineZoomLevel(
      centroid,
      visibleMarkers,
      gravitationConfig,
      currentZoomLevelRef.current
    );

    if (!isPullingRef.current) {
      isPullingRef.current = true;
      setIsGravitating(true);

      const velocity = calculatePanningVelocity(
        viewportSamplesRef.current,
        gravitationConfig.velocityMeasurementWindow
      );
      const isHighVelocityPan = velocity >= gravitationConfig.highVelocityThreshold;
      setIsHighVelocity(isHighVelocityPan);

      const animationDuration = isHighVelocityPan
        ? gravitationConfig.highVelocityAnimationDuration
        : gravitationConfig.animationDuration;

      publish<BaseEvent & { target: [number, number]; isHighVelocity: boolean }>(
        EventTypes.GRAVITATIONAL_PULL_STARTED,
        {
          timestamp: Date.now(),
          source: "GravitationalCamera",
          target: centroid,
          isHighVelocity: isHighVelocityPan,
        }
      );

      if (cameraRef.current) {
        isAnimatingRef.current = true;

        cameraRef.current.setCamera({
          centerCoordinate: centroid,
          zoomLevel: zoomLevel,
          animationDuration: animationDuration,
          animationMode: gravitationConfig.gravityAnimationMode,
        });

        setTimeout(() => {
          isPullingRef.current = false;
          setIsGravitating(false);
          setIsHighVelocity(false);
          lastPullTimeRef.current = Date.now();

          publish<BaseEvent>(EventTypes.GRAVITATIONAL_PULL_COMPLETED, {
            timestamp: Date.now(),
            source: "GravitationalCamera",
          });

          isAnimatingRef.current = false;
        }, animationDuration + ANIMATION_CONSTANTS.ANIMATION_BUFFER);
      }
    }
  }, [
    isGravitatingEnabled,
    markers,
    getViewportCenter,
    gravitationConfig,
    publish,
  ]);

  // Handle viewport changes
  const handleViewportChange = useCallback(
    (feature: any) => {
      if (!isUserPanningRef.current) {
        handlePanningStart();
      }

      if (
        feature?.properties?.visibleBounds &&
        Array.isArray(feature.properties.visibleBounds) &&
        feature.properties.visibleBounds.length === 2 &&
        Array.isArray(feature.properties.visibleBounds[0]) &&
        Array.isArray(feature.properties.visibleBounds[1])
      ) {
        const [[west, north], [east, south]] = feature.properties.visibleBounds;
        const previousBounds = currentViewportRef.current;
        currentViewportRef.current = {
          north,
          south,
          east: Math.max(west, east),
          west: Math.min(west, east),
        };

        if (feature.properties.zoomLevel !== undefined) {
          if (currentZoomLevelRef.current !== feature.properties.zoomLevel) {
            handleZoomingStart();
            handleZoomingEnd();
          }
          currentZoomLevelRef.current = feature.properties.zoomLevel;
        } else if (previousBounds) {
          const oldWidth = previousBounds.east - previousBounds.west;
          const oldHeight = previousBounds.north - previousBounds.south;
          const newWidth = currentViewportRef.current.east - currentViewportRef.current.west;
          const newHeight = currentViewportRef.current.north - currentViewportRef.current.south;

          if (
            Math.abs(newWidth / oldWidth - 1) > 0.1 ||
            Math.abs(newHeight / oldHeight - 1) > 0.1
          ) {
            handleZoomingStart();
            handleZoomingEnd();
          }
        }

        const center = getViewportCenter();
        if (center) {
          const newSample = {
            center,
            timestamp: Date.now(),
          };

          viewportSamplesRef.current.push(newSample);
          if (viewportSamplesRef.current.length > gravitationConfig.velocitySampleSize) {
            viewportSamplesRef.current.shift();
          }
        }

        handlePanningEnd();
        applyGravitationalPull();
      }
    },
    [
      handlePanningStart,
      handlePanningEnd,
      handleZoomingStart,
      handleZoomingEnd,
      getViewportCenter,
      applyGravitationalPull,
      gravitationConfig.velocitySampleSize,
    ]
  );

  // Handle marker changes
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      visibleMarkersRef.current = findVisibleMarkers(markers, currentViewportRef.current);
      return;
    }

    if (!isPullingRef.current && isGravitatingEnabled) {
      const timeoutId = setTimeout(() => {
        applyGravitationalPull();
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [markers, applyGravitationalPull, isGravitatingEnabled]);

  // Toggle gravitational effect
  const toggleGravitation = useCallback(() => {
    setIsGravitatingEnabled((prev) => !prev);
    publish<BaseEvent & { enabled: boolean }>(EventTypes.GRAVITATIONAL_PULL_TOGGLED, {
      timestamp: Date.now(),
      source: "GravitationalCamera",
      enabled: !isGravitatingEnabled,
    });
  }, [isGravitatingEnabled, publish]);

  // Camera animation methods
  const animateToLocation = useCallback(
    (coordinates: [number, number], duration = 1000, zoom?: number) => {
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
    },
    []
  );

  const animateToLocationWithZoom = useCallback(
    (coordinates: [number, number], duration = 3000, targetZoom?: number) => {
      if (cameraRef.current) {
        isAnimatingRef.current = true;
        cameraRef.current.setCamera({
          centerCoordinate: coordinates,
          zoomLevel: Math.min(targetZoom ?? gravitationConfig.gravityZoomLevel, ANIMATION_CONSTANTS.SAFE_ZOOM_LEVEL),
          animationDuration: duration,
          animationMode: "flyTo",
        });

        setTimeout(() => {
          isAnimatingRef.current = false;
        }, duration + ANIMATION_CONSTANTS.ANIMATION_BUFFER);
      }
    },
    [gravitationConfig.gravityZoomLevel]
  );

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

  // Event listeners
  useEffect(() => {
    const unsubscribeAnimateToLocation = subscribe<CameraAnimateToLocationEvent>(
      EventTypes.CAMERA_ANIMATE_TO_LOCATION,
      (event) => {
        const duration = event.duration || 1000;
        const zoomLevel = event.zoomLevel || gravitationConfig.gravityZoomLevel;
        animateToLocationWithZoom(event.coordinates, duration, zoomLevel);
      }
    );

    const unsubscribeAnimateToBounds = subscribe<CameraAnimateToBoundsEvent>(
      EventTypes.CAMERA_ANIMATE_TO_BOUNDS,
      (event) => {
        const duration = event.duration || 1000;
        const padding = event.padding || 50;
        animateToBounds(event.bounds, padding, duration);
      }
    );

    return () => {
      unsubscribeAnimateToLocation();
      unsubscribeAnimateToBounds();
    };
  }, [subscribe, animateToLocationWithZoom, animateToBounds, gravitationConfig.gravityZoomLevel]);

  // Cleanup
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

  // Return API
  const api = useMemo(
    () => ({
      cameraRef,
      isGravitatingEnabled,
      isGravitating,
      isHighVelocity,
      toggleGravitation,
      handleViewportChange,
      animateToLocation,
      animateToLocationWithZoom,
      animateToBounds,
      visibleMarkers: visibleMarkersRef.current,
      updateConfig: (newConfig: Partial<GravitationConfig>) => {
        Object.assign(configRef.current, newConfig);
      },
    }),
    [
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
