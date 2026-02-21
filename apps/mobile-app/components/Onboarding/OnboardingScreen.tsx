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

const COLORS = {
  background: "#1a1a1a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  accentTint: "rgba(147, 197, 253, 0.15)",
  accentBorder: "rgba(147, 197, 253, 0.3)",
  dotInactive: "rgba(255, 255, 255, 0.2)",
};

interface OnboardingStep {
  emoji: string;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    emoji: "\uD83C\uDF89",
    title: "Welcome to MapMoji!",
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
  {
    emoji: "\uD83D\uDD12",
    title: "Create Private Events",
    description:
      "Host your own events and share them with friends. Keep them private or make them public for everyone to discover.",
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

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
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  stepContainer: {
    alignItems: "center",
    width: width - 80,
  },
  emojiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.accentTint,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "SpaceMono",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    fontFamily: "SpaceMono",
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 80,
  },
  skipText: {
    fontSize: 16,
    fontFamily: "SpaceMono",
    color: COLORS.textSecondary,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
  },
  dotInactive: {
    backgroundColor: COLORS.dotInactive,
  },
  nextButton: {
    backgroundColor: COLORS.accentTint,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: "center",
  },
  nextText: {
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
});
