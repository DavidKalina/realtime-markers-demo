import { useMemo } from "react";
import { Delaunay } from "d3-delaunay";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { getDistrictColor } from "@/utils/districtUtils";
import type { FeatureCollection, Feature, Polygon } from "geojson";

/**
 * Snap bounds outward to a coarse 0.1° grid (~11km).
 * Keeps the Voronoi clip rectangle stable across small centroid changes.
 */
const snapFloor = (n: number): number => Math.floor(n / 0.1) * 0.1;
const snapCeil = (n: number): number => Math.ceil(n / 0.1) * 0.1;

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
 *
 * Districts are sorted by id for stable index assignment, and bounds are
 * snapped to a coarse grid with generous padding to prevent jitter.
 */
export function useDistrictVoronoi(): FeatureCollection<
  Polygon,
  DistrictZoneProperties
> | null {
  const districts = useDistrictMapStore((s) => s.districts);
  const coverageMap = useDistrictMapStore((s) => s.coverageMap);

  return useMemo(() => {
    if (districts.length === 0) return null;

    // Sort districts by id for stable Delaunay index assignment.
    // Without this, merging new districts changes array order which
    // reshuffles which centroid gets which Voronoi cell.
    const sorted = [...districts].sort((a, b) => a.id.localeCompare(b.id));

    // Build Delaunay from centroids [lng, lat]
    const points: [number, number][] = sorted.map((d) => [
      d.centroidLng,
      d.centroidLat,
    ]);

    // Generous padding (~1° ≈ 111km) so edge cells don't clip prematurely.
    // Snapping outward to 0.1° grid prevents tiny centroid shifts from
    // changing the clip rectangle and triggering a full retessellation.
    const PADDING = 1.0;
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of points) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    const bounds: [number, number, number, number] = [
      snapFloor(minLng - PADDING),
      snapFloor(minLat - PADDING),
      snapCeil(maxLng + PADDING),
      snapCeil(maxLat + PADDING),
    ];

    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi(bounds);

    const features: Feature<Polygon, DistrictZoneProperties>[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const cell = voronoi.cellPolygon(i);
      if (!cell) continue;

      const district = sorted[i];

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
