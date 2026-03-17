// hooks/useMarkersGeoJSON.ts
// Converts Marker[] to a GeoJSON FeatureCollection for native Mapbox layers.
import { useMemo } from "react";
import type { Marker } from "@/types/types";
import type { FeatureCollection, Point } from "geojson";
import { getCategoryColor } from "@/utils/categoryColors";

export function useMarkersGeoJSON(
  markers: Marker[],
): FeatureCollection<Point> {
  return useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: markers.map((m) => {
        const category = m.data.categories?.[0] ?? "unknown";
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: m.coordinates,
          },
          properties: {
            id: m.id,
            category,
            categoryColor: getCategoryColor(category),
          },
        };
      }),
    }),
    [markers],
  );
}
