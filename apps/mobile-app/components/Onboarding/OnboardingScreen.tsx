import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  type Colors,
} from "@/theme";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { apiClient } from "@/services/ApiClient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  SlideInRight,
} from "react-native-reanimated";
import { createOnboardingPages } from "./onboardingData";
import { ONBOARDING_STEPS } from "./onboardingSteps";
import { InterestsStep } from "./steps/InterestsStep";
import { VibesStep } from "./steps/VibesStep";
import { IdealDayStep } from "./steps/IdealDayStep";
import { PaceStep } from "./steps/PaceStep";

const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 24;

export const OnboardingScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const onboardingPages = useMemo(
    () => createOnboardingPages(colors),
    [colors],
  );
  const { completeOnboarding } = useOnboarding();
  const router = useRouter();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Interactive step state
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [idealDay, setIdealDay] = useState("");
  const [selectedPace, setSelectedPace] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const totalSteps = ONBOARDING_STEPS.length;

  const handleComplete = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await apiClient.onboarding.submitOnboardingProfile({
        activities: selectedActivities,
        vibes: selectedVibes,
        idealDay: idealDay.trim(),
        pace: selectedPace,
      });
    } catch (err) {
      // Don't block user on API failure
      console.warn("Failed to submit onboarding profile:", err);
    }
    await completeOnboarding();
    router.replace("/");
  }, [
    completeOnboarding,
    router,
    selectedActivities,
    selectedVibes,
    idealDay,
    selectedPace,
  ]);

  const isStepValid = useCallback(() => {
    switch (currentStep.type) {
      case "info":
        return true;
      case "interests":
        return selectedActivities.length >= 3;
      case "vibes":
        return selectedVibes.length >= 1;
      case "ideal_day":
        return idealDay.trim().length > 0;
      case "pace":
        return selectedPace !== "";
      case "complete":
        return true;
      default:
        return true;
    }
  }, [
    currentStep.type,
    selectedActivities.length,
    selectedVibes.length,
    idealDay,
    selectedPace,
  ]);

  const handleNext = useCallback(() => {
    if (currentStep.type === "complete") {
      handleComplete();
    } else if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStep.type, currentStepIndex, totalSteps, handleComplete]);

  const handleSkip = useCallback(async () => {
    await completeOnboarding();
    router.replace("/");
  }, [completeOnboarding, router]);

  const toggleActivity = useCallback((value: string) => {
    setSelectedActivities((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  }, []);

  const toggleVibe = useCallback((value: string) => {
    setSelectedVibes((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  }, []);

  const isInfoStep = currentStep.type === "info";
  const isCompleteStep = currentStep.type === "complete";
  const canProceed = isStepValid();

  const getButtonLabel = () => {
    if (isSubmitting) return "Saving...";
    if (isCompleteStep) return "Let's Go";
    if (isInfoStep && currentStepIndex === 0) return "Get Started";
    return "Next";
  };

  const renderStepContent = () => {
    if (currentStep.type === "info") {
      const page = onboardingPages[currentStep.infoIndex ?? 0];
      const Illustration = page.illustration;
      return (
        <Animated.View
          key={`info-${currentStep.infoIndex}`}
          style={styles.infoContainer}
          entering={currentStepIndex === 0 ? FadeIn.duration(400) : SlideInRight.duration(300)}
        >
          <View style={styles.topSpacer} />
          <View style={styles.illustrationContainer}>
            <Illustration active />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.infoTitle}>{page.title}</Text>
            <Text style={styles.infoBody}>{page.body}</Text>
          </View>
          <View style={styles.bottomSpacer} />
        </Animated.View>
      );
    }

    switch (currentStep.type) {
      case "interests":
        return (
          <Animated.View style={styles.interactiveContainer} entering={SlideInRight.duration(300)}>
            <InterestsStep
              selected={selectedActivities}
              onToggle={toggleActivity}
            />
          </Animated.View>
        );
      case "vibes":
        return (
          <Animated.View style={styles.interactiveContainer} entering={SlideInRight.duration(300)}>
            <VibesStep selected={selectedVibes} onToggle={toggleVibe} />
          </Animated.View>
        );
      case "ideal_day":
        return (
          <Animated.View style={styles.interactiveContainer} entering={SlideInRight.duration(300)}>
            <IdealDayStep value={idealDay} onChange={setIdealDay} />
          </Animated.View>
        );
      case "pace":
        return (
          <Animated.View style={styles.interactiveContainer} entering={SlideInRight.duration(300)}>
            <PaceStep selected={selectedPace} onSelect={setSelectedPace} />
          </Animated.View>
        );
      case "complete":
        return (
          <Animated.View style={styles.completeContainer} entering={FadeIn.duration(400)}>
            <Text style={styles.completeEmoji}>🎉</Text>
            <Text style={styles.completeTitle}>You're all set</Text>
            <Text style={styles.completeBody}>
              We'll use your preferences to build itineraries just for you. Time to touch grass.
            </Text>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {renderStepContent()}

      <View style={styles.footer}>
        {/* Skip button */}
        <View style={styles.skipContainer}>
          {!isCompleteStep ? (
            <Text
              style={styles.skipText}
              onPress={handleSkip}
              suppressHighlighting={false}
            >
              Skip
            </Text>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        {/* Dot indicator */}
        <View style={styles.dotsContainer}>
          {ONBOARDING_STEPS.map((_, index) => (
            <StepDot
              key={index}
              index={index}
              currentIndex={currentStepIndex}
            />
          ))}
        </View>

        {/* Next / Let's Go button */}
        <View>
          <Text
            style={[
              styles.nextButton,
              isCompleteStep && styles.nextButtonLast,
              !canProceed && styles.nextButtonDisabled,
            ]}
            onPress={canProceed && !isSubmitting ? handleNext : undefined}
            suppressHighlighting={false}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.bg.primary} />
            ) : (
              getButtonLabel()
            )}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

interface StepDotProps {
  index: number;
  currentIndex: number;
}

const StepDot: React.FC<StepDotProps> = ({ index, currentIndex }) => {
  const colors = useColors();
  const isActive = index === currentIndex;
  const isPast = index < currentIndex;

  return (
    <View
      style={{
        width: isActive ? DOT_ACTIVE_WIDTH : DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: isActive
          ? colors.accent.primary
          : isPast
            ? colors.accent.primary
            : colors.border.accent,
        opacity: isActive ? 1 : isPast ? 0.6 : 0.3,
      }}
    />
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    infoContainer: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: spacing["3xl"],
    },
    topSpacer: {
      flex: 1,
    },
    illustrationContainer: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xl,
    },
    textContainer: {
      alignItems: "center",
      paddingHorizontal: spacing.sm,
    },
    infoTitle: {
      fontSize: fontSize["3xl"],
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    infoBody: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: 22,
    },
    bottomSpacer: {
      flex: 1.2,
    },
    interactiveContainer: {
      flex: 1,
    },
    completeContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing["3xl"],
    },
    completeEmoji: {
      fontSize: 64,
      marginBottom: spacing.xl,
    },
    completeTitle: {
      fontSize: fontSize["3xl"],
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    completeBody: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: 22,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      paddingTop: spacing._10,
    },
    skipContainer: {
      minWidth: 80,
    },
    skipPlaceholder: {
      minWidth: 80,
    },
    skipText: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    dotsContainer: {
      flexDirection: "row",
      gap: spacing.xs,
      alignItems: "center",
    },
    nextButton: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      backgroundColor: colors.accent.muted,
      borderWidth: 1,
      borderColor: colors.accent.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      overflow: "hidden",
      textAlign: "center",
      minWidth: 80,
    },
    nextButtonLast: {
      backgroundColor: colors.accent.primary,
      borderColor: colors.accent.primary,
      color: colors.bg.primary,
    },
    nextButtonDisabled: {
      opacity: 0.4,
    },
  });
