import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AuthWrapper } from "../AuthWrapper";
import Input from "../Input/Input";
import { OAuthButtons } from "./OAuthButtons";

const newColors = {
  background: "#00697A",
  text: "#FFFFFF",
  accent: "#FDB813",
  cardBackground: "#FFFFFF",
  cardText: "#000000",
  cardTextSecondary: "#6c757d",
  buttonBackground: "#FFFFFF",
  buttonText: "#00697A",
  buttonBorder: "#DDDDDD",
  inputBackground: "#F5F5F5",
  errorBackground: "#FFCDD2",
  errorText: "#B71C1C",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
  activityIndicator: "#00697A",
};

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
  const glowRadius = useSharedValue(5);

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      shadowColor: "#FDB813",
      shadowRadius: glowRadius.value,
      shadowOpacity: 0.9,
      shadowOffset: { width: 0, height: 0 },
      elevation: glowRadius.value,
    };
  });

  // Cleanup effect
  useEffect(() => {
    glowRadius.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 2000 }),
        withTiming(5, { duration: 2000 }),
      ),
      -1,
      true,
    );
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
      // The AuthWrapper will handle the navigation
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
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
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
      backgroundColor: newColors.background,
    },

    keyboardAvoidingView: {
      flex: 1,
      zIndex: 2,
    },

    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 10,
    },

    contentContainer: {
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
    },

    logoContainer: {
      marginBottom: 10,
      shadowColor: "#FDB813",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 10,
      elevation: 10,
    },

    logo: {
      width: 150,
      height: 150,
      resizeMode: "contain",
    },

    slogan: {
      fontSize: 18,
      color: newColors.text,
      fontFamily: "Poppins-SemiBold",
      marginBottom: 20,
      textAlign: "center",
      fontWeight: "600",
      letterSpacing: 0.5,
    },

    formContainer: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
      zIndex: 2,
    },

    formCard: {
      width: "100%",
      borderRadius: 20,
      padding: 20,
      backgroundColor: newColors.cardBackground,
      borderWidth: 1,
      borderColor: newColors.divider,
      shadowColor: "rgba(0, 0, 0, 0.1)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
      position: "relative",
      overflow: "hidden",
    },

    errorContainer: {
      backgroundColor: newColors.errorBackground,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: newColors.errorBorder,
    },

    errorText: {
      color: newColors.errorText,
      fontSize: 14,
      fontFamily: "Poppins-Regular",
    },

    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: newColors.inputBackground,
      borderRadius: 12,
      marginBottom: 16,
      paddingHorizontal: 12,
      height: 55,
      borderWidth: 1,
      borderColor: newColors.buttonBorder,
    },

    inputIcon: {
      marginRight: 10,
    },

    input: {
      flex: 1,
      height: "100%",
      color: newColors.cardText,
      fontSize: 16,
      fontFamily: "Poppins-Regular",
    },

    eyeIcon: {
      padding: 8,
    },

    loginButton: {
      borderRadius: 12,
      height: 55,
      justifyContent: "center",
      alignItems: "center",
      marginVertical: 20,
      backgroundColor: newColors.accent,
      borderWidth: 1,
      borderColor: newColors.accent,
    },

    loginButtonText: {
      color: newColors.cardText,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: "Poppins-Regular",
      letterSpacing: 0.5,
    },

    createAccountContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 16,
    },

    createAccountText: {
      color: newColors.cardTextSecondary,
      fontSize: 14,
      fontFamily: "Poppins-Regular",
    },

    createAccountLink: {
      color: newColors.buttonText,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Poppins-Regular",
    },

    profileSelectorContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: newColors.inputBackground,
      borderRadius: 12,
      marginBottom: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: newColors.buttonBorder,
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
      borderRadius: 12,
      backgroundColor: "rgba(245, 158, 11, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.2)",
    },

    profileEmojiLarge: {
      fontSize: 20,
    },

    selectedProfileName: {
      color: newColors.cardText,
      fontSize: 15,
      fontWeight: "500",
      fontFamily: "Poppins-Regular",
    },

    noProfileContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    placeholderAvatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: newColors.inputBackground,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: newColors.buttonBorder,
    },

    selectProfileText: {
      color: newColors.cardTextSecondary,
      fontSize: 15,
      fontFamily: "Poppins-Regular",
    },

    dropdownTrigger: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: newColors.inputBackground,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: newColors.buttonBorder,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      zIndex: 10,
    },

    dropdownContainer: {
      width: "90%",
      maxWidth: 400,
      maxHeight: 300,
      backgroundColor: newColors.cardBackground,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: newColors.divider,
      shadowColor: "rgba(0, 0, 0, 0.1)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },

    profileList: {
      width: "100%",
      paddingVertical: 4,
    },

    profileDropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: newColors.divider,
    },

    profileEmojiContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: newColors.inputBackground,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: newColors.buttonBorder,
    },

    profileEmojiSmall: {
      fontSize: 20,
    },

    profileDropdownName: {
      color: newColors.cardText,
      fontSize: 15,
      fontFamily: "Poppins-Regular",
      flex: 1,
    },

    profileDropdownRole: {
      fontSize: 12,
      fontFamily: "Poppins-Regular",
      fontWeight: "600",
      textTransform: "uppercase",
    },

    loginButtonContainer: {
      marginTop: 20,
    },
  });

  return (
    <AuthWrapper requireAuth={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={newColors.background}
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
              <Animated.View style={[styles.logoContainer, animatedGlowStyle]}>
                <Image
                  source={require("@/assets/images/frederick-logo.png")}
                  style={styles.logo}
                />
              </Animated.View>
              <Text style={styles.slogan}>Built on what matters</Text>

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

                  <View style={{ gap: 16 }}>
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
                    <TouchableOpacity
                      onPress={handleLoginPress}
                      disabled={isLoading}
                      activeOpacity={0.7}
                      style={[styles.loginButton, buttonAnimatedStyle]}
                    >
                      {isLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={newColors.cardText}
                        />
                      ) : (
                        <Text style={styles.loginButtonText}>Login</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.createAccountContainer}>
                    <Text style={styles.createAccountText}>
                      Don't have an account?{" "}
                    </Text>
                    <TouchableOpacity onPress={handleCreateAccount}>
                      <Text style={styles.createAccountLink}>Create one</Text>
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

export default Login;
