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
  cancelAnimation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

interface ImprovedProcessingViewProps {
  text?: string;
  progressSteps?: string[];
  currentStep?: number;
  isComplete?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  imageUri?: string | null;
  isCaptureState?: boolean;
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
  imageUri = null,
  isCaptureState = false,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const colorProgress = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  // Continuous animation setup to ensure it keeps running
  useEffect(() => {
    // Continue animation unless complete or has error
    if (!isComplete && !hasError) {
      // Start continuous rotation animation that won't stop
      rotation.value = 0; // Reset first to ensure clean restart
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 3000,
          easing: Easing.linear,
        }),
        -1 // infinite repeat
      );

      // More subtle scale animation
      scale.value = 1; // Reset first
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, {
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1, // infinite repeat
        true // reverse
      );

      // Subtle color animation
      colorProgress.value = 0; // Reset first
      colorProgress.value = withRepeat(
        withTiming(1, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1, // infinite repeat
        true // reverse
      );

      // Progress bar animation
      progressWidth.value = 0; // Reset first
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

    // Cleanup function to ensure proper animation teardown
    return () => {
      // This helps prevent animation leaks when component updates
      cancelAnimation(rotation);
      cancelAnimation(scale);
      cancelAnimation(colorProgress);
      cancelAnimation(progressWidth);
    };
  }, [isComplete, hasError]);

  // Separate effect for progress bar when step changes
  useEffect(() => {
    // Only update progress when active (not complete/error)
    if (!isComplete && !hasError) {
      progressWidth.value = 0;
      progressWidth.value = withTiming(100, {
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [currentStep, isComplete, hasError]);

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
    // More subtle color transitions
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
          ["#4dabf7", "#4c6ef5", "#4dabf7"] // More subtle processing colors
        );

    return {
      backgroundColor,
    };
  });

  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
      backgroundColor: hasError ? "#ff6b6b" : isComplete ? "#40c057" : "#4dabf7",
    };
  });

  // Function to render appropriate icon for status
  const renderStatusIcon = () => {
    if (isCaptureState) {
      return <Feather name="camera" size={28} color="#FFFFFF" />;
    } else if (hasError) {
      return <Feather name="x" size={28} color="#FFFFFF" />;
    } else if (isComplete) {
      return <Feather name="check" size={28} color="#FFFFFF" />;
    } else {
      return <Feather name="refresh-cw" size={28} color="#FFFFFF" />;
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

  // Render step indicators
  const renderStepIndicators = () => {
    return (
      <View style={styles.stepsIndicatorContainer}>
        {progressSteps.map((_, index) => (
          <View
            key={`indicator-${index}`}
            style={[
              styles.stepDot,
              {
                backgroundColor:
                  index < currentStep
                    ? "#40c057" // Completed
                    : index === currentStep
                    ? "#4dabf7" // Current
                    : "#555", // Upcoming
              },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.processingContainer}>
      {/* Icon container - smaller size */}
      <Animated.View style={[styles.iconContainer, colorStyle]}>
        <Animated.View style={animatedStyle}>{renderStatusIcon()}</Animated.View>
      </Animated.View>

      {/* Smaller title text - fixed height to prevent layout shifts */}
      <View style={styles.titleContainer}>
        <Text style={styles.processingTitle}>{getStatusText()}</Text>
      </View>

      {/* Step indicators row */}
      {renderStepIndicators()}

      <View style={styles.stepsContainer}>
        {/* Fixed height step display to prevent layout shifts */}
        <View style={styles.stepDisplayContainer}>
          {/* Current Step Indicator - with fade transition */}
          <Animated.View
            style={styles.stepTextContainer}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            key={`step-${currentStep}`}
          >
            <Text style={styles.currentStepText}>{progressSteps[currentStep]}</Text>
          </Animated.View>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBar, progressBarStyle]} />
          </View>

          {/* Step Progress Indicator - smaller, fixed position */}
          <View style={styles.stepCounterContainer}>
            <Text style={styles.stepIndicator}>
              Step {currentStep + 1} of {progressSteps.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Status message container with fixed height */}
      <View style={styles.statusContainer}>
        {/* Error Message */}
        {hasError && errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Success Message */}
        {isComplete && !hasError && (
          <View style={styles.successContainer}>
            <Feather name="check-circle" size={16} color="#40c057" style={styles.successIcon} />
            <Text style={styles.successText}>Successfully completed all steps!</Text>
          </View>
        )}
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
    width: 64, // Smaller icon container
    height: 64, // Smaller icon container
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 5,
    shadowColor: "#4dabf7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    zIndex: 10,
  },
  titleContainer: {
    height: 26, // Fixed height to prevent layout shifts
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  processingTitle: {
    fontSize: 18, // Smaller title
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  stepsIndicatorContainer: {
    height: 16, // Fixed height
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  stepsContainer: {
    width: "100%",
    maxWidth: 280, // Smaller container
    alignItems: "center",
    justifyContent: "center",
  },
  stepDisplayContainer: {
    height: 110, // Fixed height container to prevent layout shifts
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  stepTextContainer: {
    height: 24, // Fixed height for step text
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
  },
  currentStepText: {
    color: "#4dabf7", // More subtle blue color
    fontSize: 16, // Smaller text
    fontFamily: "SpaceMono",
    textAlign: "center",
    fontWeight: "500", // Less bold
  },
  progressBarContainer: {
    width: "100%",
    height: 6, // Thinner progress bar
    backgroundColor: "#444",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  stepCounterContainer: {
    height: 20, // Fixed height for step counter
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  stepIndicator: {
    color: "#aaa",
    fontSize: 12, // Smaller text
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  statusContainer: {
    height: 80, // Fixed height for status messages
    width: "100%",
    maxWidth: 280,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    backgroundColor: "rgba(255, 107, 107, 0.15)", // More subtle background
    borderRadius: 6,
    padding: 12,
    width: "100%",
  },
  errorText: {
    color: "#ff8787",
    fontFamily: "SpaceMono",
    textAlign: "center",
    fontSize: 13, // Smaller text
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(64, 192, 87, 0.1)", // More subtle background
    borderRadius: 6,
    padding: 12,
    width: "100%",
  },
  successIcon: {
    marginRight: 6,
  },
  successText: {
    color: "#40c057",
    fontFamily: "SpaceMono",
    textAlign: "center",
    fontSize: 13, // Smaller text
  },
});
