import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { AlertTriangle, CheckCircle, Cog } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  BounceIn,
  BounceOut,
  Easing,
  FadeIn,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { styles } from "./styles";

interface QueueIndicatorProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
  autoDismissDelay?: number; // Time in ms to auto-dismiss after all jobs are complete/failed
  sessionId?: string;
}

const QueueIndicator: React.FC<QueueIndicatorProps> = ({
  position = "top-right",
  autoDismissDelay = 3000, // Default: auto-dismiss after 3 seconds
  sessionId,
}) => {
  // Get jobs and clearAllJobs action from our store.
  const jobs = useJobSessionStore((state) => state.jobs);
  const clearAllJobs = useJobSessionStore((state) => state.clearAllJobs);

  // Derive computed values from the jobs array.
  const activeJobs = jobs.filter((job) => job.status === "pending" || job.status === "processing");
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const totalJobs = jobs.length;
  const activeJob =
    activeJobs.length > 0
      ? activeJobs.reduce((prev, current) =>
          new Date(prev.updatedAt) > new Date(current.updatedAt) ? prev : current
        )
      : null;

  // State to track if component is visible
  const [isVisible, setIsVisible] = useState(false);

  // Determine the status to display
  const [status, setStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");

  // Animated values
  const rotationValue = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);
  const iconOpacity = useSharedValue(1);

  // Calculate progress percentage for active job
  const progressPercentage = activeJob ? activeJob.progress : 0;

  // Setup visibility when there are jobs
  useEffect(() => {
    if (totalJobs > 0) {
      setIsVisible(true);
    }
  }, [totalJobs]);

  // Update status based on job states
  useEffect(() => {
    if (failedJobs.length > 0) {
      setStatus("failed");
    } else if (activeJobs.length > 0) {
      setStatus("processing");
    } else if (completedJobs.length > 0 && activeJobs.length === 0) {
      setStatus("completed");
    } else {
      setStatus("idle");
    }
  }, [activeJobs, completedJobs, failedJobs]);

  // Auto-dismiss timer when all active jobs are done
  useEffect(() => {
    if (activeJobs.length === 0 && (completedJobs.length > 0 || failedJobs.length > 0)) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Clear the jobs after the exit animation completes
        setTimeout(() => {
          clearAllJobs();
        }, 300); // Allow time for exit animation
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [activeJobs, completedJobs, failedJobs, clearAllJobs, autoDismissDelay]);

  // Handle animations based on status
  useEffect(() => {
    if (status === "processing") {
      // Start rotation animation for cog
      rotationValue.value = 0;
      iconOpacity.value = withTiming(1, { duration: 300 });
      rotationValue.value = withRepeat(
        withTiming(1, {
          duration: 2000,
          easing: Easing.linear,
        }),
        -1, // Infinite repeats
        false
      );
      checkmarkScale.value = 0;
    } else if (status === "completed" || status === "failed") {
      // Stop rotation and transition to checkmark/error icon
      rotationValue.value = withTiming(rotationValue.value, { duration: 200 });
      iconOpacity.value = withTiming(0, { duration: 200 }, () => {
        "worklet";
        checkmarkScale.value = withTiming(1, {
          duration: 400,
          easing: Easing.elastic(1),
        });
      });
    }
  }, [status, rotationValue, iconOpacity, checkmarkScale]);

  // Create animated styles
  const rotationAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationValue.value * 360}deg` }],
    opacity: iconOpacity.value,
  }));

  const checkmarkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
    opacity: checkmarkScale.value,
    position: "absolute",
  }));

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
        return {};
      default:
        return { top: 50, left: 16 };
    }
  };

  // Get status-based color
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
        {/* Rotating cog for processing */}
        {status === "processing" && (
          <Animated.View style={rotationAnimatedStyle}>
            <Cog size={16} color="#fff" />
          </Animated.View>
        )}

        {/* Checkmark or error icon that appears when complete */}
        <Animated.View style={checkmarkAnimatedStyle}>
          {status === "completed" ? (
            <CheckCircle size={16} color="#fff" />
          ) : status === "failed" ? (
            <AlertTriangle size={16} color="#fff" />
          ) : null}
        </Animated.View>
      </Animated.View>

      <View style={styles.contentContainer}>
        {/* Progress bar */}
        {status === "processing" && (
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                { width: `${progressPercentage}%`, backgroundColor: getStatusColor() },
              ]}
              layout={Layout.springify()}
            />
          </View>
        )}

        {totalJobs > 0 && (
          <Animated.Text
            style={styles.countText}
            entering={FadeIn.duration(400).delay(100)}
            layout={Layout.springify()}
          >
            {totalJobs} job{totalJobs !== 1 ? "s" : ""}
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
};

export default QueueIndicator;
