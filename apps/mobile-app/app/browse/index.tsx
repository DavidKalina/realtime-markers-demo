import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Screen from "@/components/Layout/Screen";
import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import { DistrictCard, CoverageHero } from "@/components/Districts";
import { ScoreHeroSkeleton } from "@/components/LandingPage/Skeletons";
import useBrowseDistricts from "@/hooks/useBrowseDistricts";
import useDistrictCoverage from "@/hooks/useDistrictCoverage";
import { useUserLocation } from "@/contexts/LocationContext";
import {
  useColors,
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import type { DistrictBrowseResponse } from "@/services/api/modules/districts";

type SortMode = "popular" | "nearest";

const BrowseScreen = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userLat = userLocation?.[1];
  const userLng = userLocation?.[0];

  const { districts, isLoading, refetch } = useBrowseDistricts(
    userLat,
    userLng,
  );

  const {
    total,
    explored,
    isLoading: isCoverageLoading,
    refetch: refetchCoverage,
  } = useDistrictCoverage(userLat, userLng);

  const handleDistrictPress = useCallback(
    (district: DistrictBrowseResponse) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/browse/${district.id}`);
    },
    [router],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchCoverage()]);
    setIsRefreshing(false);
  }, [refetch, refetchCoverage]);

  const handleSearchFocus = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search");
  }, [router]);

  const sortedDistricts = useMemo(() => {
    if (sortMode === "nearest") {
      return [...districts].sort((a, b) => a.distanceMiles - b.distanceMiles);
    }
    return districts; // already sorted by itinerary count (popular)
  }, [districts, sortMode]);

  const hasLocation = userLat != null && userLng != null;

  return (
    <Screen
      isScrollable={false}
      bannerDescription="Districts near you"
      noAnimation
    >
      <PullToActionScrollView
        onSearch={handleSearchFocus}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      >
        {/* Hero */}
        {isCoverageLoading && (
          <Animated.View exiting={FadeOut.duration(duration.fast)}>
            <ScoreHeroSkeleton />
          </Animated.View>
        )}

        {!isCoverageLoading && total > 0 && (
          <CoverageHero
            total={total}
            explored={explored}
            districts={districts}
          />
        )}

        {/* Sort toggle */}
        {hasLocation && districts.length > 1 && (
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleButton,
                sortMode === "popular" && styles.toggleActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode("popular");
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  sortMode === "popular" && styles.toggleTextActive,
                ]}
              >
                Popular
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                sortMode === "nearest" && styles.toggleActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode("nearest");
              }}
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

        {/* Ranked district list */}
        {sortedDistricts.map((district, index) => (
          <DistrictCard
            key={district.id}
            district={district}
            rank={index + 1}
            onPress={handleDistrictPress}
          />
        ))}

        {!isLoading && districts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No districts yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete and rate adventures to help build districts in your area
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </PullToActionScrollView>
    </Screen>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    emptySubtitle: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
      paddingHorizontal: spacing["2xl"],
    },
  });

export default BrowseScreen;
