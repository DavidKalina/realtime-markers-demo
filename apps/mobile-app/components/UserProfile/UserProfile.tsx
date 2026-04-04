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
// Old profile components (kept for reference)
// import { JourneyHeader } from "./JourneyHeader";
// import { PathwayRadar } from "./PathwayRadar";
// import { SocialGrowth } from "./SocialGrowth";
// import VenueDnaChart from "./VenueDnaChart";
import { CoverageWidget } from "./CoverageWidget";
import { SettingsSection } from "./SettingsSection";

// New HUD components
import PhaseHeader from "./PhaseHeader";
import PathwayList from "./PathwayList";
import ResonanceBreakdown from "./ResonanceBreakdown";
import SocialLadder from "./SocialLadder";
import ComfortExpansion from "./ComfortExpansion";

// ── Mock data for visual design iteration ────────────────────
const MOCK_PATHWAYS = [
  { theme: "cafe", themeLabel: "Coffee Culture", phase: "dfs" as const, avgResonance: 0.78, questCount: 7, currentDifficulty: 3, difficultyTrend: 0.2 },
  { theme: "museum", themeLabel: "Culture & History", phase: "bfs" as const, avgResonance: 0.42, questCount: 2, currentDifficulty: 2, difficultyTrend: 0 },
  { theme: "trail", themeLabel: "Trail Explorer", phase: "bfs" as const, avgResonance: 0.31, questCount: 1, currentDifficulty: 1, difficultyTrend: -0.1 },
];

const MOCK_RESONANCE = {
  score: 0.72,
  components: {
    ratingSignal: 0.80,
    journalDepth: 0.62,
    sentimentSignal: 0.65,
    socialEscalation: 0.40,
    speedSignal: 1.00,
    difficultyAlignment: 0.70,
  },
};

const MOCK_SOCIAL = [
  { context: "solo", count: 5 },
  { context: "with_someone", count: 3 },
  { context: "met_someone_new", count: 1 },
  { context: "group_activity", count: 0 },
];

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
        {/* 1. Phase Header */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <PhaseHeader
            globalPhase="mixed"
            dfsCount={1}
            totalPathways={3}
            questCount={10}
            currentStreak={profileData?.currentStreak ?? 3}
            totalXp={profileData?.totalXp ?? 1200}
          />
        </Animated.View>

        {/* 2. Active Quest Banner */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <ActiveQuestBanner />
        </Animated.View>

        {/* 3. Pathway List */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <PathwayList pathways={MOCK_PATHWAYS} />
        </Animated.View>

        {/* 4. Resonance Breakdown */}
        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
          <ResonanceBreakdown
            components={MOCK_RESONANCE.components}
            score={MOCK_RESONANCE.score}
          />
        </Animated.View>

        {/* 5. Social Ladder */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <SocialLadder data={MOCK_SOCIAL} />
        </Animated.View>

        {/* 6. Comfort Expansion */}
        <Animated.View entering={FadeInDown.delay(480).duration(400)}>
          <ComfortExpansion
            currentRadiusMiles={profileData?.comfortRadiusMiles ?? 2.3}
          />
        </Animated.View>

        {/* 7. Territory Map */}
        <Animated.View entering={FadeInDown.delay(560).duration(400)}>
          <CoverageWidget data={coverage} />
        </Animated.View>

        {/* 8. Settings */}
        <Animated.View entering={FadeInDown.delay(640).duration(400)}>
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
      gap: spacing.xl,
    },
  });
