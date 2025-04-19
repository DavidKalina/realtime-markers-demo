import { ViewportSample, GravitationConfig } from "./gravitationalCameraConfig";
import { Marker } from "@/hooks/useMapWebsocket";
import { ANIMATION_CONSTANTS } from "./gravitationalCameraConfig";

// Extend the Marker type to include cluster information
interface ExtendedMarker extends Marker {
  type?: "marker" | "cluster";
}

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

export const getDistanceSquared = (
  coord1: { latitude: number; longitude: number },
  coord2: [number, number] // [longitude, latitude]
): number => {
  const dx = coord1.longitude - coord2[0];
  // Cosine correction helps approximate longitude degrees based on latitude
  const dy = (coord1.latitude - coord2[1]) * Math.cos(coord1.latitude * (Math.PI / 180));
  return dx * dx + dy * dy;
};

export const findNearestMarker = (
  markers: ExtendedMarker[],
  center: { latitude: number; longitude: number } | null
): { coordinates: [number, number]; isCluster: boolean } | null => {
  if (!center || markers.length === 0) {
    return null;
  }

  let nearestItem: { coordinates: [number, number]; isCluster: boolean } | null = null;
  let minDistanceSq = Infinity;

  for (const marker of markers) {
    if (!marker?.coordinates) continue;

    const markerCoords = marker.coordinates as [number, number];
    const distanceSq = getDistanceSquared(center, markerCoords);

    // If this is a cluster, give it priority by reducing its effective distance
    const isCluster = marker.type === "cluster";
    const effectiveDistanceSq = isCluster ? distanceSq * 0.8 : distanceSq; // 20% closer for clusters

    if (effectiveDistanceSq < minDistanceSq) {
      minDistanceSq = effectiveDistanceSq;
      nearestItem = {
        coordinates: markerCoords,
        isCluster,
      };
    }
  }

  return nearestItem;
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

export const needsCentering = (
  targetCoordinates: [number, number],
  viewportCenter: { latitude: number; longitude: number } | null,
  centeringThreshold: number
): boolean => {
  if (!viewportCenter) return false;

  const distance = Math.sqrt(
    Math.pow(viewportCenter.longitude - targetCoordinates[0], 2) +
      Math.pow(viewportCenter.latitude - targetCoordinates[1], 2)
  );

  return distance > centeringThreshold;
};
