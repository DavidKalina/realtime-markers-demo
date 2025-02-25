import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

interface DynamicProcessingViewProps {
  text?: string;
  progressSteps?: string[];
  currentStep?: number;
  isComplete?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

export const DynamicProcessingView: React.FC<DynamicProcessingViewProps> = ({
  text = "Processing your document...",
  progressSteps = [
    "Initializing job...",
    "Analyzing image...",
    "Processing data...",
    "Finalizing...",
  ],
  currentStep = 0,
  isComplete = false,
  hasError = false,
  errorMessage,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const colorProgress = useSharedValue(0);

  // Animation for the pulse effect
  useEffect(() => {
    // Only animate if not complete
    if (!isComplete && !hasError) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // infinite repeat
        true // reverse
      );

      // Continuous rotation
      rotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1 // infinite repeat
      );

      // Color animation
      colorProgress.value = withRepeat(
        withTiming(1, { duration: 2000 }),
        -1, // infinite repeat
        true // reverse
      );
    } else {
      // Stop animations when complete
      scale.value = withTiming(1);
      rotation.value = withTiming(0);
      colorProgress.value = withTiming(hasError ? 0.75 : 0.25);
    }
  }, [isComplete, hasError]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
    };
  });

  const colorStyle = useAnimatedStyle(() => {
    // Different color transitions based on status
    const backgroundColor = hasError
      ? interpolateColor(
          colorProgress.value,
          [0, 1],
          ["#ff6b6b", "#e03131"] // Error colors
        )
      : isComplete
      ? interpolateColor(
          colorProgress.value,
          [0, 1],
          ["#40c057", "#2b8a3e"] // Success colors
        )
      : interpolateColor(
          colorProgress.value,
          [0, 0.5, 1],
          ["#69db7c", "#4dabf7", "#69db7c"] // Processing colors
        );

    return {
      backgroundColor,
    };
  });

  return (
    <View style={styles.processingContainer}>
      <Animated.View style={[styles.iconContainer, colorStyle]}>
        <Animated.View style={animatedStyle}>
          {hasError ? (
            <Feather name="x" size={32} color="#FFFFFF" />
          ) : isComplete ? (
            <Feather name="check" size={32} color="#FFFFFF" />
          ) : (
            <Feather name="refresh-cw" size={32} color="#FFFFFF" />
          )}
        </Animated.View>
      </Animated.View>

      <Text style={styles.processingTitle}>
        {hasError ? "Processing Error" : isComplete ? "Processing Complete" : text}
      </Text>

      {hasError && errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <View style={styles.stepsContainer}>
        {progressSteps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View
              style={[
                styles.stepIndicator,
                index === currentStep && !isComplete && !hasError
                  ? styles.currentStep
                  : index < currentStep || (isComplete && index <= currentStep)
                  ? styles.completedStep
                  : hasError && index === currentStep
                  ? styles.errorStep
                  : {},
              ]}
            >
              {index < currentStep || (isComplete && index <= currentStep) ? (
                <Feather name="check" size={14} color="#FFFFFF" />
              ) : hasError && index === currentStep ? (
                <Feather name="x" size={14} color="#FFFFFF" />
              ) : null}
            </View>
            <Text
              style={[
                styles.stepText,
                index === currentStep && !isComplete && !hasError
                  ? styles.currentStepText
                  : index < currentStep || (isComplete && index <= currentStep)
                  ? styles.completedStepText
                  : hasError && index === currentStep
                  ? styles.errorStepText
                  : {},
              ]}
            >
              {step}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  processingContainer: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    elevation: 8,
    shadowColor: "#69db7c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  processingTitle: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 32,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    width: "100%",
    maxWidth: 300,
  },
  errorText: {
    color: "#ff8787",
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  stepsContainer: {
    width: "100%",
    maxWidth: 300,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#555",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#777",
  },
  currentStep: {
    backgroundColor: "#69db7c",
    borderColor: "#2f9e44",
  },
  completedStep: {
    backgroundColor: "#2f9e44",
    borderColor: "#2b8a3e",
  },
  errorStep: {
    backgroundColor: "#ff6b6b",
    borderColor: "#e03131",
  },
  stepText: {
    color: "#aaa",
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  currentStepText: {
    color: "#69db7c",
    fontWeight: "600",
  },
  completedStepText: {
    color: "#fff",
  },
  errorStepText: {
    color: "#ff8787",
    fontWeight: "600",
  },
});
