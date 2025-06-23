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

const RegistrationStep3: React.FC = () => {
  const { registrationData, updateRegistrationData, setCurrentStep } =
    useRegistration();
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      passwordInputRef.current?.focus();
    }, 500);

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

  const handleNext = () => {
    if (
      registrationData.password.length >= 8 &&
      registrationData.password === registrationData.confirmPassword
    ) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    setCurrentStep(2);
  };

  const passwordsMatch =
    registrationData.password === registrationData.confirmPassword;
  const canProceed =
    registrationData.password.length >= 8 &&
    registrationData.confirmPassword.length > 0 &&
    passwordsMatch;

  const handleOAuthError = (error: Error) => {
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
                <Text style={styles.stepTitle}>Step 3 of 4</Text>
                <Text style={styles.stepSubtitle}>
                  Create a secure password
                </Text>

                <View style={styles.inputContainer}>
                  <Input
                    ref={passwordInputRef}
                    icon={Lock}
                    rightIcon={showPassword ? EyeOff : Eye}
                    onRightIconPress={togglePasswordVisibility}
                    placeholder="Password"
                    value={registrationData.password}
                    onChangeText={(text) =>
                      updateRegistrationData({ password: text })
                    }
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                    onSubmitEditing={() =>
                      confirmPasswordInputRef.current?.focus()
                    }
                    delay={300}
                  />
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
                    onSubmitEditing={handleNext}
                    delay={350}
                  />
                </View>
                {!passwordsMatch &&
                  registrationData.confirmPassword.length > 0 && (
                    <Text style={styles.passwordMismatch}>
                      Passwords do not match
                    </Text>
                  )}

                <View style={styles.passwordRequirements}>
                  <Text style={styles.requirementsTitle}>
                    Password requirements:
                  </Text>
                  <Text
                    style={[
                      styles.requirement,
                      registrationData.password.length >= 8 &&
                        styles.requirementMet,
                    ]}
                  >
                    • At least 8 characters long
                  </Text>
                </View>

                <RegistrationStepLayout
                  onNext={handleNext}
                  onBack={handleBack}
                  canProceed={canProceed}
                  stepNumber={3}
                  totalSteps={4}
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
  inputContainer: {
    gap: 12,
    marginBottom: 16,
  },
  passwordRequirements: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: newColors.inputBackground,
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: newColors.cardTextSecondary,
    fontFamily: "Poppins-Regular",
    marginBottom: 8,
  },
  requirement: {
    fontSize: 12,
    color: newColors.cardTextSecondary,
    fontFamily: "Poppins-Regular",
  },
  requirementMet: {
    color: "#4CAF50",
  },
  passwordMismatch: {
    color: newColors.errorText,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    marginBottom: 8,
    textAlign: "center",
  },
});

export default RegistrationStep3;
