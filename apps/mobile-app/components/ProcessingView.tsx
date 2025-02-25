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
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

interface ImprovedProcessingViewProps {
  text?: string;
  progressSteps?: string[];
  currentStep?: number;
  isComplete?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

export const ImprovedProcessingView: React.FC<ImprovedProcessingViewProps> = ({
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
  const progressWidth = useSharedValue(0);

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

      // Progress bar animation
      progressWidth.value = withTiming(100, {
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
      });
    } else {
      // Stop animations when complete
      scale.value = withTiming(1);
      rotation.value = withTiming(0);
      colorProgress.value = withTiming(hasError ? 0.75 : 0.25);
      progressWidth.value = withTiming(100);
    }
  }, [isComplete, hasError, currentStep]);

  // Reset and animate progress when step changes
  useEffect(() => {
    if (!isComplete && !hasError) {
      progressWidth.value = 0;
      progressWidth.value = withTiming(100, {
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [currentStep]);

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

  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
      backgroundColor: hasError ? "#ff6b6b" : isComplete ? "#40c057" : "#69db7c",
    };
  });

  // Function to render appropriate icon for status
  const renderStatusIcon = () => {
    if (hasError) {
      return <Feather name="x" size={32} color="#FFFFFF" />;
    } else if (isComplete) {
      return <Feather name="check" size={32} color="#FFFFFF" />;
    } else {
      return <Feather name="refresh-cw" size={32} color="#FFFFFF" />;
    }
  };

  // Function to render status text
  const getStatusText = () => {
    if (hasError) {
      return "Processing Error";
    } else if (isComplete) {
      return "Processing Complete";
    } else {
      return text;
    }
  };

  return (
    <View style={styles.processingContainer}>
      <Animated.View style={[styles.iconContainer, colorStyle]}>
        <Animated.View style={animatedStyle}>{renderStatusIcon()}</Animated.View>
      </Animated.View>

      <Text style={styles.processingTitle}>{getStatusText()}</Text>

      <View style={styles.stepsContainer}>
        {/* Current Step Indicator */}
        <Animated.View
          entering={FadeIn.duration(500)}
          exiting={FadeOut.duration(300)}
          key={`step-${currentStep}`}
        >
          <Text style={styles.currentStepText}>{progressSteps[currentStep]}</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBar, progressBarStyle]} />
          </View>

          {/* Step Progress Indicator */}
          <Text style={styles.stepIndicator}>
            Step {currentStep + 1} of {progressSteps.length}
          </Text>
        </Animated.View>
      </View>

      {/* Error Message */}
      {hasError && errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Success Message */}
      {isComplete && !hasError && (
        <View style={styles.successContainer}>
          <Feather name="check-circle" size={20} color="#40c057" style={styles.successIcon} />
          <Text style={styles.successText}>Successfully completed all steps!</Text>
        </View>
      )}
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
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 40,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  stepsContainer: {
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  currentStepText: {
    color: "#69db7c",
    fontSize: 18,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "600",
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#444",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  stepIndicator: {
    color: "#aaa",
    fontSize: 14,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
    width: "100%",
    maxWidth: 300,
  },
  errorText: {
    color: "#ff8787",
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(64, 192, 87, 0.15)",
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
    width: "100%",
    maxWidth: 300,
  },
  successIcon: {
    marginRight: 8,
  },
  successText: {
    color: "#40c057",
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
});
