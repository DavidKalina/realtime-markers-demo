// components/Markers/MapDensityLayers.tsx
//
// GPU-native density visualization for low and mid zoom levels.
// - Zoom < 10:  HeatmapLayer  — smooth density cloud
// - Zoom 10–13: CircleLayer clusters + SymbolLayer count labels
// At zoom >= 14 the existing ClusteredMapMarkers (MarkerView pool) takes over.
import React, { useMemo } from "react";
import MapboxGL from "@rnmapbox/maps";
import { useLocationStore } from "@/stores/useLocationStore";
import { useMarkersGeoJSON } from "@/hooks/useMarkersGeoJSON";

interface MapDensityLayersProps {
  dimmed?: boolean;
}

// Mapbox native clustering stops at this zoom — handoff to MarkerView pool
const CLUSTER_MAX_ZOOM = 13;
const HEATMAP_MAX_ZOOM = 10;
const CIRCLE_MIN_ZOOM = 10;
const CIRCLE_MAX_ZOOM = 14;

const MapDensityLayersInner: React.FC<MapDensityLayersProps> = ({
  dimmed = false,
}) => {
  const markers = useLocationStore((s) => s.markers);
  const geojson = useMarkersGeoJSON(markers);

  const baseOpacity = dimmed ? 0.35 : 1;

  // ── Heatmap style (zoom < 10) ──────────────────────────────────────
  const heatmapStyle = useMemo(
    () => ({
      heatmapWeight: 1,
      heatmapIntensity: [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        HEATMAP_MAX_ZOOM,
        3,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      heatmapRadius: [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        4,
        HEATMAP_MAX_ZOOM,
        25,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      heatmapColor: [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(0, 0, 0, 0)",
        0.15,
        "rgba(56, 189, 248, 0.35)", // action.map (#38bdf8) — faint sky glow
        0.35,
        "rgba(134, 239, 172, 0.55)", // accent.primary (#86efac) — brand green
        0.55,
        "rgba(52, 211, 153, 0.7)", // action.rsvp (#34d399) — emerald
        0.75,
        "rgba(251, 191, 36, 0.85)", // action.save (#fbbf24) — amber
        1,
        "rgba(167, 139, 250, 0.95)", // action.share (#a78bfa) — violet hot
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      // Fade out as we approach the circle layer
      heatmapOpacity: [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        0.85 * baseOpacity,
        HEATMAP_MAX_ZOOM - 1,
        0.75 * baseOpacity,
        HEATMAP_MAX_ZOOM,
        0,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
    [baseOpacity],
  );

  // ── Circle cluster style (zoom 10–13) ──────────────────────────────
  // Matches ClusterMarker's createColorSchemes: dark fill for small/medium,
  // accent green for large (15+).
  const clusterCircleStyle = useMemo(
    () => ({
      circleColor: [
        "step",
        ["get", "point_count"],
        "#2a2a2a", // < 15: bg.card (dark, like small/medium ClusterMarker)
        15,
        "#86efac", // 15+: accent.primary (green, like large ClusterMarker)
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      circleRadius: [
        "step",
        ["get", "point_count"],
        15, // < 10
        10,
        20, // 10–49
        50,
        25, // 50–99
        100,
        35, // 100+
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      circleOpacity: 0.85 * baseOpacity,
      circleStrokeWidth: [
        "step",
        ["get", "point_count"],
        2,  // < 15: white stroke (matches small/medium ClusterMarker)
        15,
        2,  // 15+: accent.dark stroke
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      circleStrokeColor: [
        "step",
        ["get", "point_count"],
        "#E2E8F0", // < 15: brand.markerStroke (like small/medium ClusterMarker)
        15,
        "#22c55e", // 15+: accent.dark (like large ClusterMarker)
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      circleStrokeOpacity: baseOpacity,
    }),
    [baseOpacity],
  );

  // ── Cluster count label style ──────────────────────────────────────
  // Note: SymbolLayer can only use fonts bundled in the Mapbox style.
  // "DIN Pro Bold" is the closest to SpaceMono's tight, technical feel
  // among the default Mapbox style fonts.
  const clusterLabelStyle = useMemo(
    () => ({
      textField: ["get", "point_count_abbreviated"] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      textSize: 13,
      textFont: ["DIN Pro Bold"],
      textColor: "#f8f9fa", // text.primary
      textAllowOverlap: true,
      textIgnorePlacement: true,
    }),
    [],
  );

  // ── Unclustered single dots (zoom 10–13) ───────────────────────────
  // Each dot is colored by its category, using the same getCategoryColor()
  // palette as the emoji markers at high zoom.
  const unclusteredDotStyle = useMemo(
    () => ({
      circleRadius: 6,
      circleColor: ["get", "categoryColor"] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      circleOpacity: 0.9 * baseOpacity,
      circleStrokeWidth: 1.5,
      circleStrokeColor: "rgba(255, 255, 255, 0.3)",
      circleStrokeOpacity: baseOpacity,
    }),
    [baseOpacity],
  );

  // Don't mount the source until we have data
  if (geojson.features.length === 0) return null;

  return (
    <MapboxGL.ShapeSource
      id="event-density"
      shape={geojson}
      cluster
      clusterRadius={50}
      clusterMaxZoomLevel={CLUSTER_MAX_ZOOM}
      hitbox={{ width: 0, height: 0 }}
    >
      {/* Tier 1: Heatmap — zoom < 10 */}
      <MapboxGL.HeatmapLayer
        id="event-heatmap"
        maxZoomLevel={HEATMAP_MAX_ZOOM}
        style={heatmapStyle}
      />

      {/* Tier 2: Clustered circles — zoom 10–13 */}
      <MapboxGL.CircleLayer
        id="event-clusters"
        filter={["has", "point_count"]}
        minZoomLevel={CIRCLE_MIN_ZOOM}
        maxZoomLevel={CIRCLE_MAX_ZOOM}
        style={clusterCircleStyle}
      />

      {/* Tier 2: Count labels — zoom 10–13 */}
      <MapboxGL.SymbolLayer
        id="event-cluster-count"
        filter={["has", "point_count"]}
        minZoomLevel={CIRCLE_MIN_ZOOM}
        maxZoomLevel={CIRCLE_MAX_ZOOM}
        style={clusterLabelStyle}
      />

      {/* Tier 2: Unclustered single dots — zoom 10–13 */}
      <MapboxGL.CircleLayer
        id="event-unclustered-dot"
        filter={["!", ["has", "point_count"]]}
        minZoomLevel={CIRCLE_MIN_ZOOM}
        maxZoomLevel={CIRCLE_MAX_ZOOM}
        style={unclusteredDotStyle}
      />
    </MapboxGL.ShapeSource>
  );
};

export const MapDensityLayers = React.memo(MapDensityLayersInner);
