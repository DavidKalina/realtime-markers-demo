import { Marker } from "@/hooks/useMapWebsocket";

export interface GravitationConfig {
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
    // Animation mode for gravitational pull
    gravityAnimationMode: "easeTo" | "flyTo";
    // Animation mode for user interactions
    userAnimationMode: "easeTo" | "flyTo";
}

export interface ViewportSample {
    center: {
        longitude: number;
        latitude: number;
    };
    timestamp: number;
}

export const DEFAULT_CONFIG: GravitationConfig = {
    minMarkersForPull: 1,
    animationDuration: 800,
    highVelocityAnimationDuration: 600,
    cooldownPeriod: 2000,
    gravityZoomLevel: 14,
    highVelocityZoomLevel: 14.5,
    centeringThreshold: 0.002,
    highVelocityThreshold: 0.001,
    velocityMeasurementWindow: 300,
    velocitySampleSize: 5,
    maxZoomOutAdjustment: 2,
    maxZoomInAdjustment: 1,
    preserveUserZoomLevel: true,
    gravityAnimationMode: "easeTo",
    userAnimationMode: "flyTo",
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