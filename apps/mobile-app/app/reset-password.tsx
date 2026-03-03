import AppHeader from "@/components/AnimationHeader";
import Input from "@/components/Input/Input";
import { apiClient } from "@/services/ApiClient";
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  spring,
} from "@/theme";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff, Hash, Lock } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const ResetPasswordScreen: React.FC = () => {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleResetPassword = async () => {
    if (!code.trim()) {
      setError("Reset code is required");
      codeRef.current?.focus();
      return;
    }
    if (code.trim().length !== 6) {
      setError("Code must be 6 digits");
      codeRef.current?.focus();
      return;
    }
    if (!newPassword) {
      setError("New password is required");
      passwordRef.current?.focus();
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      passwordRef.current?.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      confirmPasswordRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiClient.auth.resetPassword(email || "", code.trim(), newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Password Reset",
        "Your password has been reset successfully. Please log in with your new password.",
        [{ text: "OK", onPress: () => router.replace("/login") }],
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Failed to reset password. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleResetPress = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buttonScale.value = withSequence(
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );
    setTimeout(() => {
      Keyboard.dismiss();
      handleResetPassword();
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
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit code sent to {email} and your new password.
                </Text>

                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={{ gap: spacing.lg }}>
                  <Input
                    ref={codeRef}
                    icon={Hash}
                    placeholder="6-digit code"
                    value={code}
                    onChangeText={(text) =>
                      setCode(text.replace(/[^0-9]/g, "").slice(0, 6))
                    }
                    keyboardType="number-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    delay={200}
                  />

                  <Input
                    ref={passwordRef}
                    icon={Lock}
                    rightIcon={showPassword ? EyeOff : Eye}
                    onRightIconPress={togglePasswordVisibility}
                    placeholder="New password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                    delay={300}
                  />

                  <Input
                    ref={confirmPasswordRef}
                    icon={Lock}
                    rightIcon={showConfirmPassword ? EyeOff : Eye}
                    onRightIconPress={toggleConfirmPasswordVisibility}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleResetPassword}
                    delay={400}
                  />
                </View>

                <View style={styles.buttonContainer}>
                  <Animated.View style={buttonAnimatedStyle}>
                    <TouchableOpacity
                      onPress={handleResetPress}
                      disabled={isLoading}
                      activeOpacity={0.7}
                      style={styles.resetButton}
                    >
                      {isLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.text.primary}
                        />
                      ) : (
                        <Text style={styles.resetButtonText}>
                          Reset Password
                        </Text>
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
                    <Text style={styles.backLink}>Back</Text>
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

const styles = StyleSheet.create({
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
  resetButton: {
    borderRadius: radius.md,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.accent.muted,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  resetButtonText: {
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

export default ResetPasswordScreen;
