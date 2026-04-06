import { BlurView } from "expo-blur";
import { useUserLocation } from "@/contexts/LocationContext";
import { useColors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import BatchRevealOverlay from "@/components/Quest/BatchRevealOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useDeckBadgeStore } from "@/stores/useDeckBadgeStore";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
} from "react-native-reanimated";

import { BuildProgress, type BuildLine } from "@/components/Onboarding/shared";
import {
  deriveBarriersText,
  scoreFearLadder,
} from "@/components/Onboarding/constants";
import { StepWelcome } from "@/components/Onboarding/StepWelcome";
import { StepPrimaryGoal } from "@/components/Onboarding/StepPrimaryGoal";
import { StepBarriers } from "@/components/Onboarding/StepBarriers";
import { StepGeneratingBarriers } from "@/components/Onboarding/StepGeneratingBarriers";
import { StepGeneratingLadder } from "@/components/Onboarding/StepGeneratingLadder";
import { StepFearLadder } from "@/components/Onboarding/StepFearLadder";
import { StepNorthStar } from "@/components/Onboarding/StepNorthStar";
import { StepGoalRefinement } from "@/components/Onboarding/StepGoalRefinement";
import type { GoalRefinementState } from "@/services/api/modules/sidequests";

const TOTAL_STEPS = 8;

const OnboardingScreen: React.FC = () => {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const { refreshAuth } = useAuth();

  const [step, setStep] = useState(1);
  const directionRef = useRef<"forward" | "back">("forward");

  // Form state
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [refinedGoal, setRefinedGoal] = useState<string | null>(null);
  const [goalSignals, setGoalSignals] = useState<GoalRefinementState["extractedSignals"]>({});
  const [goalRedirectMessage, setGoalRedirectMessage] = useState<string | null>(null);
  const [selectedBarriers, setSelectedBarriers] = useState<string[]>([]);
  const [fearLadderResponses, setFearLadderResponses] = useState<Record<string, number>>({});
  const [northStar, setNorthStar] = useState("");

  // LLM-generated barriers
  const [generatedBarriers, setGeneratedBarriers] = useState<{ key: string; label: string; text: string }[] | null>(null);

  // LLM-generated fear ladder
  const [generatedScenarios, setGeneratedScenarios] = useState<{ id: string; text: string; dimension: string }[] | null>(null);
  const [generatedDimensions, setGeneratedDimensions] = useState<string[] | null>(null);

  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [generatingQuest, setGeneratingQuest] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState("Crafting your first quests...");
  const [generatingProgress, setGeneratingProgress] = useState<{
    progress: number;
    currentQuest: number;
    totalQuests: number;
    stepProgress: number;
  }>({ progress: 0, currentQuest: 0, totalQuests: 3, stepProgress: 0 });
  const [revealQuests, setRevealQuests] = useState<SidequestResponse[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build log lines ────────────────────────────────────────

  const buildLines = useMemo<BuildLine[]>(() => {
    const displayGoal = refinedGoal ?? primaryGoal;
    const lines: BuildLine[] = [];
    if (step > 1) lines.push({ label: "init", value: "ready" });
    if (step > 3 && displayGoal) lines.push({ label: "goal", value: `"${displayGoal.slice(0, 28)}${displayGoal.length > 28 ? "..." : ""}"` });
    if (step > 5) lines.push({ label: "barriers", value: `${selectedBarriers.length} flagged` });
    if (step > 6) lines.push({ label: "profile", value: "generated" });
    if (step > 7) lines.push({ label: "calibration", value: `${Object.keys(fearLadderResponses).length} rated` });
    return lines;
  }, [step, primaryGoal, refinedGoal, selectedBarriers.length, fearLadderResponses]);

  // ── Navigation ─────────────────────────────────────────────

  const handleNext = useCallback(() => {
    directionRef.current = "forward";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep((prev) => prev + 1);
  }, []);

  const handleBack = useCallback(() => {
    directionRef.current = "back";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((prev) => Math.max(1, prev - 1));
  }, []);

  const toggle = useCallback(
    (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, key: string) => {
      setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
    },
    [],
  );

  const handleFearRate = useCallback((scenarioId: string, value: number) => {
    setFearLadderResponses((prev) => ({ ...prev, [scenarioId]: value }));
  }, []);

  // Goal refinement handlers
  const handleGoalRefined = useCallback((goal: string, signals: GoalRefinementState["extractedSignals"]) => {
    directionRef.current = "forward";
    setRefinedGoal(goal);
    setGoalSignals(signals);
    setPrimaryGoal(goal);
    setStep((prev) => prev + 1);
  }, []);

  const handleGoalRedirect = useCallback((message: string) => {
    setGoalRedirectMessage(message);
    directionRef.current = "back";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(2);
  }, []);

  const handleBackFromRefinement = useCallback(() => {
    directionRef.current = "back";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefinedGoal(null);
    setGoalSignals({});
    setStep(2);
  }, []);

  const handleBarriersReady = useCallback((barriers: { key: string; label: string; text: string }[]) => {
    directionRef.current = "forward";
    setGeneratedBarriers(barriers);
    setSelectedBarriers([]);
    setStep((prev) => prev + 1);
  }, []);

  // Back from generating barriers — skip back to primary goal (step 2)
  const handleBackFromGeneratingBarriers = useCallback(() => {
    directionRef.current = "back";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(2);
  }, []);

  const handleScenariosReady = useCallback((scenarios: { id: string; text: string; dimension: string }[], dimensions: string[]) => {
    directionRef.current = "forward";
    setGeneratedScenarios(scenarios);
    setGeneratedDimensions(dimensions);
    setFearLadderResponses({});
    setStep((prev) => prev + 1);
  }, []);

  // Back from generating ladder — skip back to barriers (step 5)
  const handleBackFromGenerating = useCallback(() => {
    directionRef.current = "back";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(5);
  }, []);

  // Back from fear ladder — skip back to barriers (step 5), not the loading step
  const handleBackFromFearLadder = useCallback(() => {
    directionRef.current = "back";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(5);
  }, []);

  // ── Poll for week pack ────────────────────────────────────

  const pollForWeekPack = useCallback(async (jobId: string, token: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
    const poll = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/jobs/${jobId}/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.status === "completed") {
          const sidequestIds: string[] = data.result?.sidequestIds ?? [];
          if (sidequestIds.length > 0) {
            const quests = await Promise.all(
              sidequestIds.map((id: string) => apiClient.sidequests.getById(id)),
            );
            const validQuests = quests.filter(Boolean) as SidequestResponse[];
            if (validQuests.length > 0) {
              setRevealQuests(validQuests);
              setGeneratingQuest(false);
              setShowReveal(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              return;
            }
          }
          router.replace("/");
        } else if (data.status === "failed") {
          console.error("[Onboarding] Week pack generation failed");
          router.replace("/");
        } else {
          if (data.progressStep) setGeneratingLabel(data.progressStep);
          // Parse "Crafting quest X of Y..." from progressStep
          const match = data.progressStep?.match(/quest\s+(\d+)\s+of\s+(\d+)/i);
          const currentQuest = match ? parseInt(match[1], 10) : 1;
          const totalQuests = match ? parseInt(match[2], 10) : 3;
          setGeneratingProgress({
            progress: data.progress ?? 0,
            currentQuest,
            totalQuests,
            stepProgress: data.progressDetails?.stepProgress ?? 0,
          });
          pollRef.current = setTimeout(poll, 2000);
        }
      } catch (err) {
        console.error("[Onboarding] Poll error:", err);
        router.replace("/");
      }
    };
    poll();
  }, [router]);

  const handleBatchRevealComplete = useCallback(
    (acceptedIds: string[]) => {
      useDeckBadgeStore.getState().markNewCard();
      if (acceptedIds.length > 0) {
        const accepted = revealQuests.find((q) => q.id === acceptedIds[0]);
        if (accepted) {
          useActiveItineraryStore.getState().activate(accepted);
        }
      }
      router.replace("/");
    },
    [revealQuests, router],
  );

  // ── Finish ────────────────────────────────────────────────

  const handleFinish = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setIsLoading(true);

    try {
      const barriers = deriveBarriersText(selectedBarriers, generatedBarriers ?? undefined);
      const fearLadder = scoreFearLadder(
        fearLadderResponses,
        generatedScenarios ?? undefined,
        generatedDimensions ?? undefined,
      );

      await apiClient.sidequests.updateComfortProfile({
        pacePreference: fearLadder.derivedPace,
        comfortProfile: {
          comfortZone: barriers || "Getting started",
          barriers,
          goals: primaryGoal,
          goalTags: selectedBarriers,
          northStar: northStar || undefined,
          primaryGoal: primaryGoal || undefined,
          targetDate: goalSignals.targetDate || undefined,
          goalLocation: goalSignals.goalLocation || undefined,
        },
        fearLadder: {
          overallScore: fearLadder.overallScore,
          dimensionScores: fearLadder.dimensionScores,
          responses: fearLadder.responses,
          scenarios: generatedScenarios ?? undefined,
          dimensions: generatedDimensions ?? undefined,
        },
      });

      if (userLocation) {
        await apiClient.sidequests.setHomeAnchor(userLocation[1], userLocation[0]);
      }

      await refreshAuth();

      setIsLoading(false);
      setGeneratingQuest(true);
      setGeneratingLabel("Crafting your first quests...");

      const lat = userLocation ? userLocation[1] : 0;
      const lng = userLocation ? userLocation[0] : 0;
      const { jobId } = await apiClient.sidequests.prescribeWeekPack({
        latitude: lat,
        longitude: lng,
        timezone: getUserTimezone(),
      });

      const token = await apiClient.getAccessToken();
      pollForWeekPack(jobId, token ?? "");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Onboarding error:", err);
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: string }).message)
          : "Something went wrong. Please try again.",
      );
      setIsLoading(false);
      setGeneratingQuest(false);
    }
  }, [primaryGoal, selectedBarriers, fearLadderResponses, generatedBarriers, generatedScenarios, generatedDimensions, northStar, goalSignals, userLocation, refreshAuth, pollForWeekPack]);

  // ── Transitions ──────────────────────────────────────────

  const entering = directionRef.current === "forward"
    ? FadeInRight.duration(220).springify().damping(28).stiffness(450)
    : FadeInLeft.duration(220).springify().damping(28).stiffness(450);

  const exiting = directionRef.current === "forward"
    ? FadeOutLeft.duration(180)
    : FadeOutRight.duration(180);

  // ── Render ────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 1:
        return <StepWelcome onNext={handleNext} />;
      case 2:
        return (
          <StepPrimaryGoal
            primaryGoal={primaryGoal}
            setPrimaryGoal={setPrimaryGoal}
            onNext={handleNext}
            onBack={handleBack}
            redirectMessage={goalRedirectMessage}
            onClearRedirect={() => setGoalRedirectMessage(null)}
          />
        );
      case 3:
        return (
          <StepGoalRefinement
            primaryGoal={primaryGoal}
            onRefined={handleGoalRefined}
            onRedirect={handleGoalRedirect}
            onBack={handleBackFromRefinement}
          />
        );
      case 4:
        return (
          <StepGeneratingBarriers
            primaryGoal={primaryGoal}
            onBarriersReady={handleBarriersReady}
            onBack={handleBackFromGeneratingBarriers}
          />
        );
      case 5:
        return (
          <StepBarriers
            selected={selectedBarriers}
            onToggle={(k) => toggle(selectedBarriers, setSelectedBarriers, k)}
            onNext={handleNext}
            onBack={handleBack}
            options={generatedBarriers ?? undefined}
          />
        );
      case 6:
        return (
          <StepGeneratingLadder
            primaryGoal={primaryGoal}
            goals={[]}
            barriers={selectedBarriers}
            activities={[]}
            onScenariosReady={handleScenariosReady}
            onBack={handleBackFromGenerating}
          />
        );
      case 7:
        return (
          <StepFearLadder
            scenarios={generatedScenarios ?? undefined}
            responses={fearLadderResponses}
            onRate={handleFearRate}
            onNext={handleNext}
            onBack={handleBackFromFearLadder}
          />
        );
      case 8:
        return (
          <StepNorthStar
            northStar={northStar}
            setNorthStar={setNorthStar}
            userLocation={userLocation}
            isLoading={isLoading}
            generatingQuest={generatingQuest}
            generatingLabel={generatingLabel}
            generatingProgress={generatingProgress}
            error={error}
            onFinish={handleFinish}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={s.container}>
      <BlurView
        tint="dark"
        intensity={60}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <BuildProgress
        completedLines={buildLines}
        step={step}
        total={TOTAL_STEPS}
      />

      <Animated.View
        key={step}
        entering={step === 1 ? FadeIn.duration(300) : entering}
        exiting={exiting}
        style={s.stepWrapper}
      >
        {renderStep()}
      </Animated.View>

      <BatchRevealOverlay
        visible={showReveal}
        quests={revealQuests}
        onComplete={handleBatchRevealComplete}
      />
    </View>
  );
};

const createStyles = (colors: { bg: { primary: string } }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    stepWrapper: {
      flex: 1,
    },
  });

export default OnboardingScreen;
