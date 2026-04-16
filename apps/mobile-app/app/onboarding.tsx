import { useUserLocation } from "@/contexts/LocationContext";
import { useColors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from "react-native-reanimated";

import { SkiaGlow } from "@/components/SkiaGlow";
import { StepProgress } from "@/components/Onboarding/shared";
import { StepWelcome } from "@/components/Onboarding/StepWelcome";
import { StepGoal } from "@/components/Onboarding/StepGoal";
import { StepActivities } from "@/components/Onboarding/StepActivities";
import { StepQuickDetails, type QuickDetails } from "@/components/Onboarding/StepQuickDetails";
import { GOAL_OPTIONS, goalKeyToTags } from "@/components/Onboarding/constants";

// ── Main screen ─────────────────────────────────────────

const TOTAL_STEPS = 4;

const OnboardingScreen: React.FC = () => {
  const colors = useColors();
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const { refreshAuth } = useAuth();
  const { trackJob } = useJobProgressContext();

  const [step, setStep] = useState(1);
  const directionRef = useRef<"forward" | "back">("forward");

  // Form state
  const [selectedGoalKey, setSelectedGoalKey] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [quickDetails, setQuickDetails] = useState<QuickDetails>({
    ageRange: "",
    dailyRoutine: "",
    transportation: "",
    budget: "",
  });

  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Navigation ─────────────────────────────────────────

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

  const handleUpdateDetail = useCallback((field: keyof QuickDetails, value: string) => {
    setQuickDetails((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Finish → save profile + enqueue concept generation ──

  const handleFinish = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setIsLoading(true);

    try {
      // Derive primary goal from selected goal key
      const goalOption = GOAL_OPTIONS.find((g) => g.key === selectedGoalKey);
      const primaryGoal = goalOption
        ? goalOption.label.replace(/^[^\s]+\s/, "") // strip leading emoji
        : "Build a social life";

      // Save profile — includes practical details for first quest relevance
      await apiClient.sidequests.updateComfortProfile({
        pacePreference: "steady", // sensible default, refined after quest 1
        comfortProfile: {
          comfortZone: "Getting started",
          barriers: "",
          goals: primaryGoal,
          goalKey: selectedGoalKey,
          goalTags: goalKeyToTags(selectedGoalKey),
          primaryGoal,
        },
        onboardingProfile: selectedActivities.length > 0
          ? { activities: selectedActivities }
          : undefined,
        socialSituation: {
          ageRange: quickDetails.ageRange,
          gender: "",
          timeInArea: "",
          currentSocialLife: "",
          lookingFor: [],
          workSituation: "",
          livingSituation: "",
          dailyRoutine: quickDetails.dailyRoutine,
          transportation: quickDetails.transportation,
          budget: quickDetails.budget,
        },
        onboardingPhase: 0,
      });

      if (userLocation) {
        await apiClient.sidequests.setHomeAnchor(userLocation[1], userLocation[0]);
      }

      await refreshAuth();

      // Enqueue concept generation (non-blocking)
      const lat = userLocation ? userLocation[1] : 0;
      const lng = userLocation ? userLocation[0] : 0;
      const { jobId } = await apiClient.sidequests.generateConcepts({
        latitude: lat,
        longitude: lng,
        timezone: getUserTimezone(),
      });

      trackJob(jobId);

      // Navigate to dashboard immediately — concepts arrive via push notification
      router.replace("/");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Onboarding error:", err);
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: string }).message)
          : "Something went wrong. Please try again.",
      );
      setIsLoading(false);
    }
  }, [selectedGoalKey, selectedActivities, quickDetails, userLocation, refreshAuth, trackJob, router]);

  // ── Transitions ──────────────────────────────────────

  const entering = directionRef.current === "forward"
    ? FadeInRight.duration(220).springify().damping(28).stiffness(450)
    : FadeInLeft.duration(220).springify().damping(28).stiffness(450);

  const exiting = directionRef.current === "forward"
    ? FadeOutLeft.duration(180)
    : FadeOutRight.duration(180);

  // ── Render ────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 1:
        return <StepWelcome onNext={handleNext} />;
      case 2:
        return (
          <StepGoal
            selectedGoal={selectedGoalKey}
            onSetGoal={setSelectedGoalKey}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <StepActivities
            selected={selectedActivities}
            onToggle={(a) => toggle(selectedActivities, setSelectedActivities, a)}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <StepQuickDetails
            details={quickDetails}
            onUpdate={handleUpdateDetail}
            onNext={handleFinish}
            onBack={handleBack}
            loading={isLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.fixed.black }]}>
      <SkiaGlow />

      <SafeAreaView style={s.safeArea}>
        <StepProgress step={step} total={TOTAL_STEPS} />

        <Animated.View
          key={step}
          entering={step === 1 ? FadeIn.duration(300) : entering}
          exiting={exiting}
          style={s.stepWrapper}
        >
          {renderStep()}
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
  stepWrapper: {
    flex: 1,
  },
});

export default OnboardingScreen;
