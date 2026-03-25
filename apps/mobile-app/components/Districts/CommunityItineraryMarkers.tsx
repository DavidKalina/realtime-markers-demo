// components/Districts/CommunityItineraryMarkers.tsx
//
// GPU-rendered community itinerary markers using Mapbox native layers.
// Instead of spawning 60+ native MarkerView instances (which crashes physical
// devices), we render ALL markers via ShapeSource → CircleLayer + SymbolLayer.
//
// Emoji icons are pre-rasterised by EmojiMapImageGenerator (hidden SVGs →
// toDataURL → base64 PNGs) and registered with MapboxGL.Images so the
// SymbolLayer can reference them via iconImage.
//
// Only the SELECTED marker gets a single native MarkerView for the
// interactive glow/animation treatment.

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import MapboxGL from "@rnmapbox/maps";
import { Delaunay } from "d3-delaunay";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { getDistrictColor } from "@/utils/districtUtils";
import { markerImageKey } from "./EmojiMapImageGenerator";
import type { BrowseItineraryPreview } from "@/services/api/modules/districts";
import type { FeatureCollection, Point } from "geojson";

interface CommunityItineraryMarkersProps {
  dimmed?: boolean;
  hidden?: boolean;
  onSelect: (itinerary: BrowseItineraryPreview, districtId: string) => void;
  selectedId: string | null;
  /** Pre-rasterised emoji images from EmojiMapImageGenerator */
  emojiImages: Record<string, { uri: string }>;
}

interface MarkerFeatureProperties {
  id: string;
  emoji: string;
  emojiKey: string;
  borderColor: string;
  districtId: string;
  /** JSON-stringified BrowseItineraryPreview for tap handler lookup */
  itineraryJson: string;
}

const DEFAULT_BORDER_COLOR = "#86efac";

// ---------------------------------------------------------------------------
// Selected marker overlay — the only native MarkerView we ever mount
// ---------------------------------------------------------------------------

const SelectedMarkerOverlay = React.memo(
  ({
    coordinate,
    emoji,
    borderColor,
  }: {
    coordinate: [number, number];
    emoji: string;
    borderColor: string;
  }) => {
    const scale = useSharedValue(0.6);
    const opacity = useSharedValue(0);

    useEffect(() => {
      scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.7 });
      opacity.value = withTiming(1, { duration: 180 });
      return () => {
        cancelAnimation(scale);
        cancelAnimation(opacity);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const animStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    }));

    return (
      <MapboxGL.MarkerView
        id="community-selected"
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        allowOverlap
      >
        <Animated.View style={animStyle}>
          <View style={[styles.selectedMarker, { borderColor }]}>
            <Text style={styles.selectedEmoji}>{emoji}</Text>
          </View>
        </Animated.View>
      </MapboxGL.MarkerView>
    );
  },
);

// ---------------------------------------------------------------------------
// Main component — GPU-native layers + single MarkerView for selection
// ---------------------------------------------------------------------------

const CommunityItineraryMarkersInner: React.FC<
  CommunityItineraryMarkersProps
> = ({ dimmed = false, hidden = false, onSelect, selectedId, emojiImages }) => {
  const streamedItineraries = useDistrictMapStore(
    (s) => s.streamedItineraries,
  );
  const districts = useDistrictMapStore((s) => s.districts);

  // Stable ref for onSelect to avoid GeoJSON rebuilds
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Build a Delaunay lookup from district centroids for point → district mapping
  const districtLookup = useMemo(() => {
    if (districts.length === 0) return null;
    const sorted = [...districts].sort((a, b) => a.id.localeCompare(b.id));
    const points: [number, number][] = sorted.map((d) => [
      d.centroidLng,
      d.centroidLat,
    ]);
    const delaunay = Delaunay.from(points);
    return { delaunay, sorted };
  }, [districts]);

  // Build GeoJSON FeatureCollection for the ShapeSource
  const geojson = useMemo(() => {
    if (!districtLookup) {
      return {
        type: "FeatureCollection" as const,
        features: [],
      } as FeatureCollection<Point, MarkerFeatureProperties>;
    }

    const features = streamedItineraries
      .filter((itin) => itin.entryLatitude && itin.entryLongitude)
      .map((itin) => {
        const lng = itin.entryLongitude!;
        const lat = itin.entryLatitude!;

        let districtId = "";
        let borderColor = DEFAULT_BORDER_COLOR;

        const idx = districtLookup.delaunay.find(lng, lat);
        const district = districtLookup.sorted[idx];
        if (district) {
          districtId = district.id;
          borderColor = getDistrictColor(district);
        }

        const emoji = itin.items?.[0]?.emoji ?? "\u{1F4CD}";

        return {
          type: "Feature" as const,
          properties: {
            id: itin.id,
            emoji,
            emojiKey: markerImageKey(emoji, borderColor),
            borderColor,
            districtId,
            itineraryJson: JSON.stringify(itin),
          },
          geometry: {
            type: "Point" as const,
            coordinates: [lng, lat],
          },
        };
      });

    return {
      type: "FeatureCollection" as const,
      features,
    } as FeatureCollection<Point, MarkerFeatureProperties>;
  }, [streamedItineraries, districtLookup]);

  // Find selected marker data for the overlay MarkerView
  const selectedMarker = useMemo(() => {
    if (!selectedId) return null;
    const feature = geojson.features.find(
      (f) => f.properties.id === selectedId,
    );
    if (!feature) return null;
    return {
      coordinate: feature.geometry.coordinates as [number, number],
      emoji: feature.properties.emoji,
      borderColor: feature.properties.borderColor,
    };
  }, [selectedId, geojson]);

  const baseOpacity = dimmed ? 0.35 : 1;
  const layerOpacity = hidden ? 0 : baseOpacity;

  // ── Emoji icon style (GPU-rendered via pre-rasterised images) ────
  const emojiIconStyle = useMemo(
    () => ({
      iconImage: ["get", "emojiKey"] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      iconSize: [
        "interpolate",
        ["linear"],
        ["zoom"],
        6, 0.08,
        9, 0.12,
        12, 0.16,
        15, 0.2,
        18, 0.25,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      iconAllowOverlap: true,
      iconIgnorePlacement: true,
      iconOpacity: layerOpacity,
    }),
    [layerOpacity],
  );

  // ── Tap handler ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePress = useCallback((event: any) => {
    const feature = event?.features?.[0];
    if (!feature?.properties) return;

    const { id, districtId, itineraryJson } = feature.properties;
    if (!id || !itineraryJson) return;

    try {
      const itinerary: BrowseItineraryPreview = JSON.parse(itineraryJson);
      onSelectRef.current(itinerary, districtId ?? "");
    } catch {
      // Malformed JSON — ignore tap
    }
  }, []);

  if (geojson.features.length === 0) return null;

  // SymbolLayer must always be mounted (rnmapbox typing requires it).
  // When images aren't ready yet, the layer is harmless — Mapbox just
  // skips features whose iconImage isn't registered.
  return (
    <>
      <MapboxGL.Images images={emojiImages} />

      <MapboxGL.ShapeSource
        id="community-itineraries"
        shape={geojson}
        onPress={hidden ? undefined : handlePress}
        hitbox={{ width: 44, height: 44 }}
      >
        <MapboxGL.SymbolLayer
          id="community-emoji-icon"
          style={emojiIconStyle}
        />
      </MapboxGL.ShapeSource>

      {selectedMarker ? (
        <SelectedMarkerOverlay
          key={selectedId!}
          coordinate={selectedMarker.coordinate}
          emoji={selectedMarker.emoji}
          borderColor={selectedMarker.borderColor}
        />
      ) : null}
    </>
  );
};

export const CommunityItineraryMarkers = React.memo(
  CommunityItineraryMarkersInner,
);

const styles = StyleSheet.create({
  selectedMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(26, 26, 26, 0.95)",
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#86efac",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
  },
  selectedEmoji: {
    fontSize: 20,
    textAlign: "center",
  },
});
