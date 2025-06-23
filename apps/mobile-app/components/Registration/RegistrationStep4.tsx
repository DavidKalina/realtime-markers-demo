import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Image } from "react-native";
import { Lock, Eye, EyeOff } from "lucide-react-native";
import Input from "@/components/Input/Input";
import { useRegistration } from "@/contexts/RegistrationContext";
import RegistrationStepLayout from "./RegistrationStepLayout";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import RegistrationCardLayout from "./RegistrationCardLayout";

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

const RegistrationStep4: React.FC = () => {
  const {
    registrationData,
    updateRegistrationData,
    resetRegistration,
    setCurrentStep,
  } = useRegistration();
  const { register } = useAuth();
  const router = useRouter();
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const glowRadius = useSharedValue(5);

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
    glowRadius.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 2000 }),
        withTiming(5, { duration: 2000 }),
      ),
      -1,
      true,
    );

    const timer = setTimeout(() => {
      confirmPasswordInputRef.current?.focus();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const toggleConfirmPasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleBack = () => {
    setCurrentStep(3);
  };

  const handleRegister = async () => {
    if (isLoading) return;

    if (registrationData.password !== registrationData.confirmPassword) {
      setError("Passwords do not match");
      confirmPasswordInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await register(
        registrationData.email,
        registrationData.password,
        registrationData.firstName,
        registrationData.lastName,
      );
      resetRegistration();
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

  const canProceed =
    registrationData.confirmPassword.length > 0 &&
    registrationData.password === registrationData.confirmPassword;

  const handleOAuthError = (error: Error) => {
    // Handle OAuth errors - could show a toast or error message
    console.error("OAuth error:", error);
  };

  return (
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
              <RegistrationCardLayout onOAuthError={handleOAuthError}>
                <Text style={styles.stepTitle}>Step 4 of 4</Text>
                <Text style={styles.stepSubtitle}>Confirm your password</Text>

                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Input
                    ref={confirmPasswordInputRef}
                    icon={Lock}
                    rightIcon={showConfirmPassword ? EyeOff : Eye}
                    onRightIconPress={toggleConfirmPasswordVisibility}
                    placeholder="Confirm password"
                    value={registrationData.confirmPassword}
                    onChangeText={(text) =>
                      updateRegistrationData({ confirmPassword: text })
                    }
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                    delay={300}
                  />
                </View>

                <View style={styles.passwordMatchIndicator}>
                  <Text
                    style={[
                      styles.matchText,
                      registrationData.confirmPassword.length > 0 &&
                      registrationData.password ===
                        registrationData.confirmPassword
                        ? styles.matchTextSuccess
                        : registrationData.confirmPassword.length > 0
                          ? styles.matchTextError
                          : styles.matchTextNeutral,
                    ]}
                  >
                    {registrationData.confirmPassword.length === 0
                      ? "Enter your password again to confirm"
                      : registrationData.password ===
                          registrationData.confirmPassword
                        ? "✓ Passwords match"
                        : "✗ Passwords do not match"}
                  </Text>
                </View>

                <RegistrationStepLayout
                  onNext={handleRegister}
                  onBack={handleBack}
                  canProceed={canProceed}
                  stepNumber={4}
                  totalSteps={4}
                  isLoading={isLoading}
                  nextButtonText="Create Account"
                />
              </RegistrationCardLayout>
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
  stepTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: newColors.cardText,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: newColors.cardTextSecondary,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    marginBottom: 24,
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
    gap: 12,
    marginBottom: 16,
  },
  passwordMatchIndicator: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: newColors.inputBackground,
    borderRadius: 8,
  },
  matchText: {
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
  },
  matchTextNeutral: {
    color: newColors.cardTextSecondary,
  },
  matchTextSuccess: {
    color: "#4CAF50",
  },
  matchTextError: {
    color: newColors.errorText,
  },
});

export default RegistrationStep4;
