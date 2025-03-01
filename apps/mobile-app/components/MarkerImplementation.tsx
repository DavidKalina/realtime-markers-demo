// components/MarkerImplementation.tsx - Updated with EventBroker
import React from "react";
import MapboxGL from "@rnmapbox/maps";
import { useMarkerStore } from "@/stores/markerStore";
import { CustomMapMarker } from "./CustomMapMarker";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes, MarkerEvent } from "@/services/EventBroker";

interface SimpleMapMarkersProps {
  markers: Array<{
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

export const SimpleMapMarkers: React.FC<SimpleMapMarkersProps> = ({ markers }) => {
  // Get selected marker from your store
  const selectedMarker = useMarkerStore((state) => state.selectedMarker);
  const setSelectedMarker = useMarkerStore((state) => state.selectMarker);
  const { publish } = useEventBroker();

  // Handle marker selection
  const handleMarkerPress = (marker: any) => {
    // If we're selecting the same marker again, do nothing
    if (selectedMarker?.id === marker.id) {
      return;
    }

    // Update the marker store
    setSelectedMarker(marker.id);

    // Emit marker selection event
    publish<MarkerEvent>(EventTypes.MARKER_SELECTED, {
      timestamp: Date.now(),
      source: "SimpleMapMarkers",
      markerId: marker.id,
      markerData: marker,
    });
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
              isSelected={selectedMarker?.id === marker.id}
              isHighlighted={false}
              onPress={() => handleMarkerPress(marker)}
            />
          </MapboxGL.MarkerView>
        ))}
    </>
  );
};
