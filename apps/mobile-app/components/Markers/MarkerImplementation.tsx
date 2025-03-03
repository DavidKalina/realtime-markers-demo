// components/MarkerImplementation.tsx - Using unified location store
import React from "react";
import MapboxGL from "@rnmapbox/maps";
import { useLocationStore } from "@/stores/useLocationStore";
import { CustomMapMarker } from "./CustomMapMarker";

interface SimpleMapMarkersProps {
  // Optional markers prop - if not provided, will use markers from the store
  markers?: Array<{
    id: string;
    coordinates: [number, number];
    data: {
      title: string;
      emoji: string;
      location?: string;
      distance?: string;
      time?: string;
      description?: string;
      categories?: string[];
      isVerified?: boolean;
      color?: string;
    };
  }>;
}

export const SimpleMapMarkers: React.FC<SimpleMapMarkersProps> = ({ markers: propMarkers }) => {
  // Get marker data from store
  const storeMarkers = useLocationStore((state) => state.markers);
  const selectedMarkerId = useLocationStore((state) => state.selectedMarkerId);
  const selectMarker = useLocationStore((state) => state.selectMarker);

  // Use provided markers or fall back to store markers
  const markers = propMarkers || storeMarkers;

  // Handle marker selection
  const handleMarkerPress = (marker: any) => {
    // If we're selecting the same marker again, do nothing
    if (selectedMarkerId === marker.id) {
      return;
    }

    // Update marker selection in the unified store
    selectMarker(marker.id);
  };

  return (
    <>
      {markers
        .filter(
          (marker) =>
            // Ensure coordinates are valid
            Array.isArray(marker.coordinates) &&
            marker.coordinates.length === 2 &&
            !isNaN(marker.coordinates[0]) &&
            !isNaN(marker.coordinates[1])
        )
        .map((marker) => (
          <MapboxGL.MarkerView
            key={`marker-${marker.id}`}
            coordinate={marker.coordinates}
            anchor={{ x: 0.5, y: 1.0 }}
          >
            <CustomMapMarker
              event={{
                title: marker.data.title || "Unnamed Event",
                emoji: marker.data.emoji || "📍",
                location: marker.data.location || "Unknown location",
                distance: marker.data.distance || "Unknown distance",
                time: marker.data.time || new Date().toLocaleDateString(),
                description: marker.data.description || "",
                categories: marker.data.categories || [],
                isVerified: marker.data.isVerified || false,
                color: marker.data.color,
              }}
              isSelected={selectedMarkerId === marker.id}
              isHighlighted={false}
              onPress={() => handleMarkerPress(marker)}
            />
          </MapboxGL.MarkerView>
        ))}
    </>
  );
};
