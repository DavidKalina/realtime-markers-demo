import { useState, useEffect } from "react";
import { Platform, Linking, Alert } from "react-native";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface MapLinks {
  universalLink: string;
  googleLink: string;
  appleLink: string;
}

interface UseMapLinksReturn {
  mapLinks: MapLinks | null;
  openMap: () => Promise<void>;
}

export const useMapLinks = (location?: string, coordinates?: Coordinates): UseMapLinksReturn => {
  const [mapLinks, setMapLinks] = useState<MapLinks | null>(null);

  // Generate map links when location changes
  useEffect(() => {
    if (location) {
      const links = generateMapLink(location, coordinates);
      setMapLinks(links);
    }
  }, [location, coordinates]);

  // Generate map link for the location
  const generateMapLink = (location: string, coordinates?: Coordinates): MapLinks => {
    // Encode the location for URL
    const encodedLocation = encodeURIComponent(location);

    // If we have precise coordinates, use them for more accurate mapping
    if (coordinates && coordinates.latitude && coordinates.longitude) {
      const { latitude, longitude } = coordinates;

      // Create Apple Maps link with exact coordinates
      const appleMapLink = `https://maps.apple.com/?q=${encodedLocation}&ll=${latitude},${longitude}`;

      // Create Google Maps link with exact coordinates
      const googleMapLink = `https://maps.google.com/?q=${latitude},${longitude}`;

      return {
        universalLink: Platform.OS === "ios" ? appleMapLink : googleMapLink,
        googleLink: googleMapLink,
        appleLink: appleMapLink,
      };
    } else {
      // Create universal map link that works on both iOS and Android, but just with location name
      const mapLink = `https://maps.apple.com/?q=${encodedLocation}`;

      // Alternative: create a Google Maps link that works on both platforms
      const googleMapLink = `https://maps.google.com/?q=${encodedLocation}`;

      return {
        universalLink: Platform.OS === "ios" ? mapLink : googleMapLink,
        googleLink: googleMapLink,
        appleLink: mapLink,
      };
    }
  };

  // Function to open map directly
  const openMap = async () => {
    if (!mapLinks) return;

    try {
      const canOpen = await Linking.canOpenURL(mapLinks.universalLink);
      if (canOpen) {
        await Linking.openURL(mapLinks.universalLink);
      } else {
        // Fall back to Google Maps if the universal link doesn't work
        await Linking.openURL(mapLinks.googleLink);
      }
    } catch (error) {
      console.error("Error opening map:", error);
      Alert.alert("Cannot Open Map", "Unable to open maps application.");
    }
  };

  return {
    mapLinks,
    openMap,
  };
};
