import { useUserLocation } from "@/contexts/LocationContext";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  spring,
  type Colors,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const ACTIVITY_OPTIONS = [
  "☕ Coffee",
  "🥾 Hiking",
  "🎨 Art",
  "📚 Reading",
  "🍽️ Food",
  "🎵 Music",
  "🏋️ Fitness",
  "🌳 Nature",
  "🛹 Skating",
  "📸 Photography",
  "🧘 Wellness",
  "🍺 Drinks",
];

const PACE_OPTIONS = [
  { key: "gentle", emoji: "🐢", label: "Gentle", desc: "Ease me in, stay close" },
  { key: "steady", emoji: "🚶", label: "Steady", desc: "Balanced expansion" },
  { key: "push", emoji: "🚀", label: "Push Me", desc: "Challenge me, stretch further" },
];

const OnboardingScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const { refreshAuth } = useAuth();

  const [step, setStep] = useState(1);

  // Step 2 state
  const [comfortZone, setComfortZone] = useState("");
  const [barriers, setBarriers] = useState("");
  const [goals, setGoals] = useState("");

  // Step 3 state
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [pacePreference, setPacePreference] = useState<string>("");

  // Submission state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const animateButton = () => {
    buttonScale.value = withSequence(
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateButton();
    setStep((prev) => prev + 1);
  };

  const toggleActivity = (activity: string) => {
    Haptics.selectionAsync();
    setSelectedActivities((prev) =>
      prev.includes(activity)
        ? prev.filter((a) => a !== activity)
        : [...prev, activity],
    );
  };

  const selectPace = (pace: string) => {
    Haptics.selectionAsync();
    setPacePreference(pace);
  };

  const handleFinish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateButton();
    Keyboard.dismiss();
    setError(null);
    setIsLoading(true);

    try {
      await apiClient.sidequests.updateComfortProfile({
        pacePreference,
        comfortProfile: {
          comfortZone,
          barriers,
          goals,
        },
      });

      if (userLocation) {
        await apiClient.sidequests.setHomeAnchor(
          userLocation[1],
          userLocation[0],
        );
      }

      // Refresh user profile so AuthGuard sees the new comfortProfile
      await refreshAuth();

      router.replace("/");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Onboarding error:", err);
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Something went wrong. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Animated.View
            key="step-1"
            entering={FadeInRight.duration(300)}
            style={styles.stepContainer}
          >
            <View style={styles.welcomeContainer}>
              <Text style={styles.displayTitle}>Let's set up your world</Text>
              <Text style={styles.subtitle}>
                A few quick questions to personalize your experience
              </Text>
            </View>
            <Animated.View style={buttonAnimatedStyle}>
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.7}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View
            key="step-2"
            entering={FadeInRight.duration(300)}
            style={styles.stepContainer}
          >
            <Text style={styles.sectionTitle}>
              How would you describe your comfort zone?
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. I mostly stay home and go to familiar places..."
              placeholderTextColor={colors.text.disabled}
              value={comfortZone}
              onChangeText={setComfortZone}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />

            <Text style={styles.sectionTitle}>
              What keeps you from getting out more?
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Anxiety, not knowing where to go..."
              placeholderTextColor={colors.text.disabled}
              value={barriers}
              onChangeText={setBarriers}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />

            <Text style={styles.sectionTitle}>What's your goal?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Explore my city, find new hangouts..."
              placeholderTextColor={colors.text.disabled}
              value={goals}
              onChangeText={setGoals}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />

            <Animated.View style={buttonAnimatedStyle}>
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.7}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        );

      case 3:
        return (
          <Animated.View
            key="step-3"
            entering={FadeInRight.duration(300)}
            style={styles.stepContainer}
          >
            <Text style={styles.sectionTitle}>What do you enjoy doing?</Text>
            <View style={styles.chipGrid}>
              {ACTIVITY_OPTIONS.map((activity) => {
                const isSelected = selectedActivities.includes(activity);
                return (
                  <TouchableOpacity
                    key={activity}
                    onPress={() => toggleActivity(activity)}
                    activeOpacity={0.7}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {activity}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>What pace feels right?</Text>
            <View style={styles.paceContainer}>
              {PACE_OPTIONS.map((option) => {
                const isSelected = pacePreference === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => selectPace(option.key)}
                    activeOpacity={0.7}
                    style={[
                      styles.paceCard,
                      isSelected && styles.paceCardSelected,
                    ]}
                  >
                    <Text style={styles.paceEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.paceLabel,
                        isSelected && styles.paceLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.paceDesc}>{option.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Animated.View style={buttonAnimatedStyle}>
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.7}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        );

      case 4:
        return (
          <Animated.View
            key="step-4"
            entering={FadeInRight.duration(300)}
            style={styles.stepContainer}
          >
            <Text style={styles.sectionTitle}>Set your home base</Text>
            <Text style={styles.explanationText}>
              We'll use this as the center of your expanding world
            </Text>

            <View style={styles.locationCard}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>
                {userLocation
                  ? "Using your current location"
                  : "Waiting for location..."}
              </Text>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Animated.View style={buttonAnimatedStyle}>
              <TouchableOpacity
                onPress={handleFinish}
                disabled={isLoading}
                activeOpacity={0.7}
                style={styles.primaryButton}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                  <Text style={styles.primaryButtonText}>Finish Setup</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  s <= step && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing._10,
    },
    progressContainer: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
      marginBottom: spacing["3xl"],
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: radius.full,
      backgroundColor: colors.border.medium,
    },
    progressDotActive: {
      backgroundColor: colors.accent.primary,
    },
    stepContainer: {
      flex: 1,
      gap: spacing.xl,
    },
    welcomeContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.lg,
      paddingVertical: spacing["5xl"],
    },
    displayTitle: {
      fontFamily: fontFamily.display,
      fontSize: fontSize["3xl"],
      color: colors.text.primary,
      textAlign: "center",
    },
    subtitle: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.md,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: 24,
    },
    sectionTitle: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    explanationText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      lineHeight: 22,
    },
    textInput: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      padding: spacing.lg,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      minHeight: 80,
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing._10,
      borderRadius: radius.full,
      backgroundColor: colors.bg.card,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    chipSelected: {
      backgroundColor: colors.accent.muted,
      borderColor: colors.accent.border,
    },
    chipText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
    chipTextSelected: {
      color: colors.accent.primary,
    },
    paceContainer: {
      gap: spacing.md,
    },
    paceCard: {
      backgroundColor: colors.bg.card,
      borderRadius: radius["2xl"],
      borderWidth: 1,
      borderColor: colors.border.default,
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.xs,
    },
    paceCardSelected: {
      backgroundColor: colors.accent.muted,
      borderColor: colors.accent.border,
    },
    paceEmoji: {
      fontSize: fontSize["3xl"],
    },
    paceLabel: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    paceLabelSelected: {
      color: colors.accent.primary,
    },
    paceDesc: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.xs,
      color: colors.text.secondary,
    },
    locationCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.bg.card,
      borderRadius: radius["2xl"],
      borderWidth: 1,
      borderColor: colors.border.default,
      padding: spacing.xl,
    },
    locationIcon: {
      fontSize: fontSize["2xl"],
    },
    locationText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.md,
      color: colors.text.primary,
    },
    errorContainer: {
      backgroundColor: colors.status.error.bg,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.status.error.border,
    },
    errorText: {
      color: colors.status.error.text,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
    },
    primaryButton: {
      borderRadius: radius.md,
      height: 55,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.accent.muted,
      borderWidth: 1,
      borderColor: colors.accent.border,
    },
    primaryButtonText: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
    },
  });

export default OnboardingScreen;
