import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import Animated, {
  Easing,
  FadeIn,
  FadeInRight,
  FadeOutLeft,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { apiClient } from "@/services/ApiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useColors, fontFamily, fontWeight, spacing } from "@/theme";
import { StepProgress } from "@/components/Onboarding/shared";
import { NextButton, OnboardingChip, StepLayout } from "@/components/Onboarding/shared";
import { StepBarriers } from "@/components/Onboarding/StepBarriers";
import { StepAboutYou, type SocialSituation } from "@/components/Onboarding/StepAboutYou";
import { StepSocialLife } from "@/components/Onboarding/StepSocialLife";
import { StepGeneratingLadder } from "@/components/Onboarding/StepGeneratingLadder";
import { StepFearLadder } from "@/components/Onboarding/StepFearLadder";
import {
  deriveBarriersText,
  scoreFearLadder,
  GOAL_OPTIONS,
} from "@/components/Onboarding/constants";

// ── Skia glow background (shared with onboarding) ─────────

const GLOW_SKSL = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float reveal;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  float cx = 0.5 + sin(time * 6.2832) * 0.02;
  float cy = 0.38;
  float dx = uv.x - cx;
  float dy = (uv.y - cy) * (resolution.y / resolution.x);
  float dist = sqrt(dx * dx + dy * dy);
  float glow1 = exp(-dist * dist * 4.0);
  float glow2 = exp(-dist * dist * 12.0);
  float glow3 = exp(-dist * dist * 2.0) * 0.25;
  float pulse = 0.85 + 0.15 * sin(time * 6.2832);
  vec3 blue = vec3(0.3, 0.67, 0.97);
  vec3 cyan = vec3(0.4, 0.9, 0.85);
  vec3 warm = vec3(0.52, 0.38, 0.85);
  vec3 col = blue * glow1 + cyan * glow2 * 0.5 + warm * glow3;
  col *= pulse;
  float alpha = (glow1 * 0.25 + glow2 * 0.15 + glow3 * 0.08) * pulse * reveal;
  return half4(col * alpha, alpha);
}
`);

const SkiaGlow: React.FC = React.memo(() => {
  const { width, height } = useWindowDimensions();
  const time = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      300,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
    time.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
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

SkiaGlow.displayName = "SkiaGlow";

// ── Pace preference options ────────────────────────────────

const PACE_OPTIONS = [
  { key: "gentle", label: "\u{1F331} Gentle — ease me in slowly" },
  { key: "steady", label: "\u{1F6B6} Steady — a comfortable pace" },
  { key: "push_me", label: "\u{1F525} Push me — I'm ready for more" },
];

// ── Phase 0: Pace preference ──────────────────────────────

function PacePhase({ onComplete }: { onComplete: (pace: string) => void }) {
  const [selected, setSelected] = useState("");

  return (
    <StepLayout
      title="How should we pace things?"
      subtitle="Now that you've done your first quest, how fast should we push?"
      heroStep={2}
      bottomAction={
        <NextButton
          label="Continue"
          onPress={() => onComplete(selected)}
          disabled={selected === ""}
        />
      }
    >
      <View style={s.paceList}>
        {PACE_OPTIONS.map(({ key, label }) => (
          <OnboardingChip
            key={key}
            label={label}
            selected={selected === key}
            onPress={() => setSelected(key)}
          />
        ))}
      </View>
    </StepLayout>
  );
}

// ── Phase 1: Barriers + social basics ─────────────────────

function BarriersPhase({
  primaryGoal,
  onComplete,
}: {
  primaryGoal: string;
  onComplete: (data: {
    barriers: string[];
    socialSituation: SocialSituation;
    currentSocialLevel: string;
    lookingFor: string[];
  }) => void;
}) {
  const [subStep, setSubStep] = useState<"barriers" | "social">("barriers");
  const [selectedBarriers, setSelectedBarriers] = useState<string[]>([]);
  const [socialSituation, setSocialSituation] = useState<SocialSituation>({
    ageRange: "",
    gender: "",
    timeInArea: "",
    workSituation: "",
    livingSituation: "",
  });
  const [currentSocialLevel, setCurrentSocialLevel] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [selectedGoalKey, setSelectedGoalKey] = useState("");

  const handleUpdateSituation = useCallback((field: keyof SocialSituation, value: string) => {
    setSocialSituation((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleToggleLookingFor = useCallback((key: string) => {
    setLookingFor((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  if (subStep === "barriers") {
    return (
      <StepBarriers
        selected={selectedBarriers}
        onToggle={(k) =>
          setSelectedBarriers((prev) =>
            prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
          )
        }
        onNext={() => setSubStep("social")}
      />
    );
  }

  return (
    <StepSocialLife
      currentLevel={currentSocialLevel}
      lookingFor={lookingFor}
      selectedGoal={selectedGoalKey}
      onSetLevel={setCurrentSocialLevel}
      onToggleLookingFor={handleToggleLookingFor}
      onSetGoal={setSelectedGoalKey}
      onNext={() =>
        onComplete({
          barriers: selectedBarriers,
          socialSituation,
          currentSocialLevel,
          lookingFor,
        })
      }
      onBack={() => setSubStep("barriers")}
    />
  );
}

// ── Phase 2: Fear ladder ──────────────────────────────────

function FearLadderPhase({
  primaryGoal,
  barriers,
  activities,
  onComplete,
}: {
  primaryGoal: string;
  barriers: string[];
  activities: string[];
  onComplete: (data: {
    fearLadder: {
      overallScore: number;
      dimensionScores: Record<string, number>;
      responses: Record<string, number>;
      scenarios?: { id: string; text: string; dimension: string }[];
      dimensions?: string[];
    };
  }) => void;
}) {
  const [subStep, setSubStep] = useState<"generating" | "rating">("generating");
  const [generatedScenarios, setGeneratedScenarios] = useState<
    { id: string; text: string; dimension: string }[] | null
  >(null);
  const [generatedDimensions, setGeneratedDimensions] = useState<string[] | null>(null);
  const [fearLadderResponses, setFearLadderResponses] = useState<Record<string, number>>({});

  const handleScenariosReady = useCallback(
    (scenarios: { id: string; text: string; dimension: string }[], dimensions: string[]) => {
      setGeneratedScenarios(scenarios);
      setGeneratedDimensions(dimensions);
      setFearLadderResponses({});
      setSubStep("rating");
    },
    [],
  );

  const handleFearRate = useCallback((scenarioId: string, value: number) => {
    setFearLadderResponses((prev) => ({ ...prev, [scenarioId]: value }));
  }, []);

  if (subStep === "generating") {
    return (
      <StepGeneratingLadder
        primaryGoal={primaryGoal}
        goals={[]}
        barriers={barriers}
        activities={activities}
        onScenariosReady={handleScenariosReady}
      />
    );
  }

  return (
    <StepFearLadder
      scenarios={generatedScenarios ?? undefined}
      responses={fearLadderResponses}
      onRate={handleFearRate}
      onNext={() => {
        const scored = scoreFearLadder(
          fearLadderResponses,
          generatedScenarios ?? undefined,
          generatedDimensions ?? undefined,
        );
        onComplete({
          fearLadder: {
            overallScore: scored.overallScore,
            dimensionScores: scored.dimensionScores,
            responses: scored.responses,
            scenarios: generatedScenarios ?? undefined,
            dimensions: generatedDimensions ?? undefined,
          },
        });
      }}
      onBack={() => setSubStep("generating")}
    />
  );
}

// ── Main screen ───────────────────────────────────────────

const ProgressiveOnboardingScreen: React.FC = () => {
  const colors = useColors();
  const router = useRouter();
  const { user, reloadUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  // Local phase: initialized from user context on mount, managed locally to
  // avoid re-render cascades from context updates mid-flow.
  const [localPhase, setLocalPhase] = useState(() => user?.onboardingPhase ?? 3);
  const primaryGoal = user?.comfortProfile?.primaryGoal ?? "Build a social life";
  const activities = user?.onboardingProfile?.activities ?? [];

  // If already complete on mount, go straight to deck
  useEffect(() => {
    if (localPhase >= 3) {
      router.replace("/deck");
    }
  }, []); // only on mount

  const saveAndAdvance = useCallback(
    async (updates: Parameters<typeof apiClient.sidequests.updateComfortProfile>[0]) => {
      setIsSaving(true);
      const nextPhase = localPhase + 1;
      try {
        await apiClient.sidequests.updateComfortProfile({
          ...updates,
          onboardingPhase: nextPhase,
        });
        // Reload full user from server so context has the latest state
        // (reloadUser never logs out on failure)
        await reloadUser();
      } catch (err) {
        console.error("Progressive onboarding error:", err);
      } finally {
        setIsSaving(false);
        // Always return to deck after completing a phase.
        // The next phase will be triggered after the next quest completion.
        router.replace("/deck");
      }
    },
    [localPhase, router, reloadUser],
  );

  // ── Phase 0: Pace preference ──────────────────────────

  const handlePaceComplete = useCallback(
    (pace: string) => {
      saveAndAdvance({ pacePreference: pace });
    },
    [saveAndAdvance],
  );

  // ── Phase 1: Barriers + social basics ─────────────────

  const handleBarriersComplete = useCallback(
    (data: {
      barriers: string[];
      socialSituation: SocialSituation;
      currentSocialLevel: string;
      lookingFor: string[];
    }) => {
      const barriersText = deriveBarriersText(data.barriers);
      saveAndAdvance({
        comfortProfile: {
          comfortZone: barriersText || "Getting started",
          barriers: barriersText,
          goals: primaryGoal,
          goalTags: data.barriers,
          primaryGoal,
        },
        socialSituation: {
          ...data.socialSituation,
          currentSocialLife: data.currentSocialLevel,
          lookingFor: data.lookingFor,
        },
      });
    },
    [saveAndAdvance, primaryGoal],
  );

  // ── Phase 2: Fear ladder ──────────────────────────────

  const handleFearLadderComplete = useCallback(
    (data: {
      fearLadder: {
        overallScore: number;
        dimensionScores: Record<string, number>;
        responses: Record<string, number>;
        scenarios?: { id: string; text: string; dimension: string }[];
        dimensions?: string[];
      };
    }) => {
      const scored = data.fearLadder;
      // Derive pace from fear ladder scores if not already set
      const derivedPace =
        scored.overallScore < 0.35
          ? "gentle"
          : scored.overallScore > 0.65
            ? "push_me"
            : "steady";
      saveAndAdvance({
        fearLadder: scored,
        pacePreference: derivedPace,
      });
    },
    [saveAndAdvance],
  );

  // ── Render ────────────────────────────────────────────

  if (isSaving) {
    return (
      <View style={[s.container, { backgroundColor: colors.fixed.black }]}>
        <SkiaGlow />
        <SafeAreaView style={s.centered}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={[s.savingText, { color: colors.text.secondary }]}>
            Saving your preferences...
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  const renderPhase = () => {
    switch (localPhase) {
      case 0:
        return <PacePhase onComplete={handlePaceComplete} />;
      case 1:
        return (
          <BarriersPhase
            primaryGoal={primaryGoal}
            onComplete={handleBarriersComplete}
          />
        );
      case 2:
        return (
          <FearLadderPhase
            primaryGoal={primaryGoal}
            barriers={user?.comfortProfile?.goalTags ?? []}
            activities={activities}
            onComplete={handleFearLadderComplete}
          />
        );
      default:
        return null;
    }
  };

  const phaseTitle = ["Set your pace", "Tell us more", "Map your comfort zone"][localPhase] ?? "";

  return (
    <View style={[s.container, { backgroundColor: colors.fixed.black }]}>
      <SkiaGlow />

      <SafeAreaView style={s.safeArea}>
        <View style={s.phaseHeader}>
          <Text style={[s.phaseLabel, { color: colors.text.secondary }]}>
            Quest {localPhase + 1} complete — {phaseTitle.toLowerCase()}
          </Text>
        </View>

        <Animated.View
          key={localPhase}
          entering={FadeInRight.duration(220).springify().damping(28).stiffness(450)}
          exiting={FadeOutLeft.duration(180)}
          style={s.stepWrapper}
        >
          {renderPhase()}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  savingText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
  },
  phaseHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  phaseLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  stepWrapper: {
    flex: 1,
  },
  paceList: {
    gap: 10,
  },
});

export default ProgressiveOnboardingScreen;
