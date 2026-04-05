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
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import AppHeader from "../AnimationHeader";
import Input from "../Input/Input";
import MiniDeck from "./MiniDeck";

// Gradient overlay component
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

const Login: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword(!showPassword);
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      setError("Email is required");
      emailInputRef.current?.focus();
      return;
    }

    if (!password) {
      setError("Password is required");
      passwordInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await login(email, password);
      router.replace("/");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Login error:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to login. Please check your credentials and try again.",
      );
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    Haptics.selectionAsync();
    router.push("/register");
  };

  const handleLoginPress = async () => {
    if (isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    buttonScale.value = withSequence(
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );

    setTimeout(() => {
      Keyboard.dismiss();
      handleLogin();
    }, 150);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.fixed.black}
      />

      {/* Layer 3: Gradient overlay */}
      <GradientOverlay />

      {/* Layer 4: Foreground content */}
      <SafeAreaView style={styles.foreground}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          {/* Header row — title + mini deck, at top */}
          <View style={styles.headerRow}>
            <AppHeader />
            <MiniDeck />
          </View>

          {/* Spacer to push form down */}
          <View style={{ flex: 1 }} />

          {/* Form card — anchored at bottom */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(300).springify()}
            style={styles.formWrapper}
          >
            <BlurView intensity={40} tint="dark" style={styles.formCard}>
              {/* Android fallback: semi-transparent background */}
              {Platform.OS === "android" && (
                <View style={styles.androidBlurFallback} />
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={{ gap: spacing.lg }}>
                <Input
                  ref={emailInputRef}
                  icon={Mail}
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  delay={300}
                />

                <Input
                  ref={passwordInputRef}
                  icon={Lock}
                  rightIcon={showPassword ? EyeOff : Eye}
                  onRightIconPress={togglePasswordVisibility}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  delay={400}
                />

                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push("/forgot-password");
                  }}
                  style={styles.forgotPasswordContainer}
                >
                  <Text style={styles.forgotPasswordText}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.loginButtonContainer}>
                <Animated.View style={buttonAnimatedStyle}>
                  <TouchableOpacity
                    onPress={handleLoginPress}
                    disabled={isLoading}
                    activeOpacity={0.7}
                    style={styles.loginButton}
                  >
                    {isLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.text.primary}
                      />
                    ) : (
                      <Text style={styles.loginButtonText}>Login</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <View style={styles.createAccountContainer}>
                <Text style={styles.createAccountText}>
                  Don't have an account?{" "}
                </Text>
                <TouchableOpacity onPress={handleCreateAccount}>
                  <Text style={styles.createAccountLink}>Create one</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>

          {/* Bottom spacer */}
          <View style={styles.bottomSpacer} />
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

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      overflow: "visible",
      paddingTop: spacing["2xl"],
    },

    formWrapper: {
      paddingHorizontal: spacing.xl,
      width: "100%",
      maxWidth: 440,
      alignSelf: "center",
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

    loginButtonContainer: {
      marginTop: spacing.xl,
    },

    createAccountContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: spacing.lg,
    },

    createAccountText: {
      color: "rgba(134, 239, 172, 0.6)",
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
    },

    createAccountLink: {
      color: colors.accent.primary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },

    forgotPasswordContainer: {
      alignSelf: "flex-end",
      marginTop: -spacing.sm,
    },

    forgotPasswordText: {
      color: "rgba(134, 239, 172, 0.6)",
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
    },

    bottomSpacer: {
      height: spacing.lg,
    },
  });

export default Login;
