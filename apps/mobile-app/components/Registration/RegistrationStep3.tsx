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
} from "react-native-reanimated";
import { Lock, Eye, EyeOff } from "lucide-react-native";
import Input from "@/components/Input/Input";
import { useRegistration } from "@/contexts/RegistrationContext";
import { COLORS } from "../Layout/ScreenLayout";
import RegistrationStepLayout from "./RegistrationStepLayout";
import * as Haptics from "expo-haptics";
import RegistrationCardLayout from "./RegistrationCardLayout";

const RegistrationStep3: React.FC = () => {
  const { registrationData, updateRegistrationData, setCurrentStep } =
    useRegistration();
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
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
        backgroundColor={COLORS.background}
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
            <Text style={styles.slogan}>Discover Events</Text>

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
    backgroundColor: COLORS.background,
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
  slogan: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
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
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.divider,
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
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
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
    backgroundColor: COLORS.cardBackgroundAlt,
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  requirement: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  requirementMet: {
    color: "#4CAF50",
  },
  passwordMismatch: {
    color: COLORS.errorText,
    fontSize: 13,
    fontFamily: "SpaceMono",
    marginBottom: 8,
    textAlign: "center",
  },
});

export default RegistrationStep3;
