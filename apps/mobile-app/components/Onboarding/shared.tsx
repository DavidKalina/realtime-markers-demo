import React, { useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
} from "@/theme";

const SPRING = { damping: 28, stiffness: 550 };

// ── Step hero card (MiniDeck-style visual) ───────────────

const HERO_W = 80;
const HERO_H = 112;

export const STEP_CARDS: { icon: string; tint: string }[] = [
  { icon: "🚀", tint: "rgba(125, 211, 252, 0.5)" },  // welcome - sky
  { icon: "🎯", tint: "rgba(251, 191, 36, 0.5)" },   // goal - amber
  { icon: "🔍", tint: "rgba(168, 85, 247, 0.5)" },   // refinement - purple
  { icon: "🛡️", tint: "rgba(56, 189, 248, 0.5)" },   // gen barriers - sky blue
  { icon: "🧱", tint: "rgba(52, 211, 153, 0.5)" },   // barriers - teal
  { icon: "🪜", tint: "rgba(244, 114, 182, 0.5)" },   // gen ladder - pink
  { icon: "🎢", tint: "rgba(251, 146, 60, 0.5)" },   // fear ladder - orange
  { icon: "⭐", tint: "rgba(125, 211, 252, 0.5)" },   // north star - sky
];

export function HeroCard({
  step,
  rotation = 0,
}: {
  step: number;
  rotation?: number;
}) {
  const colors = useColors();
  const { icon, tint } = STEP_CARDS[step - 1] ?? STEP_CARDS[0];

  const scale = useSharedValue(0.5);
  const rotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      100,
      withSpring(1, { damping: 18, stiffness: 200 }),
    );
    rotate.value = withDelay(
      200,
      withSpring(rotation, { damping: 20, stiffness: 180 }),
    );
  }, [step]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        heroStyles.card,
        { backgroundColor: colors.bg.card, borderColor: tint },
        animStyle,
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`heroGrad${step}`} x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={tint} stopOpacity="0.3" />
              <Stop offset="1" stopColor="transparent" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={12} fill={`url(#heroGrad${step})`} />
        </Svg>
      </View>
      <View style={heroStyles.inner}>
        <Text style={heroStyles.icon}>{icon}</Text>
        <View style={[heroStyles.line, { backgroundColor: tint }]} />
        <View style={[heroStyles.lineSm, { backgroundColor: tint }]} />
      </View>
    </Animated.View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    width: HERO_W,
    height: HERO_H,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 6,
  },
  icon: {
    fontSize: 28,
    marginBottom: 4,
  },
  line: {
    width: "60%",
    height: 3,
    borderRadius: 1.5,
    opacity: 0.4,
  },
  lineSm: {
    width: "40%",
    height: 3,
    borderRadius: 1.5,
    opacity: 0.25,
  },
});

// ── Step card (content wrapper) ──────────────────────────

export function StepCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[cardStyles.card, style]}>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
});

// ── Step progress (dot indicator) ────────────────────────

export function StepProgress({
  step,
  total,
}: {
  step: number;
  total: number;
}) {
  const colors = useColors();

  if (step === 1) {
    return <View style={progressStyles.placeholder} />;
  }

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              progressStyles.dot,
              i < step - 1 && {
                backgroundColor: `rgba(${colors.accent.rgb}, 0.4)`,
              },
              i === step - 1 && {
                width: 20,
                borderRadius: 4,
                backgroundColor: colors.accent.primary,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[progressStyles.counter, { color: colors.text.secondary }]}>
        {step} of {total}
      </Text>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  counter: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
  },
  placeholder: {
    height: 6 + spacing.md * 2,
  },
});

// ── Back button ──────────────────────────────────────────

export function BackButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={backStyles.button} hitSlop={12}>
      <Text style={[backStyles.text, { color: colors.text.secondary }]}>
        {"\u2190"} Back
      </Text>
    </Pressable>
  );
}

const backStyles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  text: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
});

// ── Step layout (card-based) ─────────────────────────────

export function StepLayout({
  title,
  subtitle,
  children,
  bottomAction,
  hasTextInput,
  onBack,
  heroStep,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  bottomAction?: React.ReactNode;
  hasTextInput?: boolean;
  onBack?: () => void;
  heroStep?: number;
}) {
  const colors = useColors();

  const content = (
    <View style={layoutStyles.outer}>
      <StepCard style={layoutStyles.card}>
        {onBack ? <BackButton onPress={onBack} /> : <View style={layoutStyles.backPlaceholder} />}
        <View style={layoutStyles.topRow}>
          <View style={layoutStyles.headerText}>
            <Text style={[layoutStyles.title, { color: colors.text.primary }]}>
              {title}
            </Text>
            {subtitle && (
              <Text
                style={[layoutStyles.subtitle, { color: colors.text.secondary }]}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {heroStep != null && <HeroCard step={heroStep} rotation={heroStep % 2 === 0 ? 3 : -3} />}
        </View>
        <View style={layoutStyles.content}>{children}</View>
        {bottomAction && <View>{bottomAction}</View>}
      </StepCard>
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
  outer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  card: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: spacing.sm,
  },
  backPlaceholder: {
    height: 28,
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
  },
});

// ── Onboarding chip ─────────────────────────────────────

export function OnboardingChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
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
        style={[
          chipStyles.row,
          selected && {
            borderColor: colors.accent.border,
            backgroundColor: `rgba(${colors.accent.rgb}, 0.08)`,
          },
        ]}
      >
        <Text
          style={[
            chipStyles.label,
            selected && { color: colors.accent.primary },
          ]}
        >
          {label}
        </Text>
        <View
          style={[
            chipStyles.check,
            selected && {
              borderColor: colors.accent.primary,
              backgroundColor: `rgba(${colors.accent.rgb}, 0.25)`,
            },
          ]}
        >
          {selected && (
            <Text
              style={[chipStyles.checkMark, { color: colors.accent.primary }]}
            >
              {"\u2713"}
            </Text>
          )}
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
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.75)",
    flex: 1,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.bold,
  },
});

// ── Next button ─────────────────────────────────────────

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
  const colors = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.95, SPRING),
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
          solid
            ? [
                buttonStyles.solid,
                { backgroundColor: colors.accent.primary },
              ]
            : [
                buttonStyles.outline,
                {
                  backgroundColor: colors.accent.muted,
                  borderColor: colors.accent.border,
                },
              ],
          disabled && buttonStyles.disabled,
        ]}
      >
        <Text
          style={
            solid
              ? buttonStyles.solidText
              : [buttonStyles.outlineText, { color: colors.accent.primary }]
          }
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const buttonStyles = StyleSheet.create({
  outline: {
    borderRadius: radius.md,
    borderWidth: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
  },
  solid: {
    borderRadius: radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  solidText: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    color: "#000000",
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.4,
  },
});
