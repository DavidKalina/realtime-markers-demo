import AppHeader from "@/components/AnimationHeader";
import Input from "@/components/Input/Input";
import { apiClient } from "@/services/ApiClient";
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
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
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
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const ForgotPasswordScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError("Email is required");
      emailRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const trimmedEmail = email.trim();
    try {
      await apiClient.auth.requestPasswordReset(trimmedEmail);
    } catch {
      // Still navigate — the backend always returns 200
    } finally {
      setIsLoading(false);
      router.push(`/reset-password?email=${encodeURIComponent(trimmedEmail)}`);
    }
  };

  const handleSendCodePress = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buttonScale.value = withSequence(
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );
    setTimeout(() => {
      Keyboard.dismiss();
      handleSendCode();
    }, 150);
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
          <Animated.View
            entering={FadeInDown.duration(600).delay(100).springify()}
            style={styles.contentContainer}
          >
            <AppHeader />

            <Animated.View
              entering={FadeInDown.duration(600).delay(300).springify()}
              layout={LinearTransition.springify()}
              style={styles.formContainer}
            >
              <Animated.View
                layout={LinearTransition.springify()}
                style={styles.formCard}
              >
                <Text style={styles.title}>Forgot Password</Text>
                <Text style={styles.subtitle}>
                  Enter your email and we'll send you a 6-digit code to reset
                  your password.
                </Text>

                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={{ gap: spacing.lg }}>
                  <Input
                    ref={emailRef}
                    icon={Mail}
                    placeholder="Email address"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="done"
                    onSubmitEditing={handleSendCode}
                    delay={200}
                  />
                </View>

                <View style={styles.buttonContainer}>
                  <Animated.View style={buttonAnimatedStyle}>
                    <TouchableOpacity
                      onPress={handleSendCodePress}
                      disabled={isLoading}
                      activeOpacity={0.7}
                      style={styles.sendButton}
                    >
                      {isLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.text.primary}
                        />
                      ) : (
                        <Text style={styles.sendButtonText}>Send Code</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                </View>

                <View style={styles.backLinkContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.back();
                    }}
                  >
                    <Text style={styles.backLink}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </Animated.View>
          </Animated.View>
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
      zIndex: 2,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing._10,
    },
    contentContainer: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xl,
    },
    formContainer: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
      zIndex: 2,
    },
    formCard: {
      width: "100%",
      borderRadius: radius["2xl"],
      padding: spacing.xl,
      backgroundColor: colors.bg.card,
      borderWidth: 1,
      borderColor: colors.border.default,
      shadowColor: "rgba(0, 0, 0, 0.1)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: radius.md,
      elevation: 8,
      position: "relative",
      overflow: "hidden",
    },
    title: {
      color: colors.text.primary,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      marginBottom: spacing.xs,
    },
    subtitle: {
      color: colors.text.secondary,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    errorContainer: {
      backgroundColor: colors.status.error.bg,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.status.error.border,
    },
    errorText: {
      color: colors.status.error.text,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
    },
    buttonContainer: {
      marginTop: spacing.xl,
    },
    sendButton: {
      borderRadius: radius.md,
      height: 55,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.accent.muted,
      borderWidth: 1,
      borderColor: colors.accent.border,
    },
    sendButtonText: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
    },
    backLinkContainer: {
      alignItems: "center",
      marginTop: spacing.lg,
    },
    backLink: {
      color: colors.accent.primary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },
  });

export default ForgotPasswordScreen;
