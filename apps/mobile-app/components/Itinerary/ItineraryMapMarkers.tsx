import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import MapboxGL from "@rnmapbox/maps";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import { Pressable } from "react-native";
import * as Haptics from "expo-haptics";

interface ItineraryMapMarkersProps {
  itineraries: ItineraryResponse[];
  /** Index of the currently selected itinerary (shown in carousel) */
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

const ANCHOR = { x: 0.5, y: 0.5 };

/** Pulse ring behind the selected itinerary marker */
const PulseRing = React.memo(() => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.8, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(0.5, { duration: 0 }),
      ),
      -1,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseRing, animStyle]} />;
});

/** Single itinerary marker — shows emoji of first stop */
const ItineraryPin = React.memo(
  ({
    itinerary,
    index,
    isSelected,
    onSelect,
  }: {
    itinerary: ItineraryResponse;
    index: number;
    isSelected: boolean;
    onSelect: (index: number) => void;
  }) => {
    const firstStop = useMemo(
      () =>
        [...itinerary.items]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .find((i) => i.latitude != null && i.longitude != null),
      [itinerary.items],
    );

    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelect(index);
    }, [index, onSelect]);

    if (!firstStop) return null;

    const coordinate: [number, number] = [
      Number(firstStop.longitude),
      Number(firstStop.latitude),
    ];

    return (
      <MapboxGL.MarkerView coordinate={coordinate} anchor={ANCHOR} allowOverlap>
        <Pressable onPress={handlePress} style={styles.container}>
          {isSelected && <PulseRing />}
          <View style={[styles.dot, isSelected && styles.dotSelected]}>
            <Text style={styles.emoji}>{firstStop.emoji || "\u{1F4CD}"}</Text>
          </View>
          {!isSelected && (
            <View style={styles.labelContainer}>
              <Text style={styles.label} numberOfLines={1}>
                {itinerary.title || itinerary.city}
              </Text>
            </View>
          )}
        </Pressable>
      </MapboxGL.MarkerView>
    );
  },
);

const ItineraryMapMarkers: React.FC<ItineraryMapMarkersProps> = ({
  itineraries,
  selectedIndex,
  onSelect,
}) => {
  if (itineraries.length === 0) return null;

  return (
    <>
      {itineraries.map((it, idx) => (
        <ItineraryPin
          key={it.id}
          itinerary={it}
          index={idx}
          isSelected={selectedIndex === idx}
          onSelect={onSelect}
        />
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 90,
    height: 90,
  },
  pulseRing: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "rgba(134,239,172,0.6)",
  },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(30,30,30,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  dotSelected: {
    borderColor: "#86efac",
    backgroundColor: "rgba(30,30,30,0.95)",
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
  },
  emoji: {
    fontSize: 20,
  },
  labelContainer: {
    marginTop: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: 80,
  },
  label: {
    fontSize: 9,
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
});

export default React.memo(ItineraryMapMarkers);
