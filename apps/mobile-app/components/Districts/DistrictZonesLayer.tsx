// components/Districts/DistrictZonesLayer.tsx
//
// Renders district Voronoi zones on the map using native Mapbox layers.
// Each district is tinted with its activity color (amber, green, blue, etc.)
// with soft green borders and name labels at centroids.

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

  // ── Fill style — always show district activity color ──────────────
  const fillStyle = useMemo(
    () => ({
      fillColor: ["get", "color"] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      fillOpacity: [
        "interpolate",
        ["linear"],
        ["zoom"],
        5, 0.1 * baseOpacity,
        8, 0.12 * baseOpacity,
        12, 0.15 * baseOpacity,
        16, 0.12 * baseOpacity,
        20, 0.1 * baseOpacity,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
    [baseOpacity],
  );

  // ── Border style ─────────────────────────────────────────────────
  const lineStyle = useMemo(
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
        5, 0.15 * baseOpacity,
        9, 0.3 * baseOpacity,
        12, 0.7 * baseOpacity,
        16, 0.4 * baseOpacity,
        20, 0.25 * baseOpacity,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
      textColor: ["get", "color"] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
        id="district-border"
        style={lineStyle}
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
