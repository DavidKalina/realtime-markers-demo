import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useProfileInsights } from "@/hooks/useProfileInsights";
import { useGrowthDashboard } from "@/hooks/useGrowthDashboard";
import { apiClient } from "@/services/ApiClient";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import PullToActionScrollView from "../Layout/PullToActionScrollView";
import Screen from "../Layout/Screen";
import { useUserLocation } from "@/contexts/LocationContext";
import { getUserTimezone } from "@/utils/dateTimeFormatting";

import ActiveQuestBanner from "./ActiveQuestBanner";
import DeckHandSection from "./DeckHandSection";
import TodaysRepCard from "./TodaysRepCard";
import CapacityRepsSection from "./CapacityRepsSection";
import PendingReflectionCard from "./PendingReflectionCard";
import PendingCaptureCard from "./PendingCaptureCard";
import { SettingsSection } from "./SettingsSection";
import AIFocusCard from "./AIFocusCard";
import JourneyCard from "./JourneyCard";
import SectionMark from "./SectionMark";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import type { SidequestResponse, CapacityRepSummary } from "@/services/api/modules/sidequests";

// Growth dashboard components
import GrowthScoreHero from "./GrowthScoreHero";
import GrowthArc from "./GrowthArc";
import SelfInsight from "./SelfInsight";
import PathwayMomentum from "./PathwayMomentum";
import SocialLadder from "./SocialLadder";

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

  float alpha = (glow1 * 0.18 + glow2 * 0.1) * pulse * reveal;

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

// ── Staggered entrance widget ────────────────────────────────

const ParallaxWidget: React.FC<{
  scrollY?: unknown;
  index?: number;
  delay: number;
  children: React.ReactNode;
}> = ({ delay, children }) => {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      {children}
    </Animated.View>
  );
};

// ── Greeting ─────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Progressive reveal thresholds ──────────────────────────
const TIER_1_QUESTS = 1; // Unlock: progress notes with real data
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
  const { isGenerating, stepLabel, hasReady, clearReady, trackJob } = useJobProgressContext();

  // Merge API social growth data with default rungs so all 4 always show
  const socialData = useMemo(() => {
    if (!insights?.socialGrowth) return EMPTY_SOCIAL;
    const map = new Map(insights.socialGrowth.map((s) => [s.context, s.count]));
    return EMPTY_SOCIAL.map((d) => ({ context: d.context, count: map.get(d.context) ?? 0 }));
  }, [insights?.socialGrowth]);

  // Home base
  const { userLocation } = useUserLocation();
  const homeSet = user?.homeLatitude != null;

  // Deck — all unplayed quests in the user's hand
  const [deckQuests, setDeckQuests] = useState<SidequestResponse[]>([]);
  const activeItinerary = useActiveItineraryStore((s) => s.itinerary);

  // Pending reflections — completed but unrated quests
  const [unratedQuests, setUnratedQuests] = useState<SidequestResponse[]>([]);

  // Pending capture — checked in but skipped the reflection modal
  const [pendingCaptures, setPendingCaptures] = useState<SidequestResponse[]>([]);

  // Capacity reps — counts per capacity track (Slice C follow-up)
  const [capacityReps, setCapacityReps] = useState<CapacityRepSummary[]>([]);

  const fetchDashboardQuests = useCallback(async () => {
    // Fetch independently so one failing (e.g. new endpoint not deployed yet)
    // doesn't block the others.
    const [listRes, unratedRes, captureRes, capacityRes] = await Promise.allSettled([
      apiClient.sidequests.list(10, undefined, { status: "upcoming" }),
      apiClient.sidequests.listUnrated(3),
      apiClient.sidequests.listPendingCapture(2),
      apiClient.sidequests.getCapacityReps(),
    ]);
    if (listRes.status === "fulfilled") {
      setDeckQuests(listRes.value.data ?? []);
    }
    if (unratedRes.status === "fulfilled") {
      setUnratedQuests(unratedRes.value.data ?? []);
    }
    if (captureRes.status === "fulfilled") {
      setPendingCaptures(captureRes.value.data ?? []);
    }
    if (capacityRes.status === "fulfilled") {
      setCapacityReps(capacityRes.value.data ?? []);
    }
  }, []);

  useEffect(() => {
    fetchDashboardQuests();
  }, [fetchDashboardQuests]);

  // Refetch when any job completes (concepts ready, quest generated, etc.)
  useEffect(() => {
    if (hasReady) {
      fetchDashboardQuests();
      clearReady();
    }
  }, [hasReady, clearReady, fetchDashboardQuests]);

  // Fallback: if deck is empty, prescribe a rep directly.
  const fallbackTriggeredRef = useRef(false);
  useEffect(() => {
    if (
      !loading &&
      deckQuests.length === 0 &&
      !isGenerating &&
      !fallbackTriggeredRef.current &&
      userLocation
    ) {
      fallbackTriggeredRef.current = true;
      (async () => {
        try {
          const { jobId } = await apiClient.sidequests.prescribeQuest({
            latitude: userLocation[1],
            longitude: userLocation[0],
            timezone: getUserTimezone(),
          });
          trackJob(jobId);
        } catch (err) {
          console.error("[UserProfile] Fallback prescription failed:", err);
          fallbackTriggeredRef.current = false;
        }
      })();
    }
    // Reset when the deck fills.
    if (deckQuests.length > 0) {
      fallbackTriggeredRef.current = false;
    }
  }, [loading, deckQuests.length, isGenerating, userLocation, trackJob]);

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
      fetchDashboardQuests(),
      useActiveItineraryStore.getState().refresh(),
    ]);
  }, [refetch, refetchInsights, refetchDashboard, fetchDashboardQuests]);

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

  // ── Progressive reveal tiers ──────────────────────────
  const completedQuests = ga?.completedQuests ?? 0;
  const hasTier1 = completedQuests >= TIER_1_QUESTS;
  const hasTier2 = completedQuests >= TIER_2_QUESTS;
  const hasTier3 = completedQuests >= TIER_3_QUESTS;

  const firstName = profileData?.firstName;
  const greeting = getGreeting();

  return (
    <Screen isScrollable={false} showBackButton onBack={handleBack} noAnimation>
      <AmbientGlow />
      <PullToActionScrollView
        onRefresh={handleRefresh}
        contentContainerStyle={s.scrollContent}
        scrollY={scrollY}
      >
        {/* 0. Greeting */}
        <ParallaxWidget scrollY={scrollY} index={0} delay={0}>
          <View style={s.greetingSection}>
            <Text style={s.greetingText}>
              {greeting}{firstName ? `, ${firstName}` : ""}
            </Text>
            {completedQuests === 0 && (
              <Text style={s.greetingSubtitle}>
                Your first step is waiting
              </Text>
            )}
            {completedQuests > 0 && completedQuests < 3 && (
              <Text style={s.greetingSubtitle}>
                You're just getting started
              </Text>
            )}
          </View>
        </ParallaxWidget>

        {/* 1. Active Quest Banner — shown when a quest is in progress */}
        <ParallaxWidget scrollY={scrollY} index={1} delay={80}>
          <ActiveQuestBanner />
        </ParallaxWidget>

        {/* Slice D — Today's Rep. The featured undone prescription. Leads
            the home screen above analytics and the rest of the deck. Skipped
            when a quest is already active (ActiveQuestBanner covers that). */}
        {!activeItinerary && deckQuests[0] && (
          <ParallaxWidget scrollY={scrollY} index={1} delay={100}>
            <TodaysRepCard quest={deckQuests[0]} />
          </ParallaxWidget>
        )}

        {/* 1.5 Your Hand — the rest of the deck (first quest is featured above) */}
        {(() => {
          const remainingDeck = activeItinerary
            ? deckQuests
            : deckQuests.slice(1);
          return remainingDeck.length > 0 ? (
            <ParallaxWidget scrollY={scrollY} index={2} delay={140}>
              <DeckHandSection
                quests={remainingDeck}
                activeQuestId={activeItinerary?.id}
              />
            </ParallaxWidget>
          ) : null;
        })()}

        {/* 1.7 Pending Reflections — unrated completed quests */}
        {unratedQuests.map((q, i) => (
          <ParallaxWidget key={q.id} scrollY={scrollY} index={2} delay={120 + i * 60}>
            <PendingReflectionCard
              quest={q}
              onRated={() => {
                setUnratedQuests((prev) => prev.filter((uq) => uq.id !== q.id));
                fetchDashboardQuests();
              }}
            />
          </ParallaxWidget>
        ))}

        {/* 1.8 Pending Capture — checked in but skipped reflection */}
        {pendingCaptures.map((q, i) => (
          <ParallaxWidget key={`cap-${q.id}`} scrollY={scrollY} index={2} delay={140 + i * 60}>
            <PendingCaptureCard quest={q} />
          </ParallaxWidget>
        ))}

        {/* 2. Your Journey — goal, phase, tip, generating state */}
        <ParallaxWidget scrollY={scrollY} index={2} delay={120}>
          <SectionMark
            icon={"\u2B50"}
            tint="rgba(251, 191, 36, 0.5)"
            label="Your Journey"
            side="right"
          />
          <JourneyCard
            primaryGoal={profileData?.comfortProfile?.primaryGoal}
            phase={ga?.phase ?? 0}
            completedQuests={completedQuests}
            isGenerating={isGenerating}
            stepLabel={stepLabel}
          />
        </ParallaxWidget>

        {/* 3. Coach Note — what the app is noticing */}
        <ParallaxWidget scrollY={scrollY} index={3} delay={200}>
          <SectionMark
            icon={"\u2728"}
            tint="rgba(168, 85, 247, 0.5)"
            label="Coach Note"
            side="left"
          />
          <AIFocusCard
            summary={profileData?.aiFocus?.summary}
            completedQuests={completedQuests}
          />
        </ParallaxWidget>

        {/* 3.5 Reps Built — capacity evidence leads looking-back sections,
             ahead of the composite progress signal. */}
        <ParallaxWidget scrollY={scrollY} index={3} delay={240}>
          <SectionMark
            icon={"\uD83C\uDFCB\uFE0F"}
            tint="rgba(134, 239, 172, 0.5)"
            label="Reps Built"
            side="right"
          />
          <CapacityRepsSection reps={capacityReps} />
        </ParallaxWidget>

        {/* 4. Progress notes */}
        <ParallaxWidget scrollY={scrollY} index={4} delay={280}>
          <SectionMark
            icon={"\uD83D\uDCCA"}
            tint="rgba(125, 211, 252, 0.5)"
            label="Progress Notes"
            side="right"
            trailing={!hasTier1 ? "Calibrating" : undefined}
            trailingColor={colors.text.secondary}
          />
          <GrowthScoreHero
            score={gs?.score ?? 0}
            momentum={gs?.momentum ?? "steady"}
            delta7d={gs?.delta7d ?? 0}
            history={gs?.history ?? []}
            subScores={gs?.subScores ?? { resonance: 0, consistency: 0, expansion: 0, depth: 0 }}
            questCount={completedQuests}
            currentStreak={profileData?.currentStreak ?? 0}
            calibrating={!hasTier1}
          />
        </ParallaxWidget>

        {/* 5. Growth Arc — unlocks at tier 2 */}
        {hasTier2 && ga && (
          <ParallaxWidget scrollY={scrollY} index={5} delay={360}>
            <SectionMark icon={"\uD83D\uDCC8"} tint="rgba(52, 211, 153, 0.5)" label="Growth Arc" side="left" />
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

        {/* 6. Self-Awareness — unlocks at tier 2 */}
        {hasTier2 && si && (
          <ParallaxWidget scrollY={scrollY} index={6} delay={440}>
            <SectionMark icon={"\uD83E\uDE9E"} tint="rgba(168, 85, 247, 0.5)" label="Self-Awareness" side="right" />
            <SelfInsight
              avgAnxietyDelta={si.avgAnxietyDelta}
              avgDifficultyDelta={si.avgDifficultyDelta}
              totalViolations={si.totalViolations}
              calibrationType={si.calibrationType}
              questsWithPredictions={si.questsWithPredictions}
            />
          </ParallaxWidget>
        )}

        {/* 7. Pathway Momentum — unlocks at tier 3 */}
        {hasTier3 && dashboard && dashboard.pathwayMomentum.length > 0 && (
          <ParallaxWidget scrollY={scrollY} index={7} delay={520}>
            <SectionMark icon={"\uD83D\uDEE4\uFE0F"} tint="rgba(56, 189, 248, 0.5)" label="Your Arcs" side="left" />
            <PathwayMomentum pathways={dashboard.pathwayMomentum} />
          </ParallaxWidget>
        )}

        {/* 8. Social Ladder — unlocks at tier 3 */}
        {hasTier3 && (
          <ParallaxWidget scrollY={scrollY} index={8} delay={600}>
            <SectionMark icon={"\uD83D\uDC65"} tint="rgba(52, 211, 153, 0.5)" label="Social Growth" side="right" />
            <SocialLadder data={socialData} />
          </ParallaxWidget>
        )}

        {/* 9. Settings */}
        <ParallaxWidget scrollY={scrollY} index={9} delay={hasTier3 ? 680 : hasTier2 ? 520 : 360}>
          <SectionMark icon={"\u2699\uFE0F"} tint="rgba(255, 255, 255, 0.3)" label="Settings" side="left" />
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
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl * 3,
      gap: spacing["3xl"],
    },
    greetingSection: {
      gap: spacing.xs,
    },
    greetingText: {
      fontFamily: fontFamily.mono,
      fontSize: 22,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      lineHeight: 30,
    },
    greetingSubtitle: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      color: colors.text.secondary,
      opacity: 0.7,
    },
  });
