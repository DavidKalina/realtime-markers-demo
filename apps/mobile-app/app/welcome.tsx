import AppHeader from "@/components/AnimationHeader";
import MiniDeck from "@/components/Login/MiniDeck";
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
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
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

const GLOW_SKSL = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float reveal;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;

  // Glow centered horizontally, positioned in upper third
  float cx = 0.5 + sin(time * 6.2832) * 0.02;
  float cy = 0.38;

  float dx = uv.x - cx;
  float dy = (uv.y - cy) * (resolution.y / resolution.x);
  float dist = sqrt(dx * dx + dy * dy);

  // Wide, soft falloff — fills the screen naturally
  float glow1 = exp(-dist * dist * 4.0);
  float glow2 = exp(-dist * dist * 12.0);
  float glow3 = exp(-dist * dist * 2.0) * 0.25;

  float pulse = 0.85 + 0.15 * sin(time * 6.2832);

  vec3 blue = vec3(0.3, 0.67, 0.97);
  vec3 cyan = vec3(0.4, 0.9, 0.85);
  vec3 warm = vec3(0.52, 0.38, 0.85);

  vec3 col = blue * glow1 + cyan * glow2 * 0.5 + warm * glow3;
  col *= pulse;

  float alpha = (glow1 * 0.25 + glow2 * 0.15 + glow3 * 0.08) * pulse * reveal;

  return half4(col * alpha, alpha);
}
`);

const SkiaGlow: React.FC = React.memo(() => {
  const { width, height } = useWindowDimensions();
  const time = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      500,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
    time.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
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

SkiaGlow.displayName = "SkiaGlow";

export default function WelcomeScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const loginScale = useSharedValue(1);
  const registerScale = useSharedValue(1);

  const loginAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loginScale.value }],
  }));

  const registerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: registerScale.value }],
  }));

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loginScale.value = withSequence(
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );
    setTimeout(() => router.push("/login"), 150);
  };

  const handleRegister = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    registerScale.value = withSequence(
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );
    setTimeout(() => router.push("/register"), 150);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.fixed.black}
      />

      <SkiaGlow />

      <SafeAreaView style={styles.foreground}>
        {/* Centered branding */}
        <View style={styles.brandingArea}>
          <Animated.View
            entering={FadeInUp.duration(600).springify()}
            style={styles.headerColumn}
          >
            <AppHeader size="large" />
            <MiniDeck variant="chain" />
          </Animated.View>

        </View>

        {/* Bottom buttons */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(400).springify()}
          style={styles.buttonsWrapper}
        >
          <BlurView intensity={40} tint="dark" style={styles.buttonsCard}>
            {Platform.OS === "android" && (
              <View style={styles.androidBlurFallback} />
            )}

            <Animated.View style={loginAnimatedStyle}>
              <TouchableOpacity
                onPress={handleLogin}
                activeOpacity={0.7}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Login</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={registerAnimatedStyle}>
              <TouchableOpacity
                onPress={handleRegister}
                activeOpacity={0.7}
                style={styles.registerButton}
              >
                <Text style={styles.registerButtonText}>Create Account</Text>
              </TouchableOpacity>
            </Animated.View>
          </BlurView>
        </Animated.View>

        <View style={styles.bottomSpacer} />
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.fixed.black,
    },

    foreground: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
      justifyContent: "center",
    },

    brandingArea: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.xl,
    },

    headerColumn: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
      overflow: "visible",
    },

    buttonsWrapper: {
      paddingHorizontal: spacing.xl,
      width: "100%",
      maxWidth: 440,
      alignSelf: "center",
    },

    buttonsCard: {
      borderRadius: radius["2xl"],
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.12)",
      overflow: "hidden",
      gap: spacing.md,
    },

    androidBlurFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(42, 42, 42, 0.85)",
    },

    loginButton: {
      borderRadius: radius.md,
      height: 55,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.accent.muted,
      borderWidth: 1,
      borderColor: colors.accent.border,
    },

    loginButtonText: {
      color: colors.accent.primary,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
    },

    registerButton: {
      borderRadius: radius.md,
      height: 55,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.12)",
    },

    registerButtonText: {
      color: colors.text.secondary,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
    },

    bottomSpacer: {
      height: spacing.lg,
    },
  });
