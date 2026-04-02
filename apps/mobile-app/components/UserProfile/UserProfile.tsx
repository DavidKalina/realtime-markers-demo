import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useProfileInsights } from "@/hooks/useProfileInsights";
import { usePathways } from "@/hooks/usePathways";
import { apiClient } from "@/services/ApiClient";
import type { CoverageSummaryResponse } from "@/services/api/modules/coverage";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  fontFamily,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import PullToActionScrollView from "../Layout/PullToActionScrollView";
import Screen from "../Layout/Screen";
import { useUserLocation } from "@/contexts/LocationContext";

import ActiveQuestBanner from "./ActiveQuestBanner";
import { JourneyHeader } from "./JourneyHeader";
import { PathwayRadar } from "./PathwayRadar";
import { SocialGrowth } from "./SocialGrowth";
import VenueDnaChart from "./VenueDnaChart";
import { CoverageWidget } from "./CoverageWidget";
import { SettingsSection } from "./SettingsSection";

interface UserProfileProps {
  onBack?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();

  const {
    loading,
    profileData,
    refetch,
    handleBack,
    handleLogout,
    handleDeleteAccount,
  } = useProfile(onBack);

  const { data: insights, refetch: refetchInsights } = useProfileInsights();
  const { data: pathwayData, refetch: refetchPathways } = usePathways();

  // Coverage data for world stats
  const [coverage, setCoverage] = useState<CoverageSummaryResponse | null>(null);
  const fetchCoverage = useCallback(async () => {
    try {
      const result = await apiClient.coverage.getSummary();
      setCoverage(result);
    } catch (err) {
      console.error("[UserProfile] Failed to fetch coverage:", err);
    }
  }, []);
  useEffect(() => { fetchCoverage(); }, [fetchCoverage]);

  // World size
  const [worldSize, setWorldSize] = useState<{ areaSqMiles: number; furthestMiles: number; uniqueCategories: number } | null>(null);
  const fetchWorldSize = useCallback(async () => {
    try {
      const result = await apiClient.sidequests.getWorldSize();
      setWorldSize(result);
    } catch (err) {
      console.error("[UserProfile] Failed to fetch world size:", err);
    }
  }, []);
  useEffect(() => { fetchWorldSize(); }, [fetchWorldSize]);

  // Home base
  const { userLocation } = useUserLocation();
  const homeSet = user?.homeLatitude != null;

  const handleUpdateHomeBase = useCallback(async () => {
    if (!userLocation) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiClient.sidequests.setHomeAnchor(userLocation[1], userLocation[0]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [userLocation]);

  // Refresh
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetch(),
      refetchInsights(),
      refetchPathways(),
      fetchCoverage(),
      fetchWorldSize(),
      useActiveItineraryStore.getState().refresh(),
    ]);
  }, [refetch, refetchInsights, refetchPathways, fetchCoverage, fetchWorldSize]);

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
  }, [router]);

  if (loading) {
    return (
      <Screen showBackButton onBack={handleBack}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.text.primary} />
        </View>
      </Screen>
    );
  }

  const memberSince = profileData?.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "";

  return (
    <Screen isScrollable={false} showBackButton onBack={handleBack} noAnimation>
      <PullToActionScrollView
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        contentContainerStyle={s.scrollContent}
      >
        {/* 1. Journey Header */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <JourneyHeader
            firstName={profileData?.firstName ?? ""}
            memberSince={memberSince}
            worldSizeSqMi={worldSize?.areaSqMiles ?? coverage?.stats?.territorySqMiles ?? null}
            comfortRadiusMiles={profileData?.comfortRadiusMiles ?? null}
            totalXp={profileData?.totalXp ?? 0}
            currentStreak={profileData?.currentStreak ?? 0}
            longestStreak={profileData?.longestStreak ?? 0}
          />
        </Animated.View>

        {/* 2. Active Quest Banner */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <ActiveQuestBanner />
        </Animated.View>

        {/* 3. Pathways */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <PathwayRadar
            pathways={pathwayData?.pathways ?? []}
            globalPhase={pathwayData?.globalPhase ?? "bfs"}
          />
        </Animated.View>

        {/* 4. Social Growth */}
        {insights?.socialGrowth && insights.socialGrowth.length > 0 && (
          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
            <SocialGrowth
              data={insights.socialGrowth}
              timeline={insights.socialTimeline}
            />
          </Animated.View>
        )}

        {/* 5. Venue DNA — only show if no pathways yet (radar replaces it) */}
        {(!pathwayData?.pathways?.length) && insights?.venueDna && insights.venueDna.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <VenueDnaChart data={insights.venueDna} />
          </Animated.View>
        )}

        {/* 6. Territory Map */}
        <Animated.View entering={FadeInDown.delay(480).duration(400)}>
          <CoverageWidget data={coverage} />
        </Animated.View>

        {/* 7. Settings */}
        <Animated.View entering={FadeInDown.delay(560).duration(400)}>
          <SettingsSection
            email={profileData?.email ?? ""}
            bio={profileData?.bio}
            homeSet={homeSet}
            comfortRadius={profileData?.comfortRadiusMiles ?? null}
            onUpdateHome={handleUpdateHomeBase}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        </Animated.View>
      </PullToActionScrollView>
    </Screen>
  );
};

export default UserProfile;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl * 3,
      gap: spacing.xl * 2,
    },
  });
