import { useUserLocation } from "@/contexts/LocationContext";
import { useColors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { StepProgress } from "@/components/Onboarding/shared";
import {
  deriveBarriersText,
  scoreFearLadder,
} from "@/components/Onboarding/constants";
import { StepWelcome } from "@/components/Onboarding/StepWelcome";
import { StepAboutYou, type SocialSituation } from "@/components/Onboarding/StepAboutYou";
import { StepSocialLife } from "@/components/Onboarding/StepSocialLife";
import { StepBarriers } from "@/components/Onboarding/StepBarriers";
import { StepGeneratingLadder } from "@/components/Onboarding/StepGeneratingLadder";
import { StepFearLadder } from "@/components/Onboarding/StepFearLadder";
import { StepNorthStar } from "@/components/Onboarding/StepNorthStar";
import { StepActivities } from "@/components/Onboarding/StepActivities";
import { GOAL_OPTIONS } from "@/components/Onboarding/constants";

// ── Skia glow background ────────────────────────────────

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

// ── Main screen ─────────────────────────────────────────

const TOTAL_STEPS = 8;

const OnboardingScreen: React.FC = () => {
  const colors = useColors();
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const { refreshAuth } = useAuth();
  const { trackJob } = useJobProgressContext();

  const [step, setStep] = useState(1);
  const directionRef = useRef<"forward" | "back">("forward");

  // Form state
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
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedBarriers, setSelectedBarriers] = useState<string[]>([]);
  const [fearLadderResponses, setFearLadderResponses] = useState<Record<string, number>>({});
  const [northStar, setNorthStar] = useState("");

  // LLM-generated data (fear ladder scenarios)
  const [generatedScenarios, setGeneratedScenarios] = useState<{ id: string; text: string; dimension: string }[] | null>(null);
  const [generatedDimensions, setGeneratedDimensions] = useState<string[] | null>(null);

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

  const handleFearRate = useCallback((scenarioId: string, value: number) => {
    setFearLadderResponses((prev) => ({ ...prev, [scenarioId]: value }));
  }, []);

  const handleUpdateSituation = useCallback((field: keyof SocialSituation, value: string) => {
    setSocialSituation((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleToggleLookingFor = useCallback((key: string) => {
    setLookingFor((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const handleScenariosReady = useCallback((scenarios: { id: string; text: string; dimension: string }[], dimensions: string[]) => {
    directionRef.current = "forward";
    setGeneratedScenarios(scenarios);
    setGeneratedDimensions(dimensions);
    setFearLadderResponses({});
    setStep((prev) => prev + 1);
  }, []);

  const handleBackFromGenerating = useCallback(() => {
    directionRef.current = "back";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(5);
  }, []);

  const handleBackFromFearLadder = useCallback(() => {
    directionRef.current = "back";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(5);
  }, []);

  // ── Finish ────────────────────────────────────────────

  const handleFinish = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setIsLoading(true);

    try {
      const barriers = deriveBarriersText(selectedBarriers);
      const fearLadder = scoreFearLadder(
        fearLadderResponses,
        generatedScenarios ?? undefined,
        generatedDimensions ?? undefined,
      );

      // Derive primary goal from selected goal key
      const goalOption = GOAL_OPTIONS.find((g) => g.key === selectedGoalKey);
      const primaryGoal = goalOption
        ? goalOption.label.replace(/^[^\s]+\s/, "") // strip leading emoji
        : lookingFor.join(", ") || "Build a social life";

      await apiClient.sidequests.updateComfortProfile({
        pacePreference: fearLadder.derivedPace,
        comfortProfile: {
          comfortZone: barriers || "Getting started",
          barriers,
          goals: primaryGoal,
          goalTags: selectedBarriers,
          northStar: northStar || undefined,
          primaryGoal: primaryGoal || undefined,
        },
        fearLadder: {
          overallScore: fearLadder.overallScore,
          dimensionScores: fearLadder.dimensionScores,
          responses: fearLadder.responses,
          scenarios: generatedScenarios ?? undefined,
          dimensions: generatedDimensions ?? undefined,
        },
        onboardingProfile: selectedActivities.length > 0
          ? { activities: selectedActivities }
          : undefined,
        socialSituation: socialSituation.ageRange
          ? {
              ...socialSituation,
              currentSocialLife: currentSocialLevel,
              lookingFor,
            }
          : undefined,
      });

      if (userLocation) {
        await apiClient.sidequests.setHomeAnchor(userLocation[1], userLocation[0]);
      }

      await refreshAuth();

      // Kick off quest generation in the background — the job
      // progress indicator on the dashboard tracks it, and a push
      // notification fires when quests are ready.
      const lat = userLocation ? userLocation[1] : 0;
      const lng = userLocation ? userLocation[0] : 0;
      const { jobId } = await apiClient.sidequests.prescribeWeekPack({
        latitude: lat,
        longitude: lng,
        timezone: getUserTimezone(),
      });

      trackJob(jobId);

      // Navigate to dashboard immediately — don't wait for generation
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
  }, [selectedGoalKey, lookingFor, selectedActivities, selectedBarriers, fearLadderResponses, generatedScenarios, generatedDimensions, northStar, socialSituation, currentSocialLevel, userLocation, refreshAuth, trackJob, router]);

  // ── Transitions ──────────────────────────────────────

  const entering = directionRef.current === "forward"
    ? FadeInRight.duration(220).springify().damping(28).stiffness(450)
    : FadeInLeft.duration(220).springify().damping(28).stiffness(450);

  const exiting = directionRef.current === "forward"
    ? FadeOutLeft.duration(180)
    : FadeOutRight.duration(180);

  // ── Render ────────────────────────────────────────────

  // Derive primary goal text for LLM steps
  const primaryGoalText = (() => {
    const goalOption = GOAL_OPTIONS.find((g) => g.key === selectedGoalKey);
    return goalOption
      ? goalOption.label.replace(/^[^\s]+\s/, "")
      : lookingFor.join(", ") || "Build a social life";
  })();

  const renderStep = () => {
    switch (step) {
      case 1:
        return <StepWelcome onNext={handleNext} />;
      case 2:
        return (
          <StepAboutYou
            situation={socialSituation}
            onUpdate={handleUpdateSituation}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <StepSocialLife
            currentLevel={currentSocialLevel}
            lookingFor={lookingFor}
            selectedGoal={selectedGoalKey}
            onSetLevel={setCurrentSocialLevel}
            onToggleLookingFor={handleToggleLookingFor}
            onSetGoal={setSelectedGoalKey}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <StepBarriers
            selected={selectedBarriers}
            onToggle={(k) => toggle(selectedBarriers, setSelectedBarriers, k)}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <StepActivities
            selected={selectedActivities}
            onToggle={(a) => toggle(selectedActivities, setSelectedActivities, a)}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <StepGeneratingLadder
            primaryGoal={primaryGoalText}
            goals={[]}
            barriers={selectedBarriers}
            activities={selectedActivities}
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
