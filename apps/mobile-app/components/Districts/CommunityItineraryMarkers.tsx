import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { getDistrictColor } from "@/utils/districtUtils";
import type { BrowseItineraryPreview } from "@/services/api/modules/districts";

interface CommunityItineraryMarkersProps {
  dimmed?: boolean;
  onSelect: (itinerary: BrowseItineraryPreview, districtId: string) => void;
  selectedId: string | null;
}

interface MarkerData {
  itinerary: BrowseItineraryPreview;
  districtId: string;
  coordinate: [number, number];
  emoji: string;
  borderColor: string;
}

const TEASER_COUNT = 2; // markers visible through fog in unexplored districts

const CommunityItineraryMarkersInner: React.FC<
  CommunityItineraryMarkersProps
> = ({ dimmed = false, onSelect, selectedId }) => {
  const districts = useDistrictMapStore((s) => s.districts);
  const coverageMap = useDistrictMapStore((s) => s.coverageMap);

  const markers = useMemo((): MarkerData[] => {
    const result: MarkerData[] = [];

    for (const district of districts) {
      const explored = coverageMap[district.id] ?? false;
      const limit = explored ? district.previewItineraries.length : TEASER_COUNT;
      const color = getDistrictColor(district);

      for (let i = 0; i < Math.min(limit, district.previewItineraries.length); i++) {
        const itin = district.previewItineraries[i];
        if (!itin.entryLatitude || !itin.entryLongitude) continue;

        const emoji = itin.items?.[0]?.emoji ?? "\u{1F4CD}";

        result.push({
          itinerary: itin,
          districtId: district.id,
          coordinate: [itin.entryLongitude, itin.entryLatitude],
          emoji,
          borderColor: color,
        });
      }
    }

    return result;
  }, [districts, coverageMap]);

  if (markers.length === 0) return null;

  return (
    <>
      {markers.map((m) => {
        const isSelected = m.itinerary.id === selectedId;
        return (
          <MapboxGL.MarkerView
            key={m.itinerary.id}
            id={`community-${m.itinerary.id}`}
            coordinate={m.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap={false}
          >
            <View
              style={[
                styles.marker,
                {
                  borderColor: m.borderColor,
                  opacity: dimmed ? 0.35 : 1,
                },
                isSelected && styles.markerSelected,
              ]}
              onTouchEnd={() => onSelect(m.itinerary, m.districtId)}
            >
              <Text style={styles.emoji}>{m.emoji}</Text>
            </View>
          </MapboxGL.MarkerView>
        );
      })}
    </>
  );
};

export const CommunityItineraryMarkers = React.memo(
  CommunityItineraryMarkersInner,
);

const styles = StyleSheet.create({
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(26, 26, 26, 0.85)",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  markerSelected: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    shadowColor: "#86efac",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: {
    fontSize: 16,
    textAlign: "center",
  },
});
