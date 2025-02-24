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
}

export const DynamicProcessingView: React.FC<DynamicProcessingViewProps> = ({
  text = "Processing your document...",
  progressSteps = [
    "Analyzing document...",
    "Extracting information...",
    "Validating data...",
    "Finalizing...",
  ],
  currentStep = 0,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const colorProgress = useSharedValue(0);

  // Animation for the pulse effect
  useEffect(() => {
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
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
    };
  });

  const colorStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      colorProgress.value,
      [0, 0.5, 1],
      ["#69db7c", "#4dabf7", "#69db7c"]
    );

    return {
      backgroundColor,
    };
  });

  return (
    <View style={styles.processingContainer}>
      <Animated.View style={[styles.iconContainer, colorStyle]}>
        <Animated.View style={animatedStyle}>
          <Feather name="refresh-cw" size={32} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>

      <Text style={styles.processingTitle}>{text}</Text>

      <View style={styles.stepsContainer}>
        {progressSteps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View
              style={[
                styles.stepIndicator,
                index === currentStep
                  ? styles.currentStep
                  : index < currentStep
                  ? styles.completedStep
                  : {},
              ]}
            >
              {index < currentStep && <Feather name="check" size={14} color="#FFFFFF" />}
            </View>
            <Text
              style={[
                styles.stepText,
                index === currentStep
                  ? styles.currentStepText
                  : index < currentStep
                  ? styles.completedStepText
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
    textDecorationLine: "line-through",
  },
});
