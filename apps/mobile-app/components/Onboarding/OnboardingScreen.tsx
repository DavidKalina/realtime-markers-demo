import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
} from "@/theme";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInRight, SlideOutLeft } from "react-native-reanimated";

const { width } = Dimensions.get("window");

interface OnboardingStep {
  emoji: string;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    emoji: "\uD83C\uDF89",
    title: "Welcome to A Third Space!",
    description:
      "Discover events happening around you in real time. Your city is more alive than you think.",
  },
  {
    emoji: "\uD83D\uDCF8",
    title: "Scan Events",
    description:
      "Point your camera at any flyer or poster. Our AI will extract the event details and pin it on the map instantly.",
  },
  {
    emoji: "\uD83D\uDD0D",
    title: "Browse & Filter",
    description:
      "Explore the map to find events near you. Filter by category, date, or distance to find exactly what you're looking for.",
  },
  {
    emoji: "\u2728",
    title: "Earn XP",
    description:
      "Scan flyers, attend events, and engage with your community to earn experience points and level up your profile.",
  },
];

export const OnboardingScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const { completeOnboarding } = useOnboarding();
  const router = useRouter();

  const handleComplete = async () => {
    await completeOnboarding();
    router.replace("/");
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      <View style={styles.content}>
        <Animated.View
          key={currentStep}
          entering={SlideInRight.duration(400)}
          exiting={SlideOutLeft.duration(400)}
          style={styles.stepContainer}
        >
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>{step.emoji}</Text>
          </View>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.dotsContainer}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentStep ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
          <Text style={styles.nextText}>
            {isLastStep ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["4xl"],
  },
  stepContainer: {
    alignItems: "center",
    width: width - 80,
  },
  emojiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent.muted,
    borderWidth: 1,
    borderColor: colors.accent.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: lineHeight.loose,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing._10,
  },
  skipButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 80,
  },
  skipText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.accent.primary,
  },
  dotInactive: {
    backgroundColor: colors.border.accent,
  },
  nextButton: {
    backgroundColor: colors.accent.muted,
    borderWidth: 1,
    borderColor: colors.accent.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minWidth: 80,
    alignItems: "center",
  },
  nextText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
});
