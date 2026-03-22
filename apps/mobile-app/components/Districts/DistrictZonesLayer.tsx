// components/Districts/DistrictZonesLayer.tsx
//
// Renders district Voronoi zones on the map using native Mapbox layers.
// - Explored districts: green tint with solid borders
// - Unexplored districts: dark fog with dashed borders (fog of war)
// - District name labels at polygon centroids
// Layers are zoom-interpolated to be visible at zoom 8–15.

import React, { useCallback, useMemo } from "react";
import MapboxGL from "@rnmapbox/maps";
import { useDistrictVoronoi } from "@/hooks/useDistrictVoronoi";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { getDistrictColor } from "@/utils/districtUtils";
import type { FeatureCollection, Point } from "geojson";
import type { DistrictZoneProperties } from "@/hooks/useDistrictVoronoi";

interface DistrictZonesLayerProps {
  dimmed?: boolean;
  onDistrictPress?: (districtId: string) => void;
}

const DistrictZonesLayerInner: React.FC<DistrictZonesLayerProps> = ({
  dimmed = false,
  onDistrictPress,
}) => {
  const voronoiGeoJSON = useDistrictVoronoi();
  const districts = useDistrictMapStore((s) => s.districts);
  const coverageMap = useDistrictMapStore((s) => s.coverageMap);

  const baseOpacity = dimmed ? 0.3 : 1;

  // Point GeoJSON for labels — placed at actual district centroids, not polygon centers
  const labelGeoJSON = useMemo((): FeatureCollection<
    Point,
    DistrictZoneProperties
  > | null => {
    if (districts.length === 0) return null;
    return {
      type: "FeatureCollection",
      features: districts.map((d) => ({
        type: "Feature" as const,
        properties: {
          districtId: d.id,
          name: d.name,
          explored: coverageMap[d.id] ?? false,
          momentum: d.momentum?.momentum ?? null,
          color: getDistrictColor(d),
        },
        geometry: {
          type: "Point" as const,
          coordinates: [d.centroidLng, d.centroidLat],
        },
      })),
    };
  }, [districts, coverageMap]);

  // ── Fill style (fog of war) ────────────────────────────────────────
  const fillStyle = useMemo(
    () => ({
      fillColor: [
        "case",
        ["get", "explored"],
        ["get", "color"], // Explored: district's activity color
        "rgba(10, 10, 20, 1)", // Unexplored: dark blue-shifted fog
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      fillOpacityTransition: { duration: 500, delay: 0 },
      fillOpacity: [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        ["case", ["get", "explored"], 0.06 * baseOpacity, 0.2 * baseOpacity] as any,
        8,
        ["case", ["get", "explored"], 0.08 * baseOpacity, 0.3 * baseOpacity] as any,
        12,
        ["case", ["get", "explored"], 0.12 * baseOpacity, 0.4 * baseOpacity] as any,
        16,
        ["case", ["get", "explored"], 0.07 * baseOpacity, 0.22 * baseOpacity] as any,
        20,
        ["case", ["get", "explored"], 0.04 * baseOpacity, 0.12 * baseOpacity] as any,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
    [baseOpacity],
  );

  // ── Border styles (split: lineDasharray doesn't support data expressions) ──
  const exploredLineFilter = ["==", ["get", "explored"], true] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const unexploredLineFilter = ["==", ["get", "explored"], false] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const exploredLineStyle = useMemo(
    () => ({
      lineColor: "rgba(134, 239, 172, 0.5)",
      lineBlur: 3,
      lineWidth: [
        "interpolate", ["linear"], ["zoom"],
        5, 0.3,
        10, 0.75,
        13, 2,
        18, 1,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      lineOpacity: [
        "interpolate", ["linear"], ["zoom"],
        5, 0.1 * baseOpacity,
        9, 0.25 * baseOpacity,
        12, 0.7 * baseOpacity,
        16, 0.3 * baseOpacity,
        20, 0.15 * baseOpacity,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      lineOpacityTransition: { duration: 500, delay: 0 },
    }),
    [baseOpacity],
  );

  const unexploredLineStyle = useMemo(
    () => ({
      lineColor: "rgba(255, 255, 255, 0.15)",
      lineWidth: [
        "interpolate", ["linear"], ["zoom"],
        5, 0.3,
        10, 0.5,
        13, 1.5,
        18, 0.75,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      lineDasharray: [4, 4],
      lineOpacity: [
        "interpolate", ["linear"], ["zoom"],
        5, 0.05 * baseOpacity,
        9, 0.15 * baseOpacity,
        12, 0.5 * baseOpacity,
        16, 0.2 * baseOpacity,
        20, 0.1 * baseOpacity,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      lineOpacityTransition: { duration: 500, delay: 0 },
    }),
    [baseOpacity],
  );

  // ── Name labels ────────────────────────────────────────────────────
  const labelStyle = useMemo(
    () => ({
      textField: ["get", "name"] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      textSize: [
        "interpolate",
        ["linear"],
        ["zoom"],
        6, 8,
        10, 11,
        13, 14,
        16, 12,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      textFont: ["DIN Pro Bold"],
      textColor: [
        "case",
        ["get", "explored"],
        ["get", "color"], // Explored: district's activity color
        "rgba(255, 255, 255, 0.3)", // Unexplored: dim
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      textHaloColor: "rgba(0, 0, 0, 0.7)",
      textHaloWidth: 1,
      textAllowOverlap: false,
      textIgnorePlacement: false,
      textOpacity: [
        "interpolate",
        ["linear"],
        ["zoom"],
        5, 0.3 * baseOpacity,
        8, 0.6 * baseOpacity,
        12, 1 * baseOpacity,
        16, 0.5 * baseOpacity,
        20, 0.3 * baseOpacity,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
    [baseOpacity],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePress = useCallback((event: any) => {
    if (!onDistrictPress) return;
    const feature = event?.features?.[0];
    const districtId = feature?.properties?.districtId;
    if (districtId) {
      onDistrictPress(districtId);
    }
  }, [onDistrictPress]);

  if (!voronoiGeoJSON || voronoiGeoJSON.features.length === 0) return null;

  return (
  <>
    <MapboxGL.ShapeSource
      id="district-zones"
      shape={voronoiGeoJSON}
      onPress={onDistrictPress ? handlePress : undefined}
      hitbox={onDistrictPress ? { width: 44, height: 44 } : { width: 0, height: 0 }}
    >
      <MapboxGL.FillLayer
        id="district-fill"
        style={fillStyle}
      />
      <MapboxGL.LineLayer
        id="district-border-explored"
        filter={exploredLineFilter}
        style={exploredLineStyle}
        aboveLayerID="district-fill"
      />
      <MapboxGL.LineLayer
        id="district-border-unexplored"
        filter={unexploredLineFilter}
        style={unexploredLineStyle}
        aboveLayerID="district-fill"
      />
    </MapboxGL.ShapeSource>
    {labelGeoJSON && (
      <MapboxGL.ShapeSource
        id="district-label-points"
        shape={labelGeoJSON}
        hitbox={{ width: 0, height: 0 }}
      >
        <MapboxGL.SymbolLayer
          id="district-label"
          style={labelStyle}
        />
      </MapboxGL.ShapeSource>
    )}
  </>
  );
};

export const DistrictZonesLayer = React.memo(DistrictZonesLayerInner);
