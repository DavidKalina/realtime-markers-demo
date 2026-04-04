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

const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";

// Tight, snappy spring config
const SPRING = { damping: 20, stiffness: 400 };

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
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(400).springify().damping(20).stiffness(200)}>
      <Animated.View style={style}>{children}</Animated.View>
    </Animated.View>
  );
};

// ── Terminal progress bar (animated) ────────────────────────

const BAR_CHARS = 12;
const FILL_SPEED = 30; // ms per character

export function TerminalProgressBar({ current, total }: { current: number; total: number }) {
  const colors = useColors();
  const targetFilled = Math.round((current / total) * BAR_CHARS);
  const [filled, setFilled] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    const target = targetFilled;
    prevRef.current = target;

    if (target === prev) return;

    let count = prev;
    const direction = target > prev ? 1 : -1;
    const interval = setInterval(() => {
      count += direction;
      setFilled(count);
      if (count === target) clearInterval(interval);
    }, FILL_SPEED);

    return () => clearInterval(interval);
  }, [targetFilled]);

  const bar = "\u2588".repeat(filled) + "\u2591".repeat(BAR_CHARS - filled);

  return (
    <View style={progressStyles.container}>
      <Text style={[progressStyles.text, { color: GREEN_ACCENT }]}>
        [{bar}]
      </Text>
      <Text style={[progressStyles.counter, { color: colors.text.secondary }]}>
        {current}/{total}
      </Text>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingTop: 60,
    zIndex: 10,
  },
  text: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: -1,
  },
  counter: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: fontWeight.medium,
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
          <Text style={[layoutStyles.backText, { color: colors.text.secondary }]}>{"\u2190"} Back</Text>
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
    top: 12,
    left: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    gap: spacing["2xl"],
  },
  header: {
    gap: spacing.sm,
    alignSelf: "stretch",
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.3,
    textAlign: "center",
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
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  rowActive: {
    borderColor: "rgba(134, 239, 172, 0.35)",
    backgroundColor: GREEN_MUTED,
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
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
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: {
    borderColor: GREEN_ACCENT,
    backgroundColor: "rgba(134, 239, 172, 0.2)",
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
    borderColor: "rgba(134, 239, 172, 0.25)",
    paddingVertical: 14,
    alignItems: "center",
  },
  outlineText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  solid: {
    backgroundColor: GREEN_ACCENT,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  solidText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: "#000000",
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  disabled: {
    opacity: 0.35,
  },
});
