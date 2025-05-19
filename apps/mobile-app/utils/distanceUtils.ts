// utils/distanceUtils.ts

/**
 * Calculate distance between two coordinates using the Haversine formula
 * @param userCoords User coordinates [longitude, latitude]
 * @param markerCoords Marker coordinates [longitude, latitude]
 * @returns Distance in kilometers or null if user location is not available
 */
export const calculateDistance = (
  userCoords: [number, number] | null,
  markerCoords: [number, number],
): number | null => {
  if (!userCoords) return null;

  // Convert longitude and latitude from degrees to radians
  const toRad = (value: number) => (value * Math.PI) / 180;

  // Haversine formula to calculate distance
  const R = 6371; // Earth's radius in km
  const dLon = toRad(markerCoords[0] - userCoords[0]);
  const dLat = toRad(markerCoords[1] - userCoords[1]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userCoords[1])) *
      Math.cos(toRad(markerCoords[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Format distance in a user-friendly way
 * @param distance Distance in kilometers
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number | null): string => {
  if (distance === null) return "Unknown distance";

  if (distance < 1) {
    // Convert to meters if less than 1 km
    const meters = Math.round(distance * 1000);
    return `${meters} meters away`;
  } else {
    // Keep in km with one decimal place
    return `${distance.toFixed(1)} km away`;
  }
};
