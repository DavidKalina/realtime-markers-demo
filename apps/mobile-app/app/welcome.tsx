import AppHeader from "@/components/AnimationHeader";
import MiniDeck from "@/components/Login/MiniDeck";
import { SkiaGlow } from "@/components/SkiaGlow";
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
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

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

      <SkiaGlow revealDelay={500} />

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
