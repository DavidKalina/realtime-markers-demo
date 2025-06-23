import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useRegistration } from "@/contexts/RegistrationContext";

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

interface RegistrationStepLayoutProps {
  onNext: () => void;
  onBack?: () => void;
  canProceed: boolean;
  stepNumber: number;
  totalSteps: number;
  isLoading?: boolean;
  nextButtonText?: string;
}

const RegistrationStepLayout: React.FC<RegistrationStepLayoutProps> = ({
  onNext,
  onBack,
  canProceed,
  stepNumber,
  totalSteps,
  isLoading = false,
  nextButtonText = "Next",
}) => {
  const { setCurrentStep } = useRegistration();
  const buttonScale = useSharedValue(1);

  const handleNext = () => {
    if (!canProceed || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    setTimeout(() => {
      onNext();
    }, 150);
  };

  const handleBack = () => {
    if (isLoading) return;

    Haptics.selectionAsync();
    if (onBack) {
      onBack();
    } else if (stepNumber > 1) {
      setCurrentStep(stepNumber - 1);
    }
  };

  const renderProgressDots = () => {
    const dots = [];
    for (let i = 1; i <= totalSteps; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.progressDot,
            i <= stepNumber
              ? styles.progressDotActive
              : styles.progressDotInactive,
          ]}
        />,
      );
    }
    return dots;
  };

  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Step {stepNumber} of {totalSteps}
        </Text>
        <View style={styles.progressDots}>{renderProgressDots()}</View>
      </View>

      {/* Navigation buttons */}
      <View style={styles.buttonRow}>
        {(onBack || stepNumber > 1) && (
          <TouchableOpacity
            onPress={handleBack}
            disabled={isLoading}
            style={[styles.button, styles.backButton]}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={newColors.buttonText} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleNext}
          disabled={!canProceed || isLoading}
          activeOpacity={0.7}
          style={[
            styles.button,
            styles.nextButton,
            !canProceed && styles.nextButtonDisabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={newColors.cardText} />
          ) : (
            <>
              <Text style={styles.nextButtonText}>{nextButtonText}</Text>
              <ChevronRight size={20} color={newColors.cardText} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  progressContainer: {
    alignItems: "center",
    gap: 8,
  },
  progressText: {
    fontSize: 12,
    color: newColors.cardTextSecondary,
    fontFamily: "Poppins-Regular",
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    backgroundColor: newColors.accent,
  },
  progressDotInactive: {
    backgroundColor: newColors.divider,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    height: 55,
    borderWidth: 1,
  },
  backButton: {
    backgroundColor: "#fff",
    borderColor: newColors.buttonBorder,
  },
  backButtonText: {
    fontSize: 14,
    color: newColors.buttonText,
    fontFamily: "Poppins-Regular",
    fontWeight: "500",
  },
  nextButton: {
    backgroundColor: newColors.accent,
    borderColor: newColors.accent,
  },
  nextButtonDisabled: {
    backgroundColor: newColors.divider,
    borderColor: newColors.divider,
  },
  nextButtonText: {
    fontSize: 16,
    color: newColors.cardText,
    fontFamily: "Poppins-Regular",
    fontWeight: "600",
  },
});

export default RegistrationStepLayout;
