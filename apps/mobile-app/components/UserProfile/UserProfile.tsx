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
import React, {
  useCallback,
  useMemo,
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
import CalibratingCard from "./CalibratingCard";

// Growth dashboard components
import GrowthScoreHero from "./GrowthScoreHero";
import GrowthArc from "./GrowthArc";
import SelfInsight from "./SelfInsight";
import PathwayMomentum from "./PathwayMomentum";
import BlindSpotCard from "./BlindSpotCard";
import ExplorationCompass from "./ExplorationCompass";
import SocialLadder from "./SocialLadder";
import ComfortExpansion from "./ComfortExpansion";
import PerceivedFearMeter from "./PerceivedFearMeter";
import NorthStarCard from "./NorthStarCard";

// ── Progressive reveal thresholds ──────────────────────────
const TIER_1_QUESTS = 1; // Unlock: Growth Score with real data
const TIER_2_QUESTS = 3; // Unlock: Growth Arc, Self Insight, Fear delta
const TIER_3_QUESTS = 5; // Unlock: Pathways, Blind Spots, Social, Exploration, Comfort

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

  // ── Progressive reveal tiers ──────────────────────────
  const completedQuests = ga?.completedQuests ?? 0;
  const hasTier1 = completedQuests >= TIER_1_QUESTS;
  const hasTier2 = completedQuests >= TIER_2_QUESTS;
  const hasTier3 = completedQuests >= TIER_3_QUESTS;

  return (
    <Screen isScrollable={false} showBackButton onBack={handleBack} noAnimation>
      <PullToActionScrollView
        onRefresh={handleRefresh}
        contentContainerStyle={s.scrollContent}
      >
        {/* 1. Active Quest Banner — always first (the thing to do NOW) */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <ActiveQuestBanner />
        </Animated.View>

        {/* 2. North Star — always visible (remind them why) */}
        {(profileData?.comfortProfile?.northStar || profileData?.comfortProfile?.primaryGoal) && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <NorthStarCard
              northStar={profileData.comfortProfile.northStar}
              primaryGoal={profileData.comfortProfile.primaryGoal}
            />
          </Animated.View>
        )}

        {/* 3. Growth Score Hero — show calibrating state until tier 1 */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <GrowthScoreHero
            score={gs?.score ?? 0}
            momentum={gs?.momentum ?? "steady"}
            delta7d={gs?.delta7d ?? 0}
            history={gs?.history ?? []}
            subScores={gs?.subScores ?? { resonance: 0, consistency: 0, expansion: 0, depth: 0 }}
            questCount={completedQuests}
            currentStreak={profileData?.currentStreak ?? 0}
            totalXp={profileData?.totalXp ?? 0}
            calibrating={!hasTier1}
          />
        </Animated.View>

        {/* ── TIER 2: Unlocked at 3 quests ───────────────── */}

        {/* 4. Perceived Fear — only show as improvement delta, not raw score */}
        {hasTier2 && profileData?.fearLadder && (
          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
            <PerceivedFearMeter
              overallScore={profileData.fearLadder.overallScore}
              dimensionScores={profileData.fearLadder.dimensionScores}
            />
          </Animated.View>
        )}

        {/* 5. Growth Arc */}
        {hasTier2 && ga && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
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

        {/* 6. Self-Awareness */}
        {hasTier2 && si && (
          <Animated.View entering={FadeInDown.delay(480).duration(400)}>
            <SelfInsight
              avgAnxietyDelta={si.avgAnxietyDelta}
              avgDifficultyDelta={si.avgDifficultyDelta}
              totalViolations={si.totalViolations}
              calibrationType={si.calibrationType}
              questsWithPredictions={si.questsWithPredictions}
            />
          </Animated.View>
        )}

        {/* Calibrating card for tier 2 unlock */}
        {!hasTier2 && (
          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
            <CalibratingCard
              questsCompleted={completedQuests}
              questsNeeded={TIER_2_QUESTS}
              label="GROWTH INSIGHTS"
            />
          </Animated.View>
        )}

        {/* ── TIER 3: Unlocked at 5 quests ───────────────── */}

        {/* 7. Pathway Momentum */}
        {hasTier3 && dashboard && dashboard.pathwayMomentum.length > 0 && (
          <Animated.View entering={FadeInDown.delay(560).duration(400)}>
            <PathwayMomentum pathways={dashboard.pathwayMomentum} />
          </Animated.View>
        )}

        {/* 8. Blind Spots */}
        {hasTier3 && dashboard && dashboard.blindSpots.length > 0 && (
          <Animated.View entering={FadeInDown.delay(640).duration(400)}>
            <BlindSpotCard blindSpots={dashboard.blindSpots} />
          </Animated.View>
        )}

        {/* 9. Social Ladder */}
        {hasTier3 && (
          <Animated.View entering={FadeInDown.delay(720).duration(400)}>
            <SocialLadder data={socialData} />
          </Animated.View>
        )}

        {/* 10. Exploration Compass */}
        {hasTier3 && ec && (
          <Animated.View entering={FadeInDown.delay(800).duration(400)}>
            <ExplorationCompass
              gaps={ec.gaps}
              explorationProfile={ec.explorationProfile}
              coveragePct={ec.coveragePct}
              territorySqMiles={ec.territorySqMiles}
              clusterCount={ec.clusterCount}
            />
          </Animated.View>
        )}

        {/* 11. Comfort Expansion */}
        {hasTier3 && (
          <Animated.View entering={FadeInDown.delay(880).duration(400)}>
            <ComfortExpansion
              currentRadiusMiles={profileData?.comfortRadiusMiles ?? 2.3}
            />
          </Animated.View>
        )}

        {/* Calibrating card for tier 3 unlock */}
        {!hasTier3 && hasTier1 && (
          <Animated.View entering={FadeInDown.delay(560).duration(400)}>
            <CalibratingCard
              questsCompleted={completedQuests}
              questsNeeded={TIER_3_QUESTS}
              label="EXPLORATION & PATHWAYS"
            />
          </Animated.View>
        )}

        {/* 12. Settings — always visible */}
        <Animated.View entering={FadeInDown.delay(hasTier3 ? 960 : hasTier2 ? 560 : 400).duration(400)}>
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
