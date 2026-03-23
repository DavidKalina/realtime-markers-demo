import { useMemo } from "react";
import { Delaunay } from "d3-delaunay";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { getDistrictColor } from "@/utils/districtUtils";
import type { FeatureCollection, Feature, Polygon } from "geojson";

/** Snap bounds to 0.01° grid to prevent recomputation on every pan pixel. */
const snapBound = (n: number): number => Math.round(n / 0.01) * 0.01;

export interface DistrictZoneProperties {
  districtId: string;
  name: string;
  explored: boolean;
  momentum: "rising" | "steady" | "cooling" | null;
  color: string;
}

/**
 * Computes Voronoi tessellation from district centroids and returns a
 * GeoJSON FeatureCollection for rendering as Mapbox FillLayer/LineLayer.
 */
export function useDistrictVoronoi(): FeatureCollection<
  Polygon,
  DistrictZoneProperties
> | null {
  const districts = useDistrictMapStore((s) => s.districts);
  const coverageMap = useDistrictMapStore((s) => s.coverageMap);

  return useMemo(() => {
    if (districts.length === 0) return null;

    // Build Delaunay from centroids [lng, lat]
    const points: [number, number][] = districts.map((d) => [
      d.centroidLng,
      d.centroidLat,
    ]);

    // Compute tight bounding box from district centroids with ~0.5° padding
    // This prevents cells from stretching across continents at low zoom
    const PADDING = 0.5; // ~55km
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of points) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const bounds: [number, number, number, number] = [
      snapBound(minLng - PADDING),
      snapBound(minLat - PADDING),
      snapBound(maxLng + PADDING),
      snapBound(maxLat + PADDING),
    ];

    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi(bounds);

    const features: Feature<Polygon, DistrictZoneProperties>[] = [];

    for (let i = 0; i < districts.length; i++) {
      const cell = voronoi.cellPolygon(i);
      if (!cell) continue;

      const district = districts[i];

      features.push({
        type: "Feature",
        properties: {
          districtId: district.id,
          name: district.name,
          explored: coverageMap[district.id] ?? false,
          momentum: district.momentum?.momentum ?? null,
          color: getDistrictColor(district),
        },
        geometry: {
          type: "Polygon",
          coordinates: [cell],
        },
      });
    }

    return {
      type: "FeatureCollection",
      features,
    };
  }, [districts, coverageMap]);
}
