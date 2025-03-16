import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { CheckCircle, Cog, AlertTriangle } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { View, Text } from "react-native";
import Animated, {
  BounceIn,
  BounceOut,
  FadeIn,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { styles } from "./styles";

interface QueueIndicatorProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
}

const SimplifiedQueueIndicator: React.FC<QueueIndicatorProps> = ({ position = "top-right" }) => {
  // Get jobs from the store
  const jobs = useJobSessionStore((state) => state.jobs);
  const clearAllJobs = useJobSessionStore((state) => state.clearAllJobs);

  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rotation animation for the cog
  const rotation = useSharedValue(0);

  // Create the rotating animation style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Simplify our logic - just do the direct calculations
  const hasJobs = jobs.length > 0;
  const mostRecentJob = hasJobs
    ? [...jobs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
    : null;

  // Direct data extraction
  const isProcessing =
    mostRecentJob?.status === "processing" || mostRecentJob?.status === "pending";
  const isFailed = mostRecentJob?.status === "failed";
  const isCompleted = mostRecentJob?.status === "completed";

  // Extract data from the job
  const progressValue = mostRecentJob?.progress || 0;
  const richUI = mostRecentJob?.richUI;
  const color = richUI?.color || (isProcessing ? "#1098ad" : isCompleted ? "#4caf50" : "#f44336");
  const iconType = richUI?.icon || "";

  // Get the display title - prefer richUI title, fall back to progressStep
  const displayTitle = richUI?.title || mostRecentJob?.progressStep || "Processing";

  // Start rotation animation when processing and handle auto-dismiss
  useEffect(() => {
    if (isProcessing) {
      // Start the continuous rotation animation
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 2000,
          easing: Easing.linear,
        }),
        -1, // Infinite repetitions
        false // No reverse
      );
    } else if ((isCompleted || isFailed) && !isProcessing) {
      // Stop the rotation animation
      rotation.value = withTiming(0, { duration: 300 });

      // Set up auto-dismiss
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }

      cleanupTimeoutRef.current = setTimeout(() => {
        clearAllJobs();
      }, 5000); // Shorter timeout for simplified version
    }

    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [isCompleted, isFailed, isProcessing, clearAllJobs, rotation]);

  // If no jobs, don't render
  if (!hasJobs) {
    return null;
  }

  // Determine position style
  let positionStyle;
  switch (position) {
    case "top-right":
      positionStyle = { top: 50, right: 16 };
      break;
    case "bottom-right":
      positionStyle = { bottom: 50, right: 16 };
      break;
    case "bottom-left":
      positionStyle = { bottom: 50, left: 16 };
      break;
    case "top-left":
      positionStyle = { top: 50, left: 16 };
      break;
    default:
      positionStyle = { top: 50, right: 16 };
  }

  // Simplified icon logic - just cog, success or error
  const getIconComponent = () => {
    if (isCompleted) {
      return <CheckCircle size={16} color="#fff" />;
    }
    if (isFailed) {
      return <AlertTriangle size={16} color="#fff" />;
    }

    // Default to rotating cog for processing
    return (
      <Animated.View style={animatedStyle}>
        <Cog size={16} color="#fff" />
      </Animated.View>
    );
  };

  return (
    <Animated.View
      style={[styles.container, positionStyle]}
      entering={BounceIn.duration(300)}
      exiting={BounceOut.duration(300)}
      layout={Layout.springify()}
    >
      <View style={[styles.indicator, { backgroundColor: color }]}>{getIconComponent()}</View>

      <View style={styles.contentContainer}>
        {/* Title text */}
        <Animated.Text
          style={styles.statusText}
          numberOfLines={1}
          ellipsizeMode="tail"
          entering={FadeIn.duration(400)}
        >
          {displayTitle}
        </Animated.Text>

        {/* Job count */}
        <Text style={styles.countText}>
          {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </Text>
      </View>
    </Animated.View>
  );
};

export default SimplifiedQueueIndicator;
