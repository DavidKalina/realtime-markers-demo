import React, { useEffect, useRef } from "react";
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
import { Mail } from "lucide-react-native";
import Input from "@/components/Input/Input";
import { useRegistration } from "@/contexts/RegistrationContext";
import { COLORS } from "../Layout/ScreenLayout";
import RegistrationStepLayout from "./RegistrationStepLayout";
import RegistrationCardLayout from "./RegistrationCardLayout";

const RegistrationStep2: React.FC = () => {
  const { registrationData, updateRegistrationData, setCurrentStep } =
    useRegistration();
  const emailInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleNext = () => {
    if (registrationData.email.trim()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const canProceed = Boolean(
    registrationData.email.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registrationData.email.trim()),
  );

  const handleOAuthError = (error: Error) => {
    // Handle OAuth errors - could show a toast or error message
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
                <Text style={styles.stepTitle}>Step 2 of 4</Text>
                <Text style={styles.stepSubtitle}>
                  Enter your email address
                </Text>

                <View style={styles.inputContainer}>
                  <Input
                    ref={emailInputRef}
                    icon={Mail}
                    placeholder="Email address"
                    value={registrationData.email}
                    onChangeText={(text) =>
                      updateRegistrationData({ email: text })
                    }
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="done"
                    onSubmitEditing={handleNext}
                    delay={300}
                  />
                </View>

                <RegistrationStepLayout
                  onNext={handleNext}
                  onBack={handleBack}
                  canProceed={canProceed}
                  stepNumber={2}
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
    marginBottom: 24,
  },
});

export default RegistrationStep2;
