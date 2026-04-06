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
import Input from "../Input/Input";

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
    // Autofocus email field after mount animation
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 600);
    return () => {
      clearTimeout(timer);
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

      <SafeAreaView style={styles.foreground}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          {/* Form card — at the top */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(100).springify()}
            style={styles.formWrapper}
          >
            <BlurView intensity={40} tint="dark" style={styles.formCard}>
              {Platform.OS === "android" && (
                <View style={styles.androidBlurFallback} />
              )}

              <Text style={styles.formTitle}>Welcome back</Text>

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
                  delay={100}
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
                  delay={200}
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
      flex: 1,
    },

    keyboardAvoidingView: {
      flex: 1,
    },

    formWrapper: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
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

    formTitle: {
      fontSize: fontSize.xl,
      fontFamily: fontFamily.display,
      color: colors.fixed.white,
      marginBottom: spacing.xl,
      textShadowColor: "rgba(77, 171, 247, 0.4)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
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
  });

export default Login;
