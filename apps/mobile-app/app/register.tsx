import { AuthWrapper } from "@/components/AuthWrapper";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
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
import Input from "@/components/Input/Input";
import OAuthButtons from "@/components/Login/OAuthButtons";

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

const RegisterScreen: React.FC = () => {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<TextInput>(null);
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
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

  useEffect(() => {
    // Animate glow effect
    glowRadius.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 2000 }),
        withTiming(5, { duration: 2000 }),
      ),
      -1,
      true,
    );

    // Delay the auto-focus until after animations complete
    const timer = setTimeout(() => {
      firstNameInputRef.current?.focus();
    }, 1000); // 1000ms delay to allow animations to complete

    return () => clearTimeout(timer);
  }, []);

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleRegisterPress = async () => {
    if (isLoading) return;

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate button press
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    // Delay the register action until after animation
    setTimeout(() => {
      handleRegister();
    }, 150);
  };

  const handleRegister = async () => {
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

    if (!confirmPassword) {
      setError("Please confirm your password");
      confirmPasswordInputRef.current?.focus();
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      confirmPasswordInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await register(email, password, firstName, lastName);
      router.replace("/");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Registration error:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to register. Please check your information and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    Haptics.selectionAsync();
    router.push("/login");
  };

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

                  <View style={{ gap: 12 }}>
                    <Input
                      ref={firstNameInputRef}
                      icon={User}
                      placeholder="First name"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => lastNameInputRef.current?.focus()}
                      delay={300}
                    />

                    <Input
                      ref={lastNameInputRef}
                      icon={User}
                      placeholder="Last name"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                      delay={400}
                    />

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
                      delay={500}
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
                      returnKeyType="next"
                      onSubmitEditing={() =>
                        confirmPasswordInputRef.current?.focus()
                      }
                      delay={600}
                    />

                    <Input
                      ref={confirmPasswordInputRef}
                      icon={Lock}
                      rightIcon={showConfirmPassword ? EyeOff : Eye}
                      onRightIconPress={toggleConfirmPasswordVisibility}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleRegisterPress}
                      delay={700}
                    />
                  </View>

                  <View style={styles.loginButtonContainer}>
                    <TouchableOpacity
                      onPress={handleRegisterPress}
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
                        <Text style={styles.loginButtonText}>
                          Create Account
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.createAccountContainer}>
                    <Text style={styles.createAccountText}>
                      Already have an account?{" "}
                    </Text>
                    <TouchableOpacity onPress={handleLogin}>
                      <Text style={styles.createAccountLink}>Login</Text>
                    </TouchableOpacity>
                  </View>

                  <OAuthButtons onError={setError} />
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
    paddingVertical: 20,
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  logoContainer: {
    marginBottom: 8,
    shadowColor: "#FDB813",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: "contain",
  },
  slogan: {
    fontSize: 16,
    color: newColors.text,
    fontFamily: "Poppins-Regular",
    marginBottom: 16,
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
    padding: 24,
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
  loginButtonContainer: {
    marginTop: 16,
  },
  loginButton: {
    borderRadius: 12,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 16,
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
    marginTop: 12,
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
});

export default RegisterScreen;
