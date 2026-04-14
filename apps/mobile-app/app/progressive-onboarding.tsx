import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInRight,
  FadeOutLeft,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

import { apiClient } from "@/services/ApiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useColors, fontFamily, fontWeight, spacing } from "@/theme";
import { SkiaGlow } from "@/components/SkiaGlow";
import { StepQuestReflection } from "@/components/Onboarding/StepQuestReflection";
import { StepBarriers } from "@/components/Onboarding/StepBarriers";
import { StepSocialLife } from "@/components/Onboarding/StepSocialLife";
import { StepGeneratingLadder } from "@/components/Onboarding/StepGeneratingLadder";
import { StepFearLadder } from "@/components/Onboarding/StepFearLadder";
import {
  deriveBarriersText,
  reflectionToPace,
  summarizeBarriers,
  scoreFearLadder,
} from "@/components/Onboarding/constants";

// ── Phase 0: Reflect on quest + barriers ─────────────────

function ReflectAndBarriersPhase({
  primaryGoal,
  onComplete,
}: {
  primaryGoal: string;
  onComplete: (data: { reflectionKey: string; barriers: string[] }) => void;
}) {
  const [subStep, setSubStep] = useState<"reflect" | "barriers">("reflect");
  const [reflectionKey, setReflectionKey] = useState("");
  const [selectedBarriers, setSelectedBarriers] = useState<string[]>([]);

  if (subStep === "reflect") {
    return (
      <StepQuestReflection
        selected={reflectionKey}
        onSelect={setReflectionKey}
        onNext={() => setSubStep("barriers")}
      />
    );
  }

  return (
    <StepBarriers
      title={`You want to ${primaryGoal.toLowerCase()}...`}
      subtitle="What's made that hard before?"
      selected={selectedBarriers}
      onToggle={(k) =>
        setSelectedBarriers((prev) =>
          prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
        )
      }
      onNext={() => onComplete({ reflectionKey, barriers: selectedBarriers })}
      onBack={() => setSubStep("reflect")}
    />
  );
}

// ── Phase 1: Social context ──────────────────────────────

function SocialContextPhase({
  barriers,
  onComplete,
}: {
  barriers: string[];
  onComplete: (data: { currentSocialLevel: string }) => void;
}) {
  const [currentSocialLevel, setCurrentSocialLevel] = useState("");

  const barrierSummary = summarizeBarriers(barriers);

  return (
    <StepSocialLife
      title="Where you're starting from"
      subtitle={
        barrierSummary
          ? `You mentioned ${barrierSummary}. Let's get specific.`
          : "Let's get specific about your social life right now."
      }
      currentLevel={currentSocialLevel}
      onSetLevel={setCurrentSocialLevel}
      onNext={() => onComplete({ currentSocialLevel })}
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
        await reloadUser();
      } catch (err) {
        console.error("Progressive onboarding error:", err);
      } finally {
        setIsSaving(false);
        // Always return to deck after completing a phase.
        router.replace("/deck");
      }
    },
    [localPhase, router, reloadUser],
  );

  // ── Phase 0: Reflect + barriers ───────────────────────

  const handleReflectAndBarriersComplete = useCallback(
    (data: { reflectionKey: string; barriers: string[] }) => {
      const barriersText = deriveBarriersText(data.barriers);
      const initialPace = reflectionToPace(data.reflectionKey);
      saveAndAdvance({
        pacePreference: initialPace,
        comfortProfile: {
          comfortZone: barriersText || "Getting started",
          barriers: barriersText,
          goals: primaryGoal,
          goalTags: data.barriers,
          primaryGoal,
        },
      });
    },
    [saveAndAdvance, primaryGoal],
  );

  // ── Phase 1: Social context ───────────────────────────

  const handleSocialContextComplete = useCallback(
    (data: { currentSocialLevel: string }) => {
      // Merge with existing socialSituation to preserve quick details
      // (age, schedule, transport, budget) saved during initial onboarding
      const existing = user?.socialSituation;
      saveAndAdvance({
        socialSituation: {
          ageRange: existing?.ageRange ?? "",
          gender: existing?.gender ?? "",
          timeInArea: existing?.timeInArea ?? "",
          currentSocialLife: data.currentSocialLevel,
          lookingFor: existing?.lookingFor ?? [],
          workSituation: existing?.workSituation ?? "",
          livingSituation: existing?.livingSituation ?? "",
          dailyRoutine: existing?.dailyRoutine,
          transportation: existing?.transportation,
          budget: existing?.budget,
        },
      });
    },
    [saveAndAdvance, user?.socialSituation],
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
        return (
          <ReflectAndBarriersPhase
            primaryGoal={primaryGoal}
            onComplete={handleReflectAndBarriersComplete}
          />
        );
      case 1:
        return (
          <SocialContextPhase
            barriers={user?.comfortProfile?.goalTags ?? []}
            onComplete={handleSocialContextComplete}
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

  const phaseTitle = ["Reflect on your quest", "Your social context", "Map your comfort zone"][localPhase] ?? "";

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
});

export default ProgressiveOnboardingScreen;
