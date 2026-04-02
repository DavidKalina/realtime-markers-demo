import { BlurView } from "expo-blur";
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
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import CardOverlay from "@/components/Itinerary/CardOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useDeckBadgeStore } from "@/stores/useDeckBadgeStore";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";

const GOAL_OPTIONS = [
  { key: "explore", label: "🗺️ Explore my area" },
  { key: "socialize", label: "👋 Meet people" },
  { key: "routine", label: "🔁 Build a routine" },
  { key: "fitness", label: "💪 Get active" },
  { key: "new_skill", label: "🎯 Pick up a new skill" },
  { key: "unwind", label: "🧘 Decompress" },
];

const ACTIVITY_OPTIONS = [
  "☕ Coffee", "🥾 Hiking", "🎨 Art", "📚 Reading",
  "🍽️ Food", "🎵 Music", "🏋️ Fitness", "🌳 Nature",
  "🛹 Skating", "📸 Photography", "🧘 Wellness", "🍺 Drinks",
];

const PACE_OPTIONS = [
  { key: "gentle", emoji: "🐢", label: "Gentle", desc: "Ease me in, stay close" },
  { key: "steady", emoji: "🚶", label: "Steady", desc: "Balanced expansion" },
  { key: "push_me", emoji: "🚀", label: "Push Me", desc: "Challenge me, stretch further" },
];

const PARALLAX = [1.0, 0.93, 0.86, 0.8];

const TOTAL_STEPS = 4;

// ── Parallax widget ───────────────────────────────────────────────────

const ParallaxWidget: React.FC<{
  scrollY: SharedValue<number>;
  index: number;
  enterDelay: number;
  children: React.ReactNode;
}> = ({ scrollY, index, enterDelay, children }) => {
  const rate = PARALLAX[index] ?? 0.7;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -scrollY.value * (1 - rate) }],
  }));
  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(400)}>
      <Animated.View style={style}>
        {children}
      </Animated.View>
    </Animated.View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────

const OnboardingScreen: React.FC = () => {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const { refreshAuth } = useAuth();

  const [step, setStep] = useState(1);

  // Form state
  const [comfortZone, setComfortZone] = useState("");
  const [barriers, setBarriers] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [goals, setGoals] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [pacePreference, setPacePreference] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // First quest reveal
  const [generatingQuest, setGeneratingQuest] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState("Crafting your first quest...");
  const [firstQuest, setFirstQuest] = useState<SidequestResponse | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buttonScale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({
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
    Keyboard.dismiss();
    setStep((prev) => prev + 1);
  };

  const toggleGoal = (goal: string) => {
    Haptics.selectionAsync();
    setSelectedGoals((prev) =>
      prev.includes(goal)
        ? prev.filter((g) => g !== goal)
        : [...prev, goal],
    );
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

  const pollForQuest = useCallback(async (jobId: string, token: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
    const poll = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/jobs/${jobId}/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.status === "completed") {
          const sidequestId = data.result?.sidequestId ?? data.result?.itineraryId;
          if (sidequestId) {
            const quest = await apiClient.sidequests.getById(sidequestId);
            if (quest) {
              setFirstQuest(quest);
              setGeneratingQuest(false);
              setShowReveal(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              return;
            }
          }
          // Fallback if no quest returned
          router.replace("/");
        } else if (data.status === "failed") {
          console.error("[Onboarding] First quest generation failed");
          router.replace("/");
        } else {
          if (data.progressStep) setGeneratingLabel(data.progressStep);
          pollRef.current = setTimeout(poll, 2000);
        }
      } catch (err) {
        console.error("[Onboarding] Poll error:", err);
        router.replace("/");
      }
    };
    poll();
  }, [router]);

  const handleAcceptQuest = useCallback(async () => {
    if (!firstQuest) return;
    setIsAccepting(true);
    try {
      await apiClient.sidequests.activate(firstQuest.id);
      useActiveItineraryStore.getState().activate(firstQuest);
      useDeckBadgeStore.getState().markNewDeckCard();
    } catch (err) {
      console.error("[Onboarding] Failed to activate quest:", err);
    }
    router.replace("/");
  }, [firstQuest, router]);

  const handleDismissQuest = useCallback(() => {
    useDeckBadgeStore.getState().markNewDeckCard();
    router.replace("/");
  }, [router]);

  const handleFinish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateButton();
    Keyboard.dismiss();
    setError(null);
    setIsLoading(true);

    try {
      await apiClient.sidequests.updateComfortProfile({
        pacePreference,
        comfortProfile: { comfortZone, barriers, goals, goalTags: selectedGoals },
      });

      if (userLocation) {
        await apiClient.sidequests.setHomeAnchor(userLocation[1], userLocation[0]);
      }

      await refreshAuth();

      // Prescribe first quest instead of navigating to empty home
      setIsLoading(false);
      setGeneratingQuest(true);
      setGeneratingLabel("Crafting your first quest...");

      const lat = userLocation ? userLocation[1] : 0;
      const lng = userLocation ? userLocation[0] : 0;
      const { jobId } = await apiClient.sidequests.prescribeQuest({
        latitude: lat,
        longitude: lng,
        timezone: getUserTimezone(),
      });

      // Get a fresh token for polling
      const token = await apiClient.getAccessToken();
      pollForQuest(jobId, token ?? "");
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
  };

  // Each step is its own blur page with parallax widgets
  const renderStep = () => {
    switch (step) {
      case 1:
        return <StepWelcome s={s} colors={colors} buttonStyle={buttonStyle} onNext={handleNext} />;
      case 2:
        return (
          <StepComfortZone
            s={s}
            colors={colors}
            buttonStyle={buttonStyle}
            comfortZone={comfortZone}
            setComfortZone={setComfortZone}
            barriers={barriers}
            setBarriers={setBarriers}
            selectedGoals={selectedGoals}
            toggleGoal={toggleGoal}
            goals={goals}
            setGoals={setGoals}
            onNext={handleNext}
          />
        );
      case 3:
        return (
          <StepActivities
            s={s}
            colors={colors}
            buttonStyle={buttonStyle}
            selectedActivities={selectedActivities}
            toggleActivity={toggleActivity}
            pacePreference={pacePreference}
            selectPace={selectPace}
            onNext={handleNext}
          />
        );
      case 4:
        return (
          <StepHomeBase
            s={s}
            colors={colors}
            buttonStyle={buttonStyle}
            userLocation={userLocation}
            isLoading={isLoading}
            generatingQuest={generatingQuest}
            generatingLabel={generatingLabel}
            error={error}
            onFinish={handleFinish}
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

      {/* Progress dots */}
      <View style={s.progressContainer}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[s.progressDot, i < step && s.progressDotActive]}
          />
        ))}
      </View>

      {/* Step content with enter/exit animation */}
      <Animated.View
        key={step}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(150)}
        style={s.stepWrapper}
      >
        {renderStep()}
      </Animated.View>

      {/* First quest reveal overlay */}
      <CardOverlay
        card={firstQuest}
        visible={showReveal}
        onDismiss={handleDismissQuest}
        onAccept={handleAcceptQuest}
        isAccepting={isAccepting}
      />
    </View>
  );
};

// ── Step 1: Welcome ───────────────────────────────────────────────────

interface StepProps {
  s: ReturnType<typeof createStyles>;
  colors: Colors;
  buttonStyle: { transform: { scale: number }[] };
}

const StepWelcome: React.FC<StepProps & { onNext: () => void }> = ({
  s,
  buttonStyle,
  onNext,
}) => {
  const scrollY = useSharedValue(0);
  return (
    <View style={s.stepContent}>
      <View style={s.welcomeCenter}>
        <ParallaxWidget scrollY={scrollY} index={0} enterDelay={100}>
          <View style={s.headerWidget}>
            <Text style={s.headerEmoji}>{"\u{1F30D}"}</Text>
            <Text style={s.headerTitle}>Let&apos;s set up your world</Text>
            <Text style={s.headerSub}>
              A few quick questions to personalize your experience
            </Text>
          </View>
        </ParallaxWidget>

        <ParallaxWidget scrollY={scrollY} index={1} enterDelay={300}>
          <Animated.View style={buttonStyle}>
            <Pressable onPress={onNext} style={s.primaryButton}>
              <Text style={s.primaryButtonText}>Get Started</Text>
            </Pressable>
          </Animated.View>
        </ParallaxWidget>
      </View>
    </View>
  );
};

// ── Step 2: Comfort Zone ──────────────────────────────────────────────

const StepComfortZone: React.FC<
  StepProps & {
    comfortZone: string;
    setComfortZone: (v: string) => void;
    barriers: string;
    setBarriers: (v: string) => void;
    selectedGoals: string[];
    toggleGoal: (g: string) => void;
    goals: string;
    setGoals: (v: string) => void;
    onNext: () => void;
  }
> = ({ s, colors, buttonStyle, comfortZone, setComfortZone, barriers, setBarriers, selectedGoals, toggleGoal, goals, setGoals, onNext }) => {
  const scrollY = useSharedValue(0);
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.stepContent}
    >
      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ParallaxWidget scrollY={scrollY} index={0} enterDelay={100}>
          <Text style={s.widgetLabel}>YOUR COMFORT ZONE</Text>
          <TextInput
            style={s.textInput}
            placeholder={"e.g. I mostly stay home and go to familiar places\u2026"}
            placeholderTextColor={colors.text.disabled}
            value={comfortZone}
            onChangeText={setComfortZone}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
        </ParallaxWidget>

        <ParallaxWidget scrollY={scrollY} index={1} enterDelay={200}>
          <Text style={s.widgetLabel}>WHAT KEEPS YOU FROM GOING OUT?</Text>
          <TextInput
            style={s.textInput}
            placeholder={"e.g. Anxiety, not knowing where to go\u2026"}
            placeholderTextColor={colors.text.disabled}
            value={barriers}
            onChangeText={setBarriers}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
        </ParallaxWidget>

        <ParallaxWidget scrollY={scrollY} index={2} enterDelay={300}>
          <Text style={s.widgetLabel}>WHAT ARE YOU WORKING TOWARD?</Text>
          <View style={s.chipGrid}>
            {GOAL_OPTIONS.map(({ key, label }) => {
              const isSelected = selectedGoals.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => toggleGoal(key)}
                  style={[s.chip, isSelected && s.chipActive]}
                >
                  <Text style={[s.chipText, isSelected && s.chipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={[s.textInput, { marginTop: spacing.md }]}
            placeholder={"Anything else? (optional)"}
            placeholderTextColor={colors.text.disabled}
            value={goals}
            onChangeText={setGoals}
            maxLength={200}
          />
        </ParallaxWidget>

        <ParallaxWidget scrollY={scrollY} index={3} enterDelay={400}>
          <Animated.View style={buttonStyle}>
            <Pressable onPress={onNext} style={s.primaryButton}>
              <Text style={s.primaryButtonText}>Next</Text>
            </Pressable>
          </Animated.View>
        </ParallaxWidget>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── Step 3: Activities & Pace ─────────────────────────────────────────

const StepActivities: React.FC<
  StepProps & {
    selectedActivities: string[];
    toggleActivity: (a: string) => void;
    pacePreference: string;
    selectPace: (p: string) => void;
    onNext: () => void;
  }
> = ({ s, colors, buttonStyle, selectedActivities, toggleActivity, pacePreference, selectPace, onNext }) => {
  const scrollY = useSharedValue(0);
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  return (
    <Animated.ScrollView
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={s.stepContent}
    >
      <ParallaxWidget scrollY={scrollY} index={0} enterDelay={100}>
        <Text style={s.widgetLabel}>WHAT DO YOU ENJOY?</Text>
        <View style={s.chipGrid}>
          {ACTIVITY_OPTIONS.map((activity) => {
            const isSelected = selectedActivities.includes(activity);
            return (
              <Pressable
                key={activity}
                onPress={() => toggleActivity(activity)}
                style={[s.chip, isSelected && s.chipActive]}
              >
                <Text style={[s.chipText, isSelected && s.chipTextActive]}>
                  {activity}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ParallaxWidget>

      <ParallaxWidget scrollY={scrollY} index={1} enterDelay={250}>
        <Text style={s.widgetLabel}>WHAT PACE FEELS RIGHT?</Text>
        <View style={s.paceContainer}>
          {PACE_OPTIONS.map((option) => {
            const isSelected = pacePreference === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => selectPace(option.key)}
                style={[s.paceCard, isSelected && s.paceCardActive]}
              >
                <Text style={s.paceEmoji}>{option.emoji}</Text>
                <View style={s.paceTextWrap}>
                  <Text style={[s.paceLabel, isSelected && s.paceLabelActive]}>
                    {option.label}
                  </Text>
                  <Text style={s.paceDesc}>{option.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ParallaxWidget>

      <ParallaxWidget scrollY={scrollY} index={2} enterDelay={400}>
        <Animated.View style={buttonStyle}>
          <Pressable onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>Next</Text>
          </Pressable>
        </Animated.View>
      </ParallaxWidget>
    </Animated.ScrollView>
  );
};

// ── Step 4: Home Base ─────────────────────────────────────────────────

const StepHomeBase: React.FC<
  StepProps & {
    userLocation: [number, number] | null;
    isLoading: boolean;
    generatingQuest: boolean;
    generatingLabel: string;
    error: string | null;
    onFinish: () => void;
  }
> = ({ s, colors, buttonStyle, userLocation, isLoading, generatingQuest, generatingLabel, error, onFinish }) => {
  const scrollY = useSharedValue(0);
  return (
    <View style={s.stepContent}>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing["2xl"], paddingHorizontal: 28 }}>
        <ParallaxWidget scrollY={scrollY} index={0} enterDelay={100}>
          <View style={s.headerWidget}>
            <Text style={s.headerEmoji}>{"\u{1F3E0}"}</Text>
            <Text style={s.headerTitle}>Set your home base</Text>
            <Text style={s.headerSub}>
              We&apos;ll use this as the center of your expanding world
            </Text>
          </View>
        </ParallaxWidget>

        <ParallaxWidget scrollY={scrollY} index={1} enterDelay={200}>
          <View style={s.locationRow}>
            <Text style={s.locationIcon}>{"\u{1F4CD}"}</Text>
            <Text style={s.locationText}>
              {userLocation
                ? "Using your current location"
                : "Waiting for location..."}
            </Text>
          </View>
        </ParallaxWidget>

        {error && (
          <View style={s.errorContainer}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 28, paddingBottom: 40 }}>
        <ParallaxWidget scrollY={scrollY} index={2} enterDelay={300}>
          {generatingQuest ? (
            <View style={s.generatingContainer}>
              <ActivityIndicator size="small" color="#86efac" />
              <Text style={s.generatingText}>{generatingLabel}</Text>
            </View>
          ) : (
            <Animated.View style={buttonStyle}>
              <Pressable
                onPress={onFinish}
                disabled={isLoading}
                style={s.finishButton}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={s.finishButtonText}>Finish Setup</Text>
                )}
              </Pressable>
            </Animated.View>
          )}
        </ParallaxWidget>
      </View>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    progressContainer: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
      paddingTop: 60,
      zIndex: 10,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: radius.full,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    progressDotActive: {
      backgroundColor: GREEN_ACCENT,
    },
    stepWrapper: {
      flex: 1,
    },
    stepContent: {
      flex: 1,
    },
    welcomeCenter: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      gap: spacing["3xl"],
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingVertical: 40,
      gap: spacing["2xl"],
    },

    // ── Header ──
    headerWidget: {
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    headerEmoji: {
      fontSize: 48,
      textShadowColor: "rgba(0, 0, 0, 0.4)",
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 12,
    },
    headerTitle: {
      fontFamily: fontFamily.display,
      fontSize: fontSize["2xl"],
      color: colors.text.primary,
      textAlign: "center",
    },
    headerSub: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      textAlign: "center",
      letterSpacing: 0.5,
      lineHeight: 20,
    },

    // ── Labels ──
    widgetLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
    },

    // ── Text inputs ──
    textInput: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      minHeight: 70,
    },

    // ── Activity chips ──
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    chipActive: {
      borderColor: "rgba(134, 239, 172, 0.4)",
      backgroundColor: GREEN_MUTED,
    },
    chipText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    chipTextActive: {
      color: GREEN_ACCENT,
    },

    // ── Pace cards ──
    paceContainer: {
      gap: spacing.sm,
    },
    paceCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.06)",
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    paceCardActive: {
      borderColor: "rgba(134, 239, 172, 0.4)",
      backgroundColor: GREEN_MUTED,
    },
    paceEmoji: {
      fontSize: 28,
    },
    paceTextWrap: {
      flex: 1,
      gap: 2,
    },
    paceLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    paceLabelActive: {
      color: GREEN_ACCENT,
    },
    paceDesc: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
    },

    // ── Location ──
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.06)",
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    locationIcon: {
      fontSize: 22,
    },
    locationText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.primary,
    },

    // ── Error ──
    errorContainer: {
      backgroundColor: colors.status.error.bg,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.status.error.border,
    },
    errorText: {
      color: colors.status.error.text,
      fontSize: 12,
      fontFamily: fontFamily.mono,
    },

    // ── Buttons ──
    primaryButton: {
      backgroundColor: GREEN_MUTED,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    primaryButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: GREEN_ACCENT,
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    finishButton: {
      backgroundColor: GREEN_ACCENT,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      width: "100%",
      alignItems: "center",
    },
    finishButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#000000",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    generatingContainer: {
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.lg,
    },
    generatingText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: "#86efac",
      fontWeight: fontWeight.semibold,
      textAlign: "center",
      letterSpacing: 0.5,
    },
  });

export default OnboardingScreen;
