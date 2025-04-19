import { Marker } from "@/hooks/useMapWebsocket";

export interface GravitationConfig {
  // How long the pull animation should take (ms)
  animationDuration: number;
  // Faster animation duration for high-velocity panning (ms)
  highVelocityAnimationDuration: number;
  // Cooldown between gravitational pulls (ms)
  cooldownPeriod: number;
  // Zoom level to use when gravitating
  gravityZoomLevel: number;
  // Distance threshold (in degrees) to determine if we're already centered
  centeringThreshold: number;
  // Maximum distance (in degrees) to consider a marker for gravitational pull
  maxDistanceForPull: number;
  // Velocity threshold to trigger the more aggressive pull (degrees/ms)
  highVelocityThreshold: number;
  // How long to consider after a pan for velocity calculation (ms)
  velocityMeasurementWindow: number;
  // How many viewport samples to keep for velocity calculation
  velocitySampleSize: number;
  // Animation mode for gravitational pull
  gravityAnimationMode: "easeTo" | "flyTo";
}

export interface ViewportSample {
  center: {
    longitude: number;
    latitude: number;
  };
  timestamp: number;
}

export const DEFAULT_CONFIG: GravitationConfig = {
  animationDuration: 800,
  highVelocityAnimationDuration: 600,
  cooldownPeriod: 2000,
  gravityZoomLevel: 14,
  centeringThreshold: 0.002,
  maxDistanceForPull: 0.1, // Approximately 11km at equator
  highVelocityThreshold: 0.001,
  velocityMeasurementWindow: 300,
  velocitySampleSize: 5,
  gravityAnimationMode: "easeTo",
};

// Animation constants
export const ANIMATION_CONSTANTS = {
  PANNING_TIMEOUT: 100,
  ZOOMING_TIMEOUT: 100,
  ANIMATION_BUFFER: 50,
  SAFE_ZOOM_LEVEL: 14,
  MAX_ZOOM_LEVEL: 16,
  MIN_ZOOM_LEVEL: 10,
};
