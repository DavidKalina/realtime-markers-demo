import { useAuth } from "@/contexts/AuthContext";
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
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
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
import MapMojiHeader from "../AnimationHeader";
import Input from "../Input/Input";

const Login: React.FC = () => {
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

  // Cleanup effect
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
      // Keep loading state until navigation completes
      // The auth guard will handle the navigation
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

  const handleOAuthError = (error: Error) => {
    setError(error.message);
  };

  const handleLoginPress = async () => {
    if (isLoading) return;

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate button press
    buttonScale.value = withSequence(
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );

    // Delay the login action until after animation
    setTimeout(() => {
      Keyboard.dismiss();
      handleLogin();
    }, 150);
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

    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg.cardAlt,
      borderRadius: radius.md,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
      height: 55,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    inputIcon: {
      marginRight: spacing._10,
    },

    input: {
      flex: 1,
      height: "100%",
      color: colors.text.primary,
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
    },

    eyeIcon: {
      padding: spacing.sm,
    },

    loginButton: {
      borderRadius: radius.md,
      height: 55,
      justifyContent: "center",
      alignItems: "center",
      marginVertical: spacing.xl,
      backgroundColor: colors.accent.muted,
      borderWidth: 1,
      borderColor: colors.accent.border,
    },

    loginButtonText: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
    },

    createAccountContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: spacing.lg,
    },

    createAccountText: {
      color: colors.text.secondary,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
    },

    createAccountLink: {
      color: colors.accent.primary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },

    profileSelectorContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.bg.cardAlt,
      borderRadius: radius.md,
      marginBottom: spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
      height: 55,
      zIndex: 4,
    },

    selectedProfileContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    selectedProfileEmojiContainer: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: "rgba(245, 158, 11, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.md,
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.2)",
    },

    profileEmojiLarge: {
      fontSize: fontSize.xl,
    },

    selectedProfileName: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: fontWeight.medium,
      fontFamily: fontFamily.mono,
    },

    noProfileContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    placeholderAvatar: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.bg.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    selectProfileText: {
      color: colors.text.secondary,
      fontSize: 15,
      fontFamily: fontFamily.mono,
    },

    dropdownTrigger: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.bg.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay.scrim,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
      zIndex: 10,
    },

    dropdownContainer: {
      width: "90%",
      maxWidth: 400,
      maxHeight: 300,
      backgroundColor: colors.bg.card,
      borderRadius: radius["2xl"],
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border.default,
      shadowColor: "rgba(0, 0, 0, 0.1)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: radius.md,
      elevation: 8,
    },

    profileList: {
      width: "100%",
      paddingVertical: spacing.xs,
    },

    profileDropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },

    profileEmojiContainer: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.bg.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    profileEmojiSmall: {
      fontSize: fontSize.xl,
    },

    profileDropdownName: {
      color: colors.text.primary,
      fontSize: 15,
      fontFamily: fontFamily.mono,
      flex: 1,
    },

    profileDropdownRole: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      textTransform: "uppercase",
    },

    loginButtonContainer: {
      marginTop: spacing.xl,
    },
  });

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
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Login;
