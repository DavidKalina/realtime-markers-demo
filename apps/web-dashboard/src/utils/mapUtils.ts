// Map utility functions for the web dashboard

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Get user's current location
 */
export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
    );
  });
}

/**
 * Calculate the center point of multiple coordinates
 */
export function calculateCenter(coordinates: Coordinates[]): Coordinates {
  if (coordinates.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  const sumLat = coordinates.reduce((sum, coord) => sum + coord.latitude, 0);
  const sumLon = coordinates.reduce((sum, coord) => sum + coord.longitude, 0);

  return {
    latitude: sumLat / coordinates.length,
    longitude: sumLon / coordinates.length,
  };
}

/**
 * Calculate bounds that encompass all given coordinates
 */
export function calculateBounds(coordinates: Coordinates[]): MapBounds {
  if (coordinates.length === 0) {
    return {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
    };
  }

  const lats = coordinates.map((coord) => coord.latitude);
  const lons = coordinates.map((coord) => coord.longitude);

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lons),
    west: Math.min(...lons),
  };
}

/**
 * Add padding to map bounds
 */
export function addPaddingToBounds(
  bounds: MapBounds,
  paddingPercent: number = 10,
): MapBounds {
  const latPadding = (bounds.north - bounds.south) * (paddingPercent / 100);
  const lonPadding = (bounds.east - bounds.west) * (paddingPercent / 100);

  return {
    north: bounds.north + latPadding,
    south: bounds.south - latPadding,
    east: bounds.east + lonPadding,
    west: bounds.west - lonPadding,
  };
}

/**
 * Convert coordinates to [longitude, latitude] format for Mapbox
 */
export function toMapboxCoordinates(
  coordinates: Coordinates,
): [number, number] {
  return [coordinates.longitude, coordinates.latitude];
}

/**
 * Convert Mapbox coordinates to our format
 */
export function fromMapboxCoordinates(
  coordinates: [number, number],
): Coordinates {
  return {
    longitude: coordinates[0],
    latitude: coordinates[1],
  };
}

/**
 * Generate a random color for markers
 */
export function generateMarkerColor(): string {
  const colors = [
    "#ef4444", // red
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // yellow
    "#8b5cf6", // purple
    "#f97316", // orange
    "#06b6d4", // cyan
    "#84cc16", // lime
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Format date for display
 */
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "Past event";
  } else if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Tomorrow";
  } else if (diffDays < 7) {
    return `In ${diffDays} days`;
  } else {
    return date.toLocaleDateString();
  }
}
