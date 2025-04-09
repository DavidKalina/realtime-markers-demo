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
import { useAuth } from "@/contexts/AuthContext";
import { AuthWrapper } from "@/components/AuthWrapper";
import MapMojiHeader from "@/components/AnimationHeader";
import { useMapStyle } from "@/contexts/MapStyleContext";
import AnimatedMapBackground from "@/components/Background";
import { useFilterStore } from "@/stores/useFilterStore";
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
  withDelay,
  FadeInDown
} from "react-native-reanimated";

const RegisterScreen: React.FC = () => {
  const router = useRouter();
  const { mapStyle } = useMapStyle();
  const { register } = useAuth();
  const { fetchFilters } = useFilterStore();
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
    // Delay the auto-focus until after animations complete
    const timer = setTimeout(() => {
      displayNameInputRef.current?.focus();
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
      withSpring(1, { damping: 15, stiffness: 200 })
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
      await register(email, password, displayName);
      router.replace("/");
    } catch (error: any) {
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
                <Animated.View layout={LinearTransition.springify()} style={styles.formCard}>
                  {error && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <View style={styles.inputContainer}>
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
                  </View>

                  <View style={styles.inputContainer}>
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
                  </View>

                  <View style={styles.inputContainer}>
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
                  </View>

                  <View style={styles.inputContainer}>
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
                  </View>

                  <View style={styles.loginButtonContainer}>
                    <TouchableOpacity
                      onPress={handleRegisterPress}
                      disabled={isLoading}
                      activeOpacity={0.7}
                      style={[styles.loginButton, buttonAnimatedStyle]}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.loginButtonText}>Create Account</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.createAccountContainer}>
                    <Text style={styles.createAccountText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => router.push("/login")}>
                      <Text style={styles.createAccountLink}>Login</Text>
                    </TouchableOpacity>
                  </View>
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
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
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
  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
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
  loginButtonContainer: {
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
