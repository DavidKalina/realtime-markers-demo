import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { apiClient } from "@/services/ApiClient";
import type { CoverageSummaryResponse } from "@/services/api/modules/coverage";
import { useUserLocation } from "@/contexts/LocationContext";
import {
  fontFamily,
  fontWeight,
  spacing,
  radius,
  useColors,
  type Colors,
} from "@/theme";

// Set Mapbox access token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? "");

const SHADE_COLOR = "#86efac"; // accent.primary

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
        categories: c.venueCategories.join(", "),
      },
    })),
  };
}

function buildHomeGeoJSON(
  lat: number,
  lng: number,
): GeoJSON.FeatureCollection {
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

/**
 * Wrap raw GeoJSON geometry (GeometryCollection or Polygon) from PostGIS
 * into a FeatureCollection that Mapbox ShapeSource can consume.
 */
function wrapGeometry(
  geojson: GeoJSON.Geometry,
): GeoJSON.FeatureCollection {
  // GeometryCollection → explode into individual features
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

  // Single geometry (Polygon, MultiPolygon, etc.)
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 0,
        geometry: geojson,
        properties: {},
      },
    ],
  };
}

export default function CoverageMap() {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { location } = useUserLocation();

  const [data, setData] = useState<CoverageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCoverage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await apiClient.coverage.getSummary();
      setData(summary);
    } catch (err) {
      console.error("[CoverageMap] Failed to fetch:", err);
      setError("Could not load coverage data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const clustersGeoJSON = useMemo(
    () => (data ? buildClustersGeoJSON(data) : null),
    [data],
  );

  const homeGeoJSON = useMemo(
    () =>
      data?.homeLatitude != null && data?.homeLongitude != null
        ? buildHomeGeoJSON(data.homeLatitude, data.homeLongitude)
        : null,
    [data],
  );

  // Voronoi cells from PostGIS
  const cellsGeoJSON = useMemo(
    () => (data?.cellsGeojson ? wrapGeometry(data.cellsGeojson) : null),
    [data],
  );

  // Canvas (buffered convex hull)
  const canvasGeoJSON = useMemo(
    () => (data?.canvasGeojson ? wrapGeometry(data.canvasGeojson) : null),
    [data],
  );

  // Center on home, fallback to user location
  const centerCoord = useMemo(() => {
    if (data?.homeLongitude != null && data?.homeLatitude != null) {
      return [data.homeLongitude, data.homeLatitude];
    }
    if (location) {
      return [location.coords.longitude, location.coords.latitude];
    }
    return [-105.1, 40.0]; // Colorado fallback
  }, [data, location]);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>{error ?? "No data"}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Mapbox.MapView
        style={s.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          defaultSettings={{
            centerCoordinate: centerCoord,
            zoomLevel: 12,
          }}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* Canvas outline (buffered convex hull) */}
        {canvasGeoJSON && (
          <Mapbox.ShapeSource id="canvas" shape={canvasGeoJSON}>
            <Mapbox.LineLayer
              id="canvas-outline"
              style={{
                lineColor: SHADE_COLOR,
                lineWidth: 1,
                lineOpacity: 0.2,
                lineDasharray: [4, 4],
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Voronoi cells — filled polygons with shade-based opacity */}
        {cellsGeoJSON && (
          <Mapbox.ShapeSource id="voronoi-cells" shape={cellsGeoJSON}>
            <Mapbox.FillLayer
              id="voronoi-fill"
              style={{
                fillColor: SHADE_COLOR,
                fillOpacity: 0.12,
              }}
            />
            <Mapbox.LineLayer
              id="voronoi-borders"
              style={{
                lineColor: SHADE_COLOR,
                lineWidth: 0.8,
                lineOpacity: 0.25,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Cluster circles — shade mapped to opacity */}
        {clustersGeoJSON && (
          <Mapbox.ShapeSource id="clusters" shape={clustersGeoJSON}>
            <Mapbox.CircleLayer
              id="cluster-circles"
              style={{
                circleRadius: [
                  "interpolate",
                  ["linear"],
                  ["get", "visitCount"],
                  1, 8,
                  3, 14,
                  5, 20,
                  10, 28,
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
                circleStrokeOpacity: 0.4,
                circleBlur: 0.3,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Home marker */}
        {homeGeoJSON && (
          <Mapbox.ShapeSource id="home" shape={homeGeoJSON}>
            <Mapbox.CircleLayer
              id="home-marker"
              style={{
                circleRadius: 6,
                circleColor: "#ffffff",
                circleStrokeWidth: 2,
                circleStrokeColor: SHADE_COLOR,
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* Stats overlay */}
      <View style={s.statsOverlay}>
        <View style={s.statRow}>
          <StatPill label="Zones" value={String(data.stats.clusterCount)} colors={colors} />
          <StatPill
            label="Territory"
            value={`${data.stats.territorySqMiles.toFixed(1)} mi²`}
            colors={colors}
          />
          <StatPill
            label="Density"
            value={`${(data.stats.avgDensity * 100).toFixed(0)}%`}
            colors={colors}
          />
        </View>
        {data.directionalGaps.length > 0 && (
          <View style={s.gapsRow}>
            <Text style={s.gapsLabel}>GAPS</Text>
            <Text style={s.gapsText}>
              {data.directionalGaps
                .slice(0, 3)
                .map((g) => g.direction.toUpperCase())
                .join(" · ")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatPill({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: Colors;
}) {
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.statPill}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    map: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg.primary,
    },
    errorText: {
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      fontSize: 13,
    },

    // Stats overlay
    statsOverlay: {
      position: "absolute",
      bottom: 40,
      left: spacing.lg,
      right: spacing.lg,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    statPill: {
      alignItems: "center",
      gap: 2,
    },
    statValue: {
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      fontSize: 16,
      color: colors.accent.primary,
    },
    statLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    gapsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    gapsLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
    },
    gapsText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
  });
