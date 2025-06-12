import { useOnboarding } from "@/contexts/OnboardingContext";
import { COLORS } from "@/components/Layout/ScreenLayout";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import Animated, {
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const ONBOARDING_STEPS = [
  {
    title: "Welcome to MapMoji!",
    description:
      "Discover and scan events around you to earn XP and unlock rewards.",
    emoji: "🎉",
  },
  {
    title: "AI-Powered Scanning",
    description:
      "Our AI automatically extracts event details from posters and flyers - date, time, location, and description. Events are instantly added to the map for everyone to see in real-time.",
    emoji: "📸",
  },
  {
    title: "Browse & Filter",
    description:
      "Find events that match your interests using our smart filters.",
    emoji: "🔍",
  },
  {
    title: "Save Events",
    description:
      "Tap the bookmark icon to save events you're interested in for later viewing.",
    emoji: "🔖",
  },
  {
    title: "RSVP to Events",
    description:
      "Let organizers know you're coming by RSVPing to events you plan to attend.",
    emoji: "✅",
  },
  {
    title: "Smart Relevance",
    description:
      "Our algorithm shows the most relevant events to you, keeping the map clean and focused on what matters most.",
    emoji: "🧠",
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
  {
    title: "Beta Version",
    description:
      "MapMoji is currently in beta! We're constantly improving and adding new features. Your feedback helps us make the app better for everyone.",
    emoji: "🚀",
  },
];

export const OnboardingScreen: React.FC = () => {
  const { currentStep, setCurrentStep, completeOnboarding } = useOnboarding();
  const router = useRouter();
  const buttonScale = useSharedValue(1);
  const { width: screenWidth } = Dimensions.get("window");

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
      try {
        await completeOnboarding();
        setTimeout(() => {
          router.replace("/");
        }, 200);
      } catch (error) {
        console.error("Error completing onboarding:", error);
      }
    }
  };

  const handlePrevious = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await completeOnboarding();
      setTimeout(() => {
        router.replace("/");
      }, 200);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const swipeGesture = Gesture.Pan().onEnd((event) => {
    const { translationX } = event;
    const swipeThreshold = screenWidth * 0.2; // 20% of screen width

    if (translationX > swipeThreshold) {
      // Swipe right - go to previous step
      runOnJS(handlePrevious)();
    } else if (translationX < -swipeThreshold) {
      // Swipe left - go to next step
      runOnJS(handleNext)();
    }
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={swipeGesture}>
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

          <Text style={styles.title}>
            {ONBOARDING_STEPS[currentStep].title}
          </Text>
          <Text style={styles.description}>
            {ONBOARDING_STEPS[currentStep].description}
          </Text>
        </Animated.View>
      </GestureDetector>

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
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.cardBackgroundAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    marginBottom: 32,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    color: COLORS.textSecondary,
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
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.buttonBackground,
    marginHorizontal: 5,
  },
  activeStepDot: {
    backgroundColor: COLORS.accent,
  },
  nextButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 100,
  },
  nextText: {
    color: COLORS.cardBackground,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
});
