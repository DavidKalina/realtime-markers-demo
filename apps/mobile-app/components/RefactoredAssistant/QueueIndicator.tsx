import { useJobQueueManager } from "@/hooks/useJobQueueManager";
import { useJobStreamEnhanced } from "@/hooks/useJobStream";
import { useJobQueueStore } from "@/stores/useJobQueueStore";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  BounceIn,
  BounceOut,
  Easing,
  FadeIn,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface QueueIndicatorProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
  autoDismissDelay?: number; // Time in ms to auto-dismiss after all jobs are complete/failed
}

const QueueIndicator: React.FC<QueueIndicatorProps> = ({
  position = "top-right",
  autoDismissDelay = 3000, // Default: auto-dismiss after 3 seconds
}) => {
  // Get job queue state from store
  const { jobIds, activeJobId, completedJobIds, failedJobIds } = useJobQueueStore();

  // Get the clearAllJobs function from the job queue manager
  const { clearAllJobs } = useJobQueueManager();

  // Use the job stream hook for the active job
  const { isComplete, error, currentStep, progressSteps } = useJobStreamEnhanced(activeJobId);

  // State to track if component is visible
  const [isVisible, setIsVisible] = useState(false);

  // Derive status for the indicator
  const hasActiveJobs = jobIds.length > 0;
  const hasCompletedJobs = completedJobIds.length > 0;
  const hasFailedJobs = failedJobIds.length > 0;

  // Count total jobs (in queue, completed, and failed)
  const totalJobs = jobIds.length + completedJobIds.length + failedJobIds.length;

  // Determine the status to display
  const [status, setStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");

  // Animated values
  const spinValue = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);
  const iconOpacity = useSharedValue(1);

  // Derived values
  const currentProgressText =
    activeJobId && progressSteps[currentStep] ? progressSteps[currentStep] : "Processing...";

  // Setup visibility
  useEffect(() => {
    if (totalJobs > 0) {
      setIsVisible(true);
    }
  }, [totalJobs]);

  // Update status based on job states
  useEffect(() => {
    if (error) {
      setStatus("failed");
    } else if (activeJobId && !isComplete) {
      setStatus("processing");
    } else if ((hasCompletedJobs || hasFailedJobs) && !hasActiveJobs) {
      setStatus(hasFailedJobs ? "failed" : "completed");
    } else if (hasActiveJobs) {
      setStatus("processing");
    } else {
      setStatus("idle");
    }
  }, [activeJobId, hasActiveJobs, hasCompletedJobs, hasFailedJobs, isComplete, error]);

  // Auto-dismiss timer when all active jobs are done
  useEffect(() => {
    // If there are no active jobs but there are completed/failed jobs
    if (jobIds.length === 0 && activeJobId === null && (hasCompletedJobs || hasFailedJobs)) {
      console.log("[QueueIndicator] No active jobs, starting auto-dismiss timer");

      const timer = setTimeout(() => {
        console.log("[QueueIndicator] Auto-dismissing indicator");
        setIsVisible(false);

        // Clear the jobs after the exit animation completes
        setTimeout(() => {
          clearAllJobs();
        }, 300); // Allow time for exit animation
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [jobIds.length, activeJobId, hasCompletedJobs, hasFailedJobs, clearAllJobs, autoDismissDelay]);

  // Handle animations based on status
  useEffect(() => {
    if (status === "processing") {
      // Start spinning animation
      spinValue.value = 0;
      iconOpacity.value = withTiming(1, { duration: 300 });
      spinValue.value = withRepeat(
        withTiming(1, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1, // Infinite repeats
        false
      );
      checkmarkScale.value = 0;
    } else if (status === "completed" || status === "failed") {
      // Stop spinning and transition to checkmark/error icon
      spinValue.value = withTiming(0, { duration: 200 });
      iconOpacity.value = withTiming(0, { duration: 200 }, () => {
        "worklet";
        checkmarkScale.value = withTiming(1, {
          duration: 400,
          easing: Easing.elastic(1),
        });
      });
    }
  }, [status, spinValue, iconOpacity, checkmarkScale]);

  // Create animated styles
  const spinAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinValue.value * 360}deg` }],
      opacity: iconOpacity.value,
    };
  });

  const checkmarkAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkmarkScale.value }],
      opacity: checkmarkScale.value,
      position: "absolute",
    };
  });

  // Get position styles
  const getPositionStyle = () => {
    switch (position) {
      case "top-right":
        return { top: 50, right: 16 };
      case "bottom-right":
        return { bottom: 50, right: 16 };
      case "bottom-left":
        return { bottom: 50, left: 16 };
      case "top-left":
        return { top: 50, left: 16 };
      case "custom":
        // No positioning here as it's handled by the parent container
        return {};
      default:
        return { top: 50, left: 16 };
    }
  };

  // Status-based styles
  const getStatusColor = () => {
    switch (status) {
      case "processing":
        return "#1098ad"; // Cyan
      case "completed":
        return "#4caf50"; // Green
      case "failed":
        return "#f44336"; // Red
      default:
        return "#868e96"; // Gray
    }
  };

  // If component is not visible or no jobs at all, don't render
  if (!isVisible || (totalJobs === 0 && status === "idle")) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, getPositionStyle()]}
      entering={BounceIn.duration(300).springify()}
      exiting={BounceOut.duration(300)}
      layout={Layout.springify()}
    >
      <Animated.View
        style={[styles.indicator, { backgroundColor: getStatusColor() }]}
        layout={Layout.springify()}
      >
        {/* Spinning loader or completion icon */}
        <Animated.View style={spinAnimatedStyle}>
          <Loader2 size={16} color="#fff" />
        </Animated.View>

        {/* Checkmark or error icon that appears when complete */}
        <Animated.View style={checkmarkAnimatedStyle}>
          {status === "completed" ? (
            <CheckCircle size={16} color="#fff" />
          ) : status === "failed" ? (
            <AlertTriangle size={16} color="#fff" />
          ) : null}
        </Animated.View>
      </Animated.View>

      <View style={styles.textContainer}>
        <Animated.Text
          style={styles.statusText}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
          layout={Layout.springify()}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {status === "processing"
            ? currentProgressText
            : status === "completed"
            ? "Complete"
            : status === "failed"
            ? "Failed"
            : "Idle"}
        </Animated.Text>

        {totalJobs > 0 && (
          <Animated.Text
            style={styles.countText}
            entering={FadeIn.duration(400).delay(100)}
            layout={Layout.springify()}
          >
            {totalJobs} job{totalJobs !== 1 ? "s" : ""} total
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    padding: 8,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxWidth: 300,
  },
  indicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  textContainer: {
    flexDirection: "column",
    flex: 1,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  countText: {
    color: "#e0e0e0",
    fontSize: 10,
    fontFamily: "SpaceMono",
  },
});

export default QueueIndicator;
