import { useOnboarding } from "@/contexts/OnboardingContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const ONBOARDING_STEPS = [
  {
    title: "Welcome to MapMoji!",
    description:
      "Discover and scan events around you to earn XP and unlock rewards.",
    emoji: "🎉",
  },
  {
    title: "Scan Events",
    description:
      "Use your camera to scan event posters and flyers to add them to the map.",
    emoji: "📸",
  },
  {
    title: "Browse & Filter",
    description:
      "Find events that match your interests using our smart filters.",
    emoji: "🔍",
  },
  {
    title: "Earn XP",
    description:
      "Get XP for each unique event you scan. The more you scan, the more you earn!",
    emoji: "✨",
  },
  {
    title: "Create Private Events",
    description:
      "Long press the map to create private events to share with your friends.",
    emoji: "🔒",
  },
];

export const OnboardingScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const { completeOnboarding } = useOnboarding();
  const router = useRouter();
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
    setTimeout(() => {
      buttonScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    }, 100);

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await completeOnboarding();
      setTimeout(() => {
        router.replace("/");
      }, 100);
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await completeOnboarding();
    setTimeout(() => {
      router.replace("/");
    }, 100);
  };

  return (
    <View style={styles.container}>
      <Animated.View
        key={currentStep}
        entering={SlideInRight.springify().damping(15).mass(0.8)}
        exiting={SlideOutLeft.springify().damping(15).mass(0.8)}
        style={styles.content}
      >
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>
            {ONBOARDING_STEPS[currentStep].emoji}
          </Text>
        </View>

        <Text style={styles.title}>{ONBOARDING_STEPS[currentStep].title}</Text>
        <Text style={styles.description}>
          {ONBOARDING_STEPS[currentStep].description}
        </Text>
      </Animated.View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.stepsContainer}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.stepDot,
                currentStep === index && styles.activeStepDot,
              ]}
            />
          ))}
        </View>

        <Animated.View style={buttonAnimatedStyle}>
          <TouchableOpacity
            onPress={handleNext}
            style={styles.nextButton}
            activeOpacity={0.8}
          >
            <Text style={styles.nextText}>
              {currentStep === ONBOARDING_STEPS.length - 1
                ? "Get Started"
                : "Next"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiContainer: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
    marginBottom: 32,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#f8f9fa",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    color: "#a0a0a0",
    textAlign: "center",
    paddingHorizontal: 20,
    fontFamily: "SpaceMono",
    lineHeight: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 40,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    color: "#a0a0a0",
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  stepsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 5,
  },
  activeStepDot: {
    backgroundColor: "#93c5fd",
  },
  nextButton: {
    backgroundColor: "#93c5fd",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 100,
  },
  nextText: {
    color: "#1a1a1a",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
});
