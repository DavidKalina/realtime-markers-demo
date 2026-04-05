import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useProfileInsights } from "@/hooks/useProfileInsights";
import { useGrowthDashboard } from "@/hooks/useGrowthDashboard";
import { apiClient } from "@/services/ApiClient";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, {
  useCallback,
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
import { SettingsSection } from "./SettingsSection";

// Growth dashboard components
import GrowthScoreHero from "./GrowthScoreHero";
import GrowthArc from "./GrowthArc";
import SelfInsight from "./SelfInsight";
import PathwayMomentum from "./PathwayMomentum";
import BlindSpotCard from "./BlindSpotCard";
import ExplorationCompass from "./ExplorationCompass";
import SocialLadder from "./SocialLadder";
import ComfortExpansion from "./ComfortExpansion";

// Default empty social data (used when insights haven't loaded yet)
const EMPTY_SOCIAL = [
  { context: "solo", count: 0 },
  { context: "with_someone", count: 0 },
  { context: "met_someone_new", count: 0 },
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
  const { data: dashboard, refetch: refetchDashboard } = useGrowthDashboard();

  // Merge API social growth data with default rungs so all 4 always show
  const socialData = useMemo(() => {
    if (!insights?.socialGrowth) return EMPTY_SOCIAL;
    const map = new Map(insights.socialGrowth.map((s) => [s.context, s.count]));
    return EMPTY_SOCIAL.map((d) => ({ context: d.context, count: map.get(d.context) ?? 0 }));
  }, [insights?.socialGrowth]);

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
      refetchDashboard(),
      useActiveItineraryStore.getState().refresh(),
    ]);
  }, [refetch, refetchInsights, refetchDashboard]);

  if (loading) {
    return (
      <Screen showBackButton onBack={handleBack}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.text.primary} />
        </View>
      </Screen>
    );
  }

  const gs = dashboard?.growthScore;
  const ga = dashboard?.growthArc;
  const si = dashboard?.selfInsight;
  const ec = dashboard?.explorationCompass;

  return (
    <Screen isScrollable={false} showBackButton onBack={handleBack} noAnimation>
      <PullToActionScrollView
        onRefresh={handleRefresh}
        contentContainerStyle={s.scrollContent}
      >
        {/* 1. Growth Score Hero */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <GrowthScoreHero
            score={gs?.score ?? 0}
            momentum={gs?.momentum ?? "steady"}
            delta7d={gs?.delta7d ?? 0}
            history={gs?.history ?? []}
            subScores={gs?.subScores ?? { resonance: 0, consistency: 0, expansion: 0, depth: 0 }}
            questCount={ga?.completedQuests ?? 0}
            currentStreak={profileData?.currentStreak ?? 0}
            totalXp={profileData?.totalXp ?? 0}
          />
        </Animated.View>

        {/* 2. Active Quest Banner */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <ActiveQuestBanner />
        </Animated.View>

        {/* 3. Growth Arc */}
        {ga && (
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <GrowthArc
              phase={ga.phase}
              phaseReason={ga.phaseReason}
              completedQuests={ga.completedQuests}
              avgRating={ga.avgRating}
              avgResonance={ga.avgResonance}
              recentResonance={ga.recentResonance}
              hasGrowthSignals={ga.hasGrowthSignals}
            />
          </Animated.View>
        )}

        {/* 4. Self-Awareness */}
        {si && (
          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
            <SelfInsight
              avgAnxietyDelta={si.avgAnxietyDelta}
              avgDifficultyDelta={si.avgDifficultyDelta}
              totalViolations={si.totalViolations}
              calibrationType={si.calibrationType}
              questsWithPredictions={si.questsWithPredictions}
            />
          </Animated.View>
        )}

        {/* 5. Pathway Momentum */}
        {dashboard && dashboard.pathwayMomentum.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <PathwayMomentum pathways={dashboard.pathwayMomentum} />
          </Animated.View>
        )}

        {/* 6. Blind Spots */}
        {dashboard && dashboard.blindSpots.length > 0 && (
          <Animated.View entering={FadeInDown.delay(480).duration(400)}>
            <BlindSpotCard blindSpots={dashboard.blindSpots} />
          </Animated.View>
        )}

        {/* 7. Social Ladder */}
        <Animated.View entering={FadeInDown.delay(560).duration(400)}>
          <SocialLadder data={socialData} />
        </Animated.View>

        {/* 8. Exploration Compass */}
        {ec && (
          <Animated.View entering={FadeInDown.delay(640).duration(400)}>
            <ExplorationCompass
              gaps={ec.gaps}
              explorationProfile={ec.explorationProfile}
              coveragePct={ec.coveragePct}
              territorySqMiles={ec.territorySqMiles}
              clusterCount={ec.clusterCount}
            />
          </Animated.View>
        )}

        {/* 9. Comfort Expansion */}
        <Animated.View entering={FadeInDown.delay(720).duration(400)}>
          <ComfortExpansion
            currentRadiusMiles={profileData?.comfortRadiusMiles ?? 2.3}
          />
        </Animated.View>

        {/* 10. Settings */}
        <Animated.View entering={FadeInDown.delay(800).duration(400)}>
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
