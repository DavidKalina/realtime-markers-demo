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
  useEffect,
  useMemo,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
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

// ── Ambient glow background ──────────────────────────────

const GLOW_SKSL = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float reveal;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;

  float cx = 0.5 + sin(time * 6.2832) * 0.01;
  float cy = 0.32;

  float dx = uv.x - cx;
  float dy = (uv.y - cy) * (resolution.y / resolution.x);
  float dist = sqrt(dx * dx + dy * dy);

  // Very wide, very soft spread
  float glow1 = exp(-dist * dist * 1.8);
  float glow2 = exp(-dist * dist * 6.0);

  float pulse = 0.92 + 0.08 * sin(time * 6.2832);

  vec3 blue = vec3(0.3, 0.67, 0.97);
  vec3 cyan = vec3(0.4, 0.9, 0.85);

  vec3 col = blue * glow1 + cyan * glow2 * 0.3;
  col *= pulse;

  // Much subtler alpha than onboarding
  float alpha = (glow1 * 0.1 + glow2 * 0.06) * pulse * reveal;

  return half4(col * alpha, alpha);
}
`);

const AmbientGlow: React.FC = React.memo(() => {
  const { width, height } = useWindowDimensions();
  const time = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      200,
      withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );
    time.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const uniforms = useDerivedValue(() => ({
    resolution: vec(width, height),
    time: time.value,
    reveal: reveal.value,
  }));

  if (!GLOW_SKSL) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill>
        <Shader source={GLOW_SKSL} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
});

AmbientGlow.displayName = "AmbientGlow";

// ── Parallax widget ─────────────────────────────────────────

const PARALLAX_RATES = [1.0, 0.95, 0.9, 0.86, 0.82, 0.78, 0.75, 0.72, 0.7, 0.68, 0.66, 0.64];

const ParallaxWidget: React.FC<{
  scrollY: SharedValue<number>;
  index: number;
  delay: number;
  children: React.ReactNode;
}> = ({ scrollY, index, delay, children }) => {
  const rate = PARALLAX_RATES[index] ?? 0.64;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -scrollY.value * (1 - rate) }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Animated.View style={style}>{children}</Animated.View>
    </Animated.View>
  );
};

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
  const scrollY = useSharedValue(0);

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
      <AmbientGlow />
      <PullToActionScrollView
        onRefresh={handleRefresh}
        contentContainerStyle={s.scrollContent}
        scrollY={scrollY}
      >
        {/* 1. Active Quest Banner */}
        <ParallaxWidget scrollY={scrollY} index={0} delay={80}>
          <ActiveQuestBanner />
        </ParallaxWidget>

        {/* 2. Growth Score Hero */}
        <ParallaxWidget scrollY={scrollY} index={1} delay={160}>
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
        </ParallaxWidget>

        {/* 3. North Star */}
        {(profileData?.comfortProfile?.northStar || profileData?.comfortProfile?.primaryGoal) && (
          <ParallaxWidget scrollY={scrollY} index={2} delay={240}>
            <NorthStarCard
              northStar={profileData.comfortProfile.northStar}
              primaryGoal={profileData.comfortProfile.primaryGoal}
              targetDate={profileData.comfortProfile.targetDate}
              goalLocation={profileData.comfortProfile.goalLocation}
            />
          </ParallaxWidget>
        )}

        {/* 4. Perceived Fear */}
        {hasTier2 && profileData?.fearLadder && (
          <ParallaxWidget scrollY={scrollY} index={3} delay={320}>
            <PerceivedFearMeter
              overallScore={profileData.fearLadder.overallScore}
              dimensionScores={profileData.fearLadder.dimensionScores}
            />
          </ParallaxWidget>
        )}

        {/* 5. Growth Arc */}
        {hasTier2 && ga && (
          <ParallaxWidget scrollY={scrollY} index={4} delay={400}>
            <GrowthArc
              phase={ga.phase}
              phaseReason={ga.phaseReason}
              completedQuests={ga.completedQuests}
              avgRating={ga.avgRating}
              avgResonance={ga.avgResonance}
              recentResonance={ga.recentResonance}
              hasGrowthSignals={ga.hasGrowthSignals}
            />
          </ParallaxWidget>
        )}

        {/* 6. Self-Awareness */}
        {hasTier2 && si && (
          <ParallaxWidget scrollY={scrollY} index={5} delay={480}>
            <SelfInsight
              avgAnxietyDelta={si.avgAnxietyDelta}
              avgDifficultyDelta={si.avgDifficultyDelta}
              totalViolations={si.totalViolations}
              calibrationType={si.calibrationType}
              questsWithPredictions={si.questsWithPredictions}
            />
          </ParallaxWidget>
        )}

        {/* Calibrating card for tier 2 */}
        {!hasTier2 && (
          <ParallaxWidget scrollY={scrollY} index={3} delay={320}>
            <CalibratingCard
              questsCompleted={completedQuests}
              questsNeeded={TIER_2_QUESTS}
              label="Growth Insights"
            />
          </ParallaxWidget>
        )}

        {/* 7. Pathway Momentum */}
        {hasTier3 && dashboard && dashboard.pathwayMomentum.length > 0 && (
          <ParallaxWidget scrollY={scrollY} index={6} delay={560}>
            <PathwayMomentum pathways={dashboard.pathwayMomentum} />
          </ParallaxWidget>
        )}

        {/* 8. Blind Spots */}
        {hasTier3 && dashboard && dashboard.blindSpots.length > 0 && (
          <ParallaxWidget scrollY={scrollY} index={7} delay={640}>
            <BlindSpotCard blindSpots={dashboard.blindSpots} />
          </ParallaxWidget>
        )}

        {/* 9. Social Ladder */}
        {hasTier3 && (
          <ParallaxWidget scrollY={scrollY} index={8} delay={720}>
            <SocialLadder data={socialData} />
          </ParallaxWidget>
        )}

        {/* 10. Exploration Compass */}
        {hasTier3 && ec && (
          <ParallaxWidget scrollY={scrollY} index={9} delay={800}>
            <ExplorationCompass
              gaps={ec.gaps}
              explorationProfile={ec.explorationProfile}
              coveragePct={ec.coveragePct}
              territorySqMiles={ec.territorySqMiles}
              clusterCount={ec.clusterCount}
            />
          </ParallaxWidget>
        )}

        {/* 11. Comfort Expansion */}
        {hasTier3 && (
          <ParallaxWidget scrollY={scrollY} index={10} delay={880}>
            <ComfortExpansion
              currentRadiusMiles={profileData?.comfortRadiusMiles ?? 2.3}
            />
          </ParallaxWidget>
        )}

        {/* Calibrating card for tier 3 */}
        {!hasTier3 && hasTier1 && (
          <ParallaxWidget scrollY={scrollY} index={6} delay={560}>
            <CalibratingCard
              questsCompleted={completedQuests}
              questsNeeded={TIER_3_QUESTS}
              label="Exploration & Pathways"
            />
          </ParallaxWidget>
        )}

        {/* 12. Settings */}
        <ParallaxWidget scrollY={scrollY} index={11} delay={hasTier3 ? 960 : hasTier2 ? 560 : 400}>
          <SettingsSection
            email={profileData?.email ?? ""}
            bio={profileData?.bio}
            homeSet={homeSet}
            comfortRadius={profileData?.comfortRadiusMiles ?? null}
            onUpdateHome={handleUpdateHomeBase}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        </ParallaxWidget>
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
      paddingTop: spacing.md,
      paddingBottom: spacing.xl * 3,
      gap: spacing["3xl"],
    },
  });
