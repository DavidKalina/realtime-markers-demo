import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
} from "@/theme";

export const GREEN_ACCENT = "#86efac";
export const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";
const GREEN_BORDER = "rgba(134, 239, 172, 0.4)";
const GREEN_GLOW = "rgba(134, 239, 172, 0.06)";

// Tight, snappy spring config
const SPRING = { damping: 28, stiffness: 550 };

// ── Typewriter hook ─────────────────────────────────────────

export function useTypewriter(text: string, speed: number, delay = 0): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;

    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        indexRef.current++;
        if (indexRef.current >= text.length) {
          setDisplayed(text);
          clearInterval(interval);
        } else {
          setDisplayed(text.slice(0, indexRef.current));
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [text, speed, delay]);

  return displayed;
}

// ── Parallax widget ─────────────────────────────────────────

const PARALLAX_RATES = [1.0, 0.93, 0.86, 0.8, 0.75, 0.7];

export const ParallaxWidget: React.FC<{
  scrollY: SharedValue<number>;
  index: number;
  enterDelay: number;
  children: React.ReactNode;
}> = ({ scrollY, index, enterDelay, children }) => {
  const rate = PARALLAX_RATES[index] ?? 0.7;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -scrollY.value * (1 - rate) }],
  }));
  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(300).springify().damping(28).stiffness(400)}>
      <Animated.View style={style}>{children}</Animated.View>
    </Animated.View>
  );
};

// ── Build progress (compact horizontal bar) ────────────────

export interface BuildLine {
  label: string;
  value?: string;
}

const STEP_LABELS = [
  "initializing",
  "goal",
  "barriers",
  "generating",
  "calibrating",
  "north star",
];

export function BuildProgress({
  step,
  total,
}: {
  completedLines: BuildLine[];
  step: number;
  total: number;
}) {
  const colors = useColors();

  // Don't show on welcome step
  if (step === 1) return null;

  const progress = (step - 1) / (total - 1); // 0 to 1

  return (
    <View style={buildStyles.container}>
      {/* Thin progress track */}
      <View style={buildStyles.track}>
        <View style={[buildStyles.fill, { width: `${progress * 100}%` as any }]} />
      </View>
      {/* Label row */}
      <View style={buildStyles.labelRow}>
        <Text style={buildStyles.stepLabel}>
          {STEP_LABELS[step - 1]}
        </Text>
        <Text style={[buildStyles.counter, { color: colors.text.secondary }]}>
          {step}/{total}
        </Text>
      </View>
    </View>
  );
}

const buildStyles = StyleSheet.create({
  container: {
    paddingTop: 58,
    paddingHorizontal: 28,
    paddingBottom: 8,
    zIndex: 10,
    gap: 6,
  },
  track: {
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 1,
    overflow: "hidden",
  },
  fill: {
    height: 2,
    backgroundColor: GREEN_ACCENT,
    borderRadius: 1,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  counter: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: fontWeight.medium,
    opacity: 0.4,
  },
});

// ── Step layout ─────────────────────────────────────────────

export function StepLayout({
  title,
  subtitle,
  children,
  bottomAction,
  hasTextInput,
  onBack,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  bottomAction?: React.ReactNode;
  hasTextInput?: boolean;
  onBack?: () => void;
}) {
  const colors = useColors();

  const content = (
    <View style={layoutStyles.container}>
      {onBack && (
        <Pressable onPress={onBack} style={layoutStyles.backButton} hitSlop={12}>
          <Text style={[layoutStyles.backText, { color: colors.text.secondary }]}>{"\u2190"} back</Text>
        </Pressable>
      )}
      <View style={layoutStyles.content}>
        <View style={layoutStyles.header}>
          <Text style={[layoutStyles.title, { color: colors.text.primary }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[layoutStyles.subtitle, { color: colors.text.secondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {children}
      </View>
      {bottomAction && (
        <View style={layoutStyles.bottom}>{bottomAction}</View>
      )}
    </View>
  );

  if (hasTextInput) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
}

const layoutStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 8,
    left: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
    textTransform: "lowercase",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 52,
    gap: spacing["2xl"],
  },
  header: {
    gap: spacing.sm,
    alignSelf: "stretch",
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 24,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.3,
    opacity: 0.7,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
});

// ── Onboarding chip ─────────────────────────────────────────

export function OnboardingChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    scale.value = withSequence(
      withSpring(0.97, SPRING),
      withSpring(1, SPRING),
    );
    onPress();
  };

  return (
    <Animated.View style={[animStyle, { alignSelf: "stretch" }]}>
      <Pressable
        onPress={handlePress}
        style={[chipStyles.row, selected && chipStyles.rowActive]}
      >
        <Text style={[chipStyles.label, selected && chipStyles.labelActive]}>
          {label}
        </Text>
        <View style={[chipStyles.check, selected && chipStyles.checkActive]}>
          {selected && <Text style={chipStyles.checkMark}>{"\u2713"}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  rowActive: {
    borderColor: GREEN_BORDER,
    backgroundColor: "rgba(134, 239, 172, 0.08)",
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.55)",
    flex: 1,
  },
  labelActive: {
    color: GREEN_ACCENT,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: {
    borderColor: GREEN_ACCENT,
    backgroundColor: "rgba(134, 239, 172, 0.25)",
  },
  checkMark: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
  },
});

// ── Next button ─────────────────────────────────────────────

export function NextButton({
  label = "Next",
  onPress,
  disabled,
  solid,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  solid?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.92, SPRING),
      withSpring(1, SPRING),
    );
    onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={[
          solid ? buttonStyles.solid : buttonStyles.outline,
          disabled && buttonStyles.disabled,
        ]}
      >
        <Text style={solid ? buttonStyles.solidText : buttonStyles.outlineText}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const buttonStyles = StyleSheet.create({
  outline: {
    backgroundColor: GREEN_MUTED,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.3)",
    paddingVertical: 16,
    alignItems: "center",
  },
  outlineText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  solid: {
    backgroundColor: GREEN_ACCENT,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  solidText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: "#000000",
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  disabled: {
    opacity: 0.3,
  },
});
