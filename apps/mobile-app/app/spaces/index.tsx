import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Screen from "@/components/Layout/Screen";
import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import { SpaceCityCard } from "@/components/ThirdSpaces";
import ThirdSpaceScoreHero from "@/components/LandingPage/ThirdSpaceScoreHero";
import { ScoreHeroSkeleton } from "@/components/LandingPage/Skeletons";
import useThirdSpaces from "@/hooks/useThirdSpaces";
import useThirdSpaceScore from "@/hooks/useThirdSpaceScore";
import useLandingPageData from "@/hooks/useLandingPageData";
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
import type { ThirdSpaceSummary } from "@/services/api/modules/leaderboard";

type SortMode = "top" | "nearest";

const SpacesBrowseScreen = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const [sortMode, setSortMode] = useState<SortMode>("top");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { topCities, closestCities, isLoading, refetch } = useThirdSpaces(
    userLocation?.[1],
    userLocation?.[0],
  );

  const {
    landingData,
    isLoading: isLandingLoading,
    refresh: refreshLanding,
  } = useLandingPageData({
    userLat: userLocation?.[1],
    userLng: userLocation?.[0],
    featuredLimit: 3,
    upcomingLimit: 5,
    trendingLimit: 3,
  });

  const resolvedCity = landingData?.resolvedCity || null;

  const {
    score: myScore,
    isLoading: isScoreLoading,
    refetch: refetchScore,
  } = useThirdSpaceScore(resolvedCity);

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
      await Promise.all([refetch(), refreshLanding(), refetchScore()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, refreshLanding, refetchScore]);

  const handleMyCityPress = useCallback(() => {
    if (!resolvedCity) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/spaces/[city]" as const,
      params: { city: resolvedCity },
    });
  }, [router, resolvedCity]);

  const listCities = useMemo(() => {
    if (sortMode === "nearest" && closestCities.length > 0) {
      return closestCities;
    }
    return topCities;
  }, [sortMode, topCities, closestCities]);

  const displayList = listCities;

  const hasLocation = !!userLocation;

  return (
    <Screen
      isScrollable={false}
      bannerDescription="Third Space Scores for cities near you"
      noAnimation
    >
      <PullToActionScrollView
        onSearch={handleSearchFocus}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      >
        {/* User's current city Third Space */}
        {!myScore && (isLandingLoading || isScoreLoading) && (
          <Animated.View exiting={FadeOut.duration(duration.fast)}>
            <ScoreHeroSkeleton />
          </Animated.View>
        )}

        {myScore && (
          <Animated.View entering={FadeIn.duration(duration.normal)}>
            <Pressable onPress={handleMyCityPress}>
              <ThirdSpaceScoreHero score={myScore} />
            </Pressable>
          </Animated.View>
        )}

        {/* Reserve space to prevent layout shift */}
        <View
          style={!resolvedCity ? styles.viewCityLinkPlaceholder : undefined}
        >
          {resolvedCity && (
            <Pressable
              style={({ pressed }) => [
                styles.viewCityLink,
                pressed && styles.viewCityLinkPressed,
              ]}
              onPress={handleMyCityPress}
            >
              <Text style={styles.viewCityText}>
                View {resolvedCity.split(",")[0].trim()}'s page
              </Text>
              <ChevronRight size={14} color={colors.accent.primary} />
            </Pressable>
          )}
        </View>

        {/* Sort toggle */}
        {hasLocation && (
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleButton,
                sortMode === "top" && styles.toggleActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode("top");
              }}
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

        {/* Ranked city list */}
        {displayList.map((city, index) => (
          <SpaceCityCard
            key={city.city}
            city={city}
            rank={index + 1}
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
      </PullToActionScrollView>
    </Screen>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    viewCityLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      marginBottom: spacing["2xl"],
    },
    viewCityLinkPlaceholder: {
      height: spacing.sm * 2 + 18 + spacing["2xl"],
    },
    viewCityLinkPressed: {
      opacity: 0.6,
    },
    viewCityText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
      color: colors.accent.primary,
    },
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
