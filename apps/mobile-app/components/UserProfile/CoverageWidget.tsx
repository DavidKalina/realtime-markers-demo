import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { apiClient } from "@/services/ApiClient";
import type { CoverageSummaryResponse } from "@/services/api/modules/coverage";
import {
  fontFamily,
  fontWeight,
  fontSize,
  spacing,
  radius,
  useColors,
  type Colors,
} from "@/theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? "");

const SHADE_COLOR = "#86efac";
const WIDGET_HEIGHT = 220;

// ── GeoJSON builders (shared with CoverageMap) ───────────────

function buildClustersGeoJSON(
  data: CoverageSummaryResponse,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.clusters.map((c, i) => ({
      type: "Feature",
      id: i,
      geometry: {
        type: "Point",
        coordinates: [c.longitude, c.latitude],
      },
      properties: {
        shade: c.shade,
        visitCount: c.visitCount,
      },
    })),
  };
}

function wrapGeometry(geojson: GeoJSON.Geometry): GeoJSON.FeatureCollection {
  if (geojson.type === "GeometryCollection") {
    return {
      type: "FeatureCollection",
      features: geojson.geometries.map((g, i) => ({
        type: "Feature" as const,
        id: i,
        geometry: g,
        properties: {},
      })),
    };
  }
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", id: 0, geometry: geojson, properties: {} }],
  };
}

function buildHomeGeoJSON(lat: number, lng: number): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 0,
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {},
      },
    ],
  };
}

// ── Compute bounds from clusters ─────────────────────────────

function computeBounds(
  data: CoverageSummaryResponse,
): { ne: [number, number]; sw: [number, number] } | null {
  const points: [number, number][] = data.clusters.map((c) => [c.longitude, c.latitude]);
  if (data.homeLatitude != null && data.homeLongitude != null) {
    points.push([data.homeLongitude, data.homeLatitude]);
  }
  if (points.length === 0) return null;

  let minLng = points[0][0], maxLng = points[0][0];
  let minLat = points[0][1], maxLat = points[0][1];
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // Add padding (10% of range, minimum 0.005 degrees ~0.5km)
  const lngPad = Math.max((maxLng - minLng) * 0.15, 0.005);
  const latPad = Math.max((maxLat - minLat) * 0.15, 0.005);

  return {
    sw: [minLng - lngPad, minLat - latPad],
    ne: [maxLng + lngPad, maxLat + latPad],
  };
}

// ── Component ────────────────────────────────────────────────

interface CoverageWidgetProps {
  data?: CoverageSummaryResponse | null;
}

export function CoverageWidget({ data: dataProp }: CoverageWidgetProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<CoverageSummaryResponse | null>(dataProp ?? null);
  const [loading, setLoading] = useState(!dataProp);

  useEffect(() => {
    if (dataProp) {
      setData(dataProp);
      setLoading(false);
      return;
    }
    apiClient.coverage
      .getSummary()
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [dataProp]);

  const clustersGeoJSON = useMemo(
    () => (data ? buildClustersGeoJSON(data) : null),
    [data],
  );

  const cellsGeoJSON = useMemo(
    () => (data?.cellsGeojson ? wrapGeometry(data.cellsGeojson) : null),
    [data],
  );

  const canvasGeoJSON = useMemo(
    () => (data?.canvasGeojson ? wrapGeometry(data.canvasGeojson) : null),
    [data],
  );

  const homeGeoJSON = useMemo(
    () =>
      data?.homeLatitude != null && data?.homeLongitude != null
        ? buildHomeGeoJSON(data.homeLatitude, data.homeLongitude)
        : null,
    [data],
  );

  const bounds = useMemo(() => (data ? computeBounds(data) : null), [data]);

  const centerCoord = useMemo(() => {
    if (data?.homeLongitude != null && data?.homeLatitude != null) {
      return [data.homeLongitude, data.homeLatitude];
    }
    return [-104.97, 40.1];
  }, [data]);

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.loadingBox}>
          <ActivityIndicator size="small" color={SHADE_COLOR} />
        </View>
      </View>
    );
  }

  if (!data || data.clusters.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.sectionLabel}>YOUR TERRITORY</Text>
        <View style={s.emptyBox}>
          <Text style={s.emptyText}>Complete quests to map your world.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>YOUR TERRITORY</Text>
      <View style={s.mapWrapper}>
        <Mapbox.MapView
          style={s.map}
          styleURL="mapbox://styles/mapbox/dark-v11"
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          scrollEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          zoomEnabled={false}
        >
          {bounds ? (
            <Mapbox.Camera
              defaultSettings={{
                bounds: { ne: bounds.ne, sw: bounds.sw },
              }}
              animationMode="flyTo"
              animationDuration={800}
            />
          ) : (
            <Mapbox.Camera
              defaultSettings={{
                centerCoordinate: centerCoord,
                zoomLevel: 12,
              }}
            />
          )}

          {/* Canvas outline */}
          {canvasGeoJSON && (
            <Mapbox.ShapeSource id="cw-canvas" shape={canvasGeoJSON}>
              <Mapbox.LineLayer
                id="cw-canvas-outline"
                style={{
                  lineColor: SHADE_COLOR,
                  lineWidth: 1,
                  lineOpacity: 0.2,
                  lineDasharray: [4, 4],
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Voronoi cells */}
          {cellsGeoJSON && (
            <Mapbox.ShapeSource id="cw-voronoi" shape={cellsGeoJSON}>
              <Mapbox.FillLayer
                id="cw-voronoi-fill"
                style={{
                  fillColor: SHADE_COLOR,
                  fillOpacity: 0.12,
                }}
              />
              <Mapbox.LineLayer
                id="cw-voronoi-borders"
                style={{
                  lineColor: SHADE_COLOR,
                  lineWidth: 0.8,
                  lineOpacity: 0.25,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Clusters */}
          {clustersGeoJSON && (
            <Mapbox.ShapeSource id="cw-clusters" shape={clustersGeoJSON}>
              <Mapbox.CircleLayer
                id="cw-cluster-circles"
                style={{
                  circleRadius: [
                    "interpolate",
                    ["linear"],
                    ["get", "visitCount"],
                    1, 6,
                    3, 10,
                    5, 14,
                    10, 20,
                  ],
                  circleColor: SHADE_COLOR,
                  circleOpacity: [
                    "interpolate",
                    ["linear"],
                    ["get", "shade"],
                    0, 0.15,
                    0.3, 0.3,
                    0.6, 0.5,
                    0.9, 0.8,
                  ],
                  circleStrokeWidth: 1,
                  circleStrokeColor: SHADE_COLOR,
                  circleStrokeOpacity: 0.3,
                  circleBlur: 0.3,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Home */}
          {homeGeoJSON && (
            <Mapbox.ShapeSource id="cw-home" shape={homeGeoJSON}>
              <Mapbox.CircleLayer
                id="cw-home-marker"
                style={{
                  circleRadius: 5,
                  circleColor: "#ffffff",
                  circleStrokeWidth: 2,
                  circleStrokeColor: SHADE_COLOR,
                }}
              />
            </Mapbox.ShapeSource>
          )}
        </Mapbox.MapView>

        {/* Stats overlay */}
        <View style={s.statsRow}>
          <Text style={s.statText}>
            {data.stats.territorySqMiles.toFixed(1)} mi²
          </Text>
          <Text style={s.statDivider}>·</Text>
          <Text style={s.statText}>
            {data.stats.clusterCount} zones
          </Text>
          {data.directionalGaps.length > 0 && (
            <>
              <Text style={s.statDivider}>·</Text>
              <Text style={s.gapText}>
                Gap {data.directionalGaps[0].direction}
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 1.5,
    },
    mapWrapper: {
      height: WIDGET_HEIGHT,
      borderRadius: radius.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.15)",
    },
    map: {
      flex: 1,
    },
    statsRow: {
      position: "absolute",
      bottom: spacing.sm,
      left: spacing.sm,
      right: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: radius.full,
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
    },
    statText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: SHADE_COLOR,
    },
    statDivider: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
    },
    gapText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    loadingBox: {
      height: WIDGET_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
    },
    emptyBox: {
      height: WIDGET_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
  });
