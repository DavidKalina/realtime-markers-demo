import { AuthWrapper } from "@/components/AuthWrapper";
import MapMojiHeader from "@/components/AnimationHeader";
import Input from "@/components/Input/Input";
import { OAuthButtons } from "@/components/Login/OAuthButtons";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
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

const RegisterScreen: React.FC = () => {
  const router = useRouter();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
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

  const handleRegister = async () => {
    if (!email.trim()) {
      setError("Email is required");
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setError("Password is required");
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      confirmPasswordRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await register(
        email,
        password,
        firstName.trim() || undefined,
        lastName.trim() || undefined,
      );
      router.replace("/");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Registration error:", err);
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Failed to register. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleRegisterPress = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );
    setTimeout(() => {
      Keyboard.dismiss();
      handleRegister();
    }, 150);
  };

  const handleOAuthError = (oauthError: Error) => {
    setError(oauthError.message);
  };

  return (
    <AuthWrapper requireAuth={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={colors.bg.primary}
        />

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
              <MapMojiHeader />

              <Animated.View
                entering={FadeInDown.duration(600).delay(300).springify()}
                layout={LinearTransition.springify()}
                style={styles.formContainer}
              >
                <Animated.View
                  layout={LinearTransition.springify()}
                  style={styles.formCard}
                >
                  {error && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <View style={{ gap: spacing.lg }}>
                    <Input
                      ref={firstNameRef}
                      icon={User}
                      placeholder="First Name"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      autoComplete="given-name"
                      returnKeyType="next"
                      onSubmitEditing={() => lastNameRef.current?.focus()}
                      delay={200}
                    />

                    <Input
                      ref={lastNameRef}
                      icon={User}
                      placeholder="Last Name"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      autoComplete="family-name"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      delay={250}
                    />

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
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      delay={300}
                    />

                    <Input
                      ref={passwordRef}
                      icon={Lock}
                      rightIcon={showPassword ? EyeOff : Eye}
                      onRightIconPress={togglePasswordVisibility}
                      placeholder="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                      onSubmitEditing={() =>
                        confirmPasswordRef.current?.focus()
                      }
                      delay={350}
                    />

                    <Input
                      ref={confirmPasswordRef}
                      icon={Lock}
                      rightIcon={showConfirmPassword ? EyeOff : Eye}
                      onRightIconPress={toggleConfirmPasswordVisibility}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleRegister}
                      delay={400}
                    />
                  </View>

                  <View style={styles.buttonContainer}>
                    <Animated.View style={buttonAnimatedStyle}>
                      <TouchableOpacity
                        onPress={handleRegisterPress}
                        disabled={isLoading}
                        activeOpacity={0.7}
                        style={styles.registerButton}
                      >
                        {isLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.text.primary}
                          />
                        ) : (
                          <Text style={styles.registerButtonText}>
                            Create Account
                          </Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  </View>

                  <View style={styles.loginLinkContainer}>
                    <Text style={styles.loginLinkText}>
                      Already have an account?{" "}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push("/login");
                      }}
                    >
                      <Text style={styles.loginLink}>Login</Text>
                    </TouchableOpacity>
                  </View>

                  <OAuthButtons onError={handleOAuthError} />
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthWrapper>
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
  registerButton: {
    borderRadius: radius.md,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.accent.muted,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  registerButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  loginLinkText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },
  loginLink: {
    color: colors.accent.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
});

export default RegisterScreen;
