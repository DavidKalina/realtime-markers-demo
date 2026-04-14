import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";

import { apiClient } from "@/services/ApiClient";
import { useAuth } from "@/contexts/AuthContext";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

// ── Celebration glow (warmer than onboarding) ──────────────

const GLOW_SKSL = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float reveal;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  float cx = 0.5 + sin(time * 6.2832) * 0.03;
  float cy = 0.35;
  float dx = uv.x - cx;
  float dy = (uv.y - cy) * (resolution.y / resolution.x);
  float dist = sqrt(dx * dx + dy * dy);
  float glow1 = exp(-dist * dist * 3.0);
  float glow2 = exp(-dist * dist * 10.0);
  float pulse = 0.85 + 0.15 * sin(time * 6.2832);
  vec3 gold = vec3(0.95, 0.78, 0.3);
  vec3 warm = vec3(0.9, 0.5, 0.25);
  vec3 blue = vec3(0.3, 0.67, 0.97);
  vec3 col = gold * glow2 * 0.6 + warm * glow1 * 0.3 + blue * glow1 * 0.15;
  col *= pulse;
  float alpha = (glow1 * 0.2 + glow2 * 0.15) * pulse * reveal;
  return half4(col * alpha, alpha);
}
`);

const CelebrationGlow: React.FC = React.memo(() => {
  const { width, height } = useWindowDimensions();
  const time = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      100,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
    time.value = withDelay(
      100,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const uniforms = useDerivedValue(() => ({
    resolution: vec(width, height),
    time: time.value,
    reveal: reveal.value,
  }));

  if (!GLOW_SKSL) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill>
        <Shader source={GLOW_SKSL} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
});

CelebrationGlow.displayName = "CelebrationGlow";

// ── Main screen ───────────────────────────────────────────

const QuestCompleteScreen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [reflectionText, setReflectionText] = useState<string | null>(null);

  // Fire celebration haptic on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Poll for AI reflection
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      while (attempts < 8 && !cancelled) {
        attempts++;
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled) return;
        try {
          const fresh = await apiClient.sidequests.getById(id);
          if (fresh.aiReflection) {
            setReflectionText(fresh.aiReflection);
            return;
          }
        } catch { /* ignore */ }
      }
    };
    poll();

    return () => { cancelled = true; };
  }, [id]);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const phase = user?.onboardingPhase ?? 3;
    const dest = phase < 3 ? "/progressive-onboarding" : "/deck";
    router.replace(dest);
  }, [user?.onboardingPhase, router]);

  // Bounce animation for the emoji
  const emojiScale = useSharedValue(0);
  useEffect(() => {
    emojiScale.value = withDelay(
      200,
      withSpring(1, { damping: 8, stiffness: 120 }),
    );
  }, []);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  return (
    <View style={[s.container, { backgroundColor: colors.fixed.black }]}>
      <CelebrationGlow />

      <SafeAreaView style={s.safeArea}>
        <View style={s.content}>
          {/* Celebration emoji */}
          <Animated.View style={emojiStyle}>
            <Text style={s.emoji}>&#127881;</Text>
          </Animated.View>

          {/* Title */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(500).easing(Easing.out(Easing.cubic))}
          >
            <Text style={[s.title, { color: colors.text.primary }]}>
              Quest complete
            </Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>
              Your world just got a little bigger
            </Text>
          </Animated.View>

          {/* AI Reflection */}
          <Animated.View
            entering={FadeIn.delay(800).duration(600)}
            style={s.reflectionBox}
          >
            <Text style={[s.reflectionLabel, { color: colors.text.disabled }]}>
              WHAT I LEARNED
            </Text>
            {reflectionText ? (
              <Text style={[s.reflectionText, { color: colors.text.primary }]}>
                {reflectionText}
              </Text>
            ) : (
              <View style={s.shimmer}>
                <ActivityIndicator size="small" color={colors.text.secondary} />
                <Text style={[s.shimmerText, { color: colors.text.secondary }]}>
                  Reflecting on your experience...
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Spacer */}
          <View style={s.spacer} />

          {/* Continue button */}
          <Animated.View
            entering={FadeInDown.delay(1200).duration(400).easing(Easing.out(Easing.cubic))}
          >
            <Pressable
              style={[s.button, { backgroundColor: colors.accent.primary }]}
              onPress={handleContinue}
            >
              <Text style={s.buttonText}>Continue</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 20,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 26,
    fontWeight: fontWeight.bold,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    letterSpacing: 0.3,
  },
  reflectionBox: {
    width: "100%",
    maxWidth: 340,
    gap: 10,
    marginTop: 12,
  },
  reflectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: fontWeight.medium,
    letterSpacing: 1,
  },
  reflectionText: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    fontStyle: "italic",
    lineHeight: 24,
  },
  shimmer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  shimmerText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: radius.md,
    alignItems: "center",
  },
  buttonText: {
    fontFamily: fontFamily.mono,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    color: "#000",
    letterSpacing: 0.5,
  },
});

export default QuestCompleteScreen;
