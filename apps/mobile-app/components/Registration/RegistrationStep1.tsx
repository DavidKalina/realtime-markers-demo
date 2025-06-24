import Input from "@/components/Input/Input";
import { useRegistration } from "@/contexts/RegistrationContext";
import React, { useEffect, useRef } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import RegistrationCardLayout from "./RegistrationCardLayout";
import RegistrationStepLayout from "./RegistrationStepLayout";

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

const RegistrationStep1: React.FC = () => {
  const { registrationData, updateRegistrationData, setCurrentStep } =
    useRegistration();
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
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
      firstNameInputRef.current?.focus();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleNext = () => {
    if (registrationData.firstName.trim() && registrationData.lastName.trim()) {
      setCurrentStep(2);
    }
  };

  const handleOAuthError = (error: Error) => {
    // Handle OAuth errors - could show a toast or error message
    console.error("OAuth error:", error);
  };

  const canProceed = Boolean(
    registrationData.firstName.trim() && registrationData.lastName.trim(),
  );

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
                <Text style={styles.stepTitle}>Step 1 of 4</Text>
                <Text style={styles.stepSubtitle}>Tell us about yourself</Text>

                <View style={styles.inputRow}>
                  <Input
                    ref={firstNameInputRef}
                    placeholder="First name"
                    value={registrationData.firstName}
                    onChangeText={(text) =>
                      updateRegistrationData({ firstName: text })
                    }
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameInputRef.current?.focus()}
                    delay={300}
                    style={styles.inputHalf}
                  />
                  <Input
                    ref={lastNameInputRef}
                    placeholder="Last name"
                    value={registrationData.lastName}
                    onChangeText={(text) =>
                      updateRegistrationData({ lastName: text })
                    }
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleNext}
                    delay={400}
                    style={styles.inputHalf}
                  />
                </View>

                <RegistrationStepLayout
                  onNext={handleNext}
                  canProceed={canProceed}
                  stepNumber={1}
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
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  inputHalf: {
    flex: 1,
  },
});

export default RegistrationStep1;
