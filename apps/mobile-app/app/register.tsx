import AppHeader from "@/components/AnimationHeader";
import Input from "@/components/Input/Input";
import MiniDeck from "@/components/Login/MiniDeck";
import { useAuth } from "@/contexts/AuthContext";
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
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
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
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";

const GradientOverlay: React.FC = React.memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="black" stopOpacity="0.3" />
          <Stop offset="0.5" stopColor="black" stopOpacity="0.5" />
          <Stop offset="1" stopColor="black" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
    </Svg>
  </View>
));

const RegisterScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );
    setTimeout(() => {
      Keyboard.dismiss();
      handleRegister();
    }, 150);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.fixed.black} />

      <GradientOverlay />

      <SafeAreaView style={styles.foreground}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header row — title + mini deck */}
            <View style={styles.headerRow}>
              <AppHeader />
              <MiniDeck />
            </View>

            {/* Spacer to push form down */}
            <View style={{ flex: 1 }} />

            {/* Form card */}
            <Animated.View
              entering={FadeInDown.duration(600).delay(300).springify()}
              style={styles.formWrapper}
            >
              <BlurView intensity={40} tint="dark" style={styles.formCard}>
                {Platform.OS === "android" && (
                  <View style={styles.androidBlurFallback} />
                )}

                <Animated.View layout={LinearTransition.springify()}>
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
                      onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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
                </Animated.View>
              </BlurView>
            </Animated.View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.fixed.black,
    },
    foreground: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      overflow: "visible",
      paddingTop: spacing["2xl"],
    },
    formWrapper: {
      width: "100%",
    },
    formCard: {
      borderRadius: radius["2xl"],
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.12)",
      overflow: "hidden",
    },
    androidBlurFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(42, 42, 42, 0.85)",
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
      color: "rgba(134, 239, 172, 0.6)",
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
    },
    loginLink: {
      color: colors.accent.primary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },
    bottomSpacer: {
      height: spacing.lg,
    },
  });

export default RegisterScreen;
