import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  StatusBar,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Lock, Mail, Eye, EyeOff, ArrowLeft, User } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import apiClient from "@/services/ApiClient";
import { AuthWrapper } from "@/components/AuthWrapper";
import MapMojiHeader from "@/components/AnimationHeader";
import { useMapStyle } from "@/contexts/MapStyleContext";
import AnimatedMapBackground from "@/components/Background";
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  LinearTransition,
  BounceIn,
  SlideOutRight,
  SlideInRight,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withSequence,
  withDelay
} from "react-native-reanimated";

const RegisterScreen: React.FC = () => {
  const router = useRouter();
  const { mapStyle } = useMapStyle();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<TextInput>(null);
  const displayNameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  useEffect(() => {
    // Auto-focus the display name input when the screen loads
    setTimeout(() => {
      displayNameInputRef.current?.focus();
    }, 500);
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
      withSpring(1, { damping: 15, stiffness: 200 })
    );

    // Delay the register action until after animation
    setTimeout(() => {
      handleRegister();
    }, 150);
  };

  const handleRegister = async () => {
    // Basic validation
    if (!displayName.trim()) {
      setError("Display name is required");
      displayNameInputRef.current?.focus();
      return;
    }

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

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      passwordInputRef.current?.focus();
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

    try {
      await apiClient.register(email, password, displayName);
      // Navigate to the main app screen on successful registration and login
      router.replace("/");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Registration error:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to register. Please check your information and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthWrapper requireAuth={false}>
      <SafeAreaView style={styles.container}>
        <AnimatedMapBackground settings={{ styleURL: mapStyle }} />
        <StatusBar barStyle="light-content" backgroundColor="#333" />

        <Animated.View
          entering={FadeIn.duration(800).delay(300).springify()}
          style={styles.headerContainer}
        >
          <MapMojiHeader />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              entering={FadeIn.duration(800).delay(500).springify()}
              style={styles.formContainer}
            >
              <Animated.View
                layout={LinearTransition.springify()}
                style={styles.formCard}
              >
                {error && (
                  <Animated.View
                    entering={FadeIn.duration(300).springify()}
                    exiting={FadeOut.duration(200)}
                    layout={LinearTransition.springify()}
                    style={styles.errorContainer}
                  >
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                )}

                <Animated.View
                  entering={SlideInRight.duration(400).springify()}
                  style={styles.inputContainer}
                >
                  <User size={18} color="#93c5fd" style={styles.inputIcon} />
                  <TextInput
                    ref={displayNameInputRef}
                    style={styles.input}
                    placeholder="Display name"
                    placeholderTextColor="#808080"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => emailInputRef.current?.focus()}
                  />
                </Animated.View>

                <Animated.View
                  entering={SlideInRight.duration(400).delay(100).springify()}
                  style={styles.inputContainer}
                >
                  <Mail size={18} color="#93c5fd" style={styles.inputIcon} />
                  <TextInput
                    ref={emailInputRef}
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#808080"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </Animated.View>

                <Animated.View
                  entering={SlideInRight.duration(400).delay(200).springify()}
                  style={styles.inputContainer}
                >
                  <Lock size={18} color="#93c5fd" style={styles.inputIcon} />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#808080"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                  />
                  <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                    {showPassword ? (
                      <EyeOff size={18} color="#93c5fd" />
                    ) : (
                      <Eye size={18} color="#93c5fd" />
                    )}
                  </TouchableOpacity>
                </Animated.View>

                <Animated.View
                  entering={SlideInRight.duration(400).delay(300).springify()}
                  style={styles.inputContainer}
                >
                  <Lock size={18} color="#93c5fd" style={styles.inputIcon} />
                  <TextInput
                    ref={confirmPasswordInputRef}
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor="#808080"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleRegisterPress}
                  />
                  <TouchableOpacity
                    onPress={toggleConfirmPasswordVisibility}
                    style={styles.eyeIcon}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} color="#93c5fd" />
                    ) : (
                      <Eye size={18} color="#93c5fd" />
                    )}
                  </TouchableOpacity>
                </Animated.View>

                <Animated.View
                  entering={FadeIn.duration(400).delay(400).springify()}
                  layout={LinearTransition.springify()}
                >
                  <Animated.View style={[styles.loginButton, buttonAnimatedStyle]}>
                    <TouchableOpacity
                      onPress={handleRegisterPress}
                      disabled={isLoading}
                      activeOpacity={1}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.loginButtonText}>Create Account</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>

                <Animated.View
                  entering={FadeIn.duration(400).delay(500).springify()}
                  style={styles.createAccountContainer}
                >
                  <Text style={styles.createAccountText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push("/login")}>
                    <Text style={styles.createAccountLink}>Login</Text>
                  </TouchableOpacity>
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
    backgroundColor: "transparent",
  },
  headerContainer: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  keyboardAvoidingView: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    marginTop: 10,
    zIndex: 2,
  },
  formCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    backgroundColor: "rgba(58, 58, 58, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    position: "relative",
    overflow: "hidden",
  },
  errorContainer: {
    backgroundColor: "rgba(255, 70, 70, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 70, 70, 0.3)",
  },
  errorText: {
    color: "#ff7675",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(45, 45, 45, 0.8)",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 55,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#f8f9fa",
    fontSize: 16,
    fontFamily: "SpaceMono",
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
    shadowColor: "#4dabf7",
    backgroundColor: "#4dabf7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  loginButtonText: {
    color: "black",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  createAccountContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  createAccountText: {
    color: "#adb5bd",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  createAccountLink: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
});

export default RegisterScreen;
