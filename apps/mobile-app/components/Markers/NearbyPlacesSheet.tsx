import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { apiClient } from "@/services/ApiClient";
import type { NearbyPlace } from "@/services/api/modules/places";
import {
  useColors,
  fontFamily,
  fontSize,
  spacing,
  radius,
  type Colors,
} from "@/theme";

interface NearbyPlacesSheetProps {
  lat: number;
  lng: number;
  onSelect: (place: NearbyPlace) => void;
  onKeepPin: () => void;
  onDismiss: () => void;
}

export default function NearbyPlacesSheet({
  lat,
  lng,
  onSelect,
  onKeepPin,
  onDismiss,
}: NearbyPlacesSheetProps) {
  const colors = useColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);

  // Slide-up animation
  const translateY = useSharedValue(300);
  const opacity = useSharedValue(0);
  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Fetch nearby places
  useEffect(() => {
    let cancelled = false;
    apiClient.places
      .searchNearby(lat, lng, 200, 8)
      .then((result) => {
        if (!cancelled && result.success) {
          setPlaces(result.places);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const handleSelect = (place: NearbyPlace) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(place);
  };

  return (
    <Reanimated.View style={[styles.container, sheetStyle]}>
      <View style={styles.header}>
        <Text style={styles.title}>What&apos;s here?</Text>
        <Pressable onPress={onDismiss} hitSlop={12}>
          <X size={18} color={colors.text.secondary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Finding nearby places...</Text>
        </View>
      ) : places.length === 0 ? (
        <Text style={styles.emptyText}>No places found nearby</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {places.map((place) => (
            <Pressable
              key={place.placeId}
              style={styles.placeCard}
              onPress={() => handleSelect(place)}
            >
              <Text style={styles.placeName} numberOfLines={1}>
                {place.name}
              </Text>
              <View style={styles.placeMeta}>
                {place.primaryType && (
                  <Text style={styles.placeType} numberOfLines={1}>
                    {place.primaryType}
                  </Text>
                )}
                {place.rating != null && (
                  <Text style={styles.placeRating}>
                    {"★"}
                    {place.rating.toFixed(1)}
                  </Text>
                )}
                {place.distance != null && (
                  <Text style={styles.placeDistance}>
                    {place.distance < 1000
                      ? `${place.distance}m`
                      : `${(place.distance / 1000).toFixed(1)}km`}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable style={styles.keepPinButton} onPress={onKeepPin}>
        <Text style={styles.keepPinText}>Keep as raw pin</Text>
      </Pressable>
    </Reanimated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 70,
      left: 0,
      right: 0,
      backgroundColor: colors.bg.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 1,
      borderColor: colors.border.subtle,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      zIndex: 1002,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      marginBottom: 6,
    },
    title: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: "700",
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    loadingText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      textAlign: "center",
      paddingVertical: spacing.md,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      gap: 6,
    },
    placeCard: {
      backgroundColor: colors.bg.elevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      paddingHorizontal: 10,
      paddingVertical: 6,
      maxWidth: 180,
    },
    placeName: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: "700",
      color: colors.text.primary,
    },
    placeType: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
    },
    placeMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    placeRating: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.accent.primary,
    },
    placeDistance: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.tertiary,
    },
    keepPinButton: {
      alignSelf: "center",
      marginTop: 6,
      paddingVertical: 2,
      paddingHorizontal: spacing.md,
    },
    keepPinText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.tertiary,
      textDecorationLine: "underline",
    },
  });
