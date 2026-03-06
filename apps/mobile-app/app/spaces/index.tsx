import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SearchIcon } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import { TopSpacesPodium, SpaceCityCard } from "@/components/ThirdSpaces";
import useThirdSpaces from "@/hooks/useThirdSpaces";
import { useUserLocation } from "@/contexts/LocationContext";
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
} from "@/theme";
import type { ThirdSpaceSummary } from "@/services/api/modules/leaderboard";

type SortMode = "top" | "nearest";

const SpacesBrowseScreen = () => {
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const [sortMode, setSortMode] = useState<SortMode>("top");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { topCities, closestCities, isLoading, refetch } = useThirdSpaces(
    userLocation?.[1],
    userLocation?.[0],
  );

  const handleCityPress = useCallback(
    (city: ThirdSpaceSummary) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/spaces/[city]" as const,
        params: { city: city.city },
      });
    },
    [router],
  );

  const handleSearchFocus = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
  }, [router]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const listCities = useMemo(() => {
    if (sortMode === "nearest" && closestCities.length > 0) {
      return closestCities;
    }
    return topCities;
  }, [sortMode, topCities, closestCities]);

  // Cities to show in the list (skip top 3 if showing "top" sort)
  const listStartIndex = sortMode === "top" ? 3 : 0;
  const displayList = listCities.slice(listStartIndex);

  const hasLocation = !!userLocation;

  return (
    <Screen
      isScrollable={false}
      bannerTitle="Third Spaces"
      bannerDescription="Discover the best cities for community events"
      showBackButton
      onBack={handleBack}
      noAnimation
    >
      <Pressable onPress={handleSearchFocus}>
        <View pointerEvents="none">
          <Input
            icon={SearchIcon}
            placeholder="Search events, venues, categories..."
            value=""
            onChangeText={() => {}}
            editable={false}
            style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg }}
          />
        </View>
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {!isLoading && topCities.length >= 3 && (
          <TopSpacesPodium
            cities={topCities.slice(0, 3)}
            onCityPress={handleCityPress}
          />
        )}

        {hasLocation && (
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleButton,
                sortMode === "top" && styles.toggleActive,
              ]}
              onPress={() => setSortMode("top")}
            >
              <Text
                style={[
                  styles.toggleText,
                  sortMode === "top" && styles.toggleTextActive,
                ]}
              >
                Top Rated
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                sortMode === "nearest" && styles.toggleActive,
              ]}
              onPress={() => setSortMode("nearest")}
            >
              <Text
                style={[
                  styles.toggleText,
                  sortMode === "nearest" && styles.toggleTextActive,
                ]}
              >
                Nearest
              </Text>
            </Pressable>
          </View>
        )}

        {displayList.map((city, index) => (
          <SpaceCityCard
            key={city.city}
            city={city}
            rank={
              sortMode === "top" ? listStartIndex + index + 1 : index + 1
            }
            onPress={handleCityPress}
          />
        ))}

        {!isLoading && topCities.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No cities yet</Text>
            <Text style={styles.emptySubtitle}>
              Scan flyers to help your city climb the rankings
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg - 2,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: colors.bg.elevated,
  },
  toggleText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  toggleTextActive: {
    color: colors.text.primary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: spacing["2xl"],
  },
});

export default SpacesBrowseScreen;
