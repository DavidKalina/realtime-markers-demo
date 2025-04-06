import { ViewportSample, GravitationConfig } from "./gravitationalCameraConfig";
import { Marker } from "@/hooks/useMapWebsocket";
import { ANIMATION_CONSTANTS } from "./gravitationalCameraConfig";

export const calculatePanningVelocity = (
    samples: ViewportSample[],
    velocityMeasurementWindow: number
): number => {
    if (samples.length < 2) return 0;

    const now = Date.now();
    const recentSample = samples[samples.length - 1];

    // Find the oldest sample within our measurement window
    let oldestValidSample = samples[0];
    for (let i = 0; i < samples.length; i++) {
        if (now - samples[i].timestamp <= velocityMeasurementWindow) {
            oldestValidSample = samples[i];
            break;
        }
    }

    const timeDiff = recentSample.timestamp - oldestValidSample.timestamp;
    if (timeDiff <= 0) return 0;

    const distanceX = Math.abs(recentSample.center.longitude - oldestValidSample.center.longitude);
    const distanceY = Math.abs(recentSample.center.latitude - oldestValidSample.center.latitude);
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    return distance / timeDiff;
};

export const findVisibleMarkers = (
    markers: Marker[],
    viewport: {
        north: number;
        south: number;
        east: number;
        west: number;
    } | null
): Marker[] => {
    if (!viewport || markers.length < 1) {
        return [];
    }

    const { north, south, east, west } = viewport;

    return markers.filter((marker) => {
        const [lng, lat] = marker.coordinates;
        return lat <= north && lat >= south && lng <= east && lng >= west;
    });
};

export const calculateMarkersCentroid = (
    visibleMarkers: Marker[],
    viewportCenter: { latitude: number; longitude: number } | null,
    minMarkersForPull: number
): [number, number] | null => {
    if (visibleMarkers.length < minMarkersForPull) {
        return null;
    }

    if (visibleMarkers.length === 1) {
        return visibleMarkers[0].coordinates;
    }

    if (!viewportCenter) {
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

    return nearestMarker.coordinates;
};

export const determineZoomLevel = (
    targetCoordinates: [number, number],
    visibleMarkers: Marker[],
    config: GravitationConfig,
    currentZoomLevel: number | null
): number => {
    if (config.preserveUserZoomLevel && currentZoomLevel !== null) {
        return currentZoomLevel;
    }

    let zoomLevel = config.gravityZoomLevel;

    if (visibleMarkers.length <= 1) {
        return zoomLevel;
    }

    const maxDistance = visibleMarkers.reduce((maxDist, marker) => {
        if (
            marker.coordinates[0] === targetCoordinates[0] &&
            marker.coordinates[1] === targetCoordinates[1]
        ) {
            return maxDist;
        }

        const distance = Math.sqrt(
            Math.pow(targetCoordinates[0] - marker.coordinates[0], 2) +
            Math.pow(targetCoordinates[1] - marker.coordinates[1], 2)
        );

        return Math.max(maxDist, distance);
    }, 0);

    if (maxDistance > 0.05) {
        zoomLevel = Math.max(
            config.gravityZoomLevel - config.maxZoomOutAdjustment,
            ANIMATION_CONSTANTS.MIN_ZOOM_LEVEL
        );
    } else if (maxDistance > 0.02) {
        zoomLevel = Math.max(
            config.gravityZoomLevel - config.maxZoomOutAdjustment / 2,
            12
        );
    } else if (maxDistance < 0.001) {
        zoomLevel = Math.min(
            config.gravityZoomLevel + config.maxZoomInAdjustment,
            ANIMATION_CONSTANTS.MAX_ZOOM_LEVEL
        );
    }

    return zoomLevel;
};

export const needsCentering = (
    markersCentroid: [number, number],
    viewportCenter: { latitude: number; longitude: number } | null,
    centeringThreshold: number
): boolean => {
    if (!viewportCenter) return false;

    const distance = Math.sqrt(
        Math.pow(viewportCenter.longitude - markersCentroid[0], 2) +
        Math.pow(viewportCenter.latitude - markersCentroid[1], 2)
    );

    return distance > centeringThreshold;
}; 