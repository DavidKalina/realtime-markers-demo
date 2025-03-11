import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { AlertTriangle, CheckCircle, Cog } from "lucide-react-native";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  BounceIn,
  BounceOut,
  cancelAnimation,
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

// Pre-defined animations for reuse
const SPRING_LAYOUT = Layout.springify();
const BOUNCE_IN = BounceIn.duration(300).springify();
const BOUNCE_OUT = BounceOut.duration(300);
const FADE_IN = FadeIn.duration(400).delay(100);

// Animation configurations
const ANIMATION_CONFIG = {
  rotationDuration: 2000,
  fadeOut: { duration: 200 },
  fadeIn: { duration: 300 },
  checkmarkScale: {
    duration: 400,
    easing: Easing.elastic(1),
  },
};

// Component for the progress bar
const ProgressBar = React.memo(({ percentage, color }: { percentage: number; color: string }) => (
  <View style={styles.progressBarContainer}>
    <Animated.View
      style={[styles.progressBar, { width: `${percentage}%`, backgroundColor: color }]}
      layout={SPRING_LAYOUT}
    />
  </View>
));

// Component for the rotating cog
const ProcessingIcon = React.memo(({ style }: { style: any }) => (
  <Animated.View style={style}>
    <Cog size={16} color="#fff" />
  </Animated.View>
));

// Component for the completion status icon
const StatusIcon = React.memo(({ style, status }: { style: any; status: string }) => (
  <Animated.View style={style}>
    {status === "completed" ? (
      <CheckCircle size={16} color="#fff" />
    ) : (
      <AlertTriangle size={16} color="#fff" />
    )}
  </Animated.View>
));

// Component for the job count text
const JobCountText = React.memo(({ count }: { count: number }) => (
  <Animated.Text style={styles.countText} entering={FADE_IN} layout={SPRING_LAYOUT}>
    {count} job{count !== 1 ? "s" : ""}
  </Animated.Text>
));

const QueueIndicator: React.FC<QueueIndicatorProps> = React.memo(
  ({
    position = "top-right",
    autoDismissDelay = 3000, // Default: auto-dismiss after 3 seconds
    sessionId,
  }) => {
    // Get jobs and clearAllJobs action from our store.
    const jobs = useJobSessionStore((state) => state.jobs);
    const clearAllJobs = useJobSessionStore((state) => state.clearAllJobs);
    const clearJobsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationCleanupRef = useRef(false);

    // Memoize derived values to prevent unnecessary recalculations
    const { activeJobs, completedJobs, failedJobs, totalJobs, activeJob, progressPercentage } =
      useMemo(() => {
        const activeJobs = jobs.filter(
          (job) => job.status === "pending" || job.status === "processing"
        );
        const completedJobs = jobs.filter((job) => job.status === "completed");
        const failedJobs = jobs.filter((job) => job.status === "failed");
        const totalJobs = jobs.length;

        const activeJob =
          activeJobs.length > 0
            ? activeJobs.reduce((prev, current) =>
                new Date(prev.updatedAt) > new Date(current.updatedAt) ? prev : current
              )
            : null;

        // Calculate progress percentage for active job
        const progressPercentage = activeJob ? activeJob.progress : 0;

        return { activeJobs, completedJobs, failedJobs, totalJobs, activeJob, progressPercentage };
      }, [jobs]);

    // State to track if component is visible
    const [isVisible, setIsVisible] = useState(false);

    // Determine the status to display
    const [status, setStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");

    // Animated values
    const rotationValue = useSharedValue(0);
    const checkmarkScale = useSharedValue(0);
    const iconOpacity = useSharedValue(1);

    // Setup visibility when there are jobs - runs only when totalJobs changes
    useEffect(() => {
      if (totalJobs > 0) {
        setIsVisible(true);
      }
    }, [totalJobs]);

    // Derive status from job data - memoize the new status to prevent unnecessary status updates
    const newStatus = useMemo(() => {
      if (failedJobs.length > 0) {
        return "failed";
      } else if (activeJobs.length > 0) {
        return "processing";
      } else if (completedJobs.length > 0 && activeJobs.length === 0) {
        return "completed";
      }
      return "idle";
    }, [activeJobs.length, completedJobs.length, failedJobs.length]);

    // Update status only when newStatus changes
    useEffect(() => {
      if (newStatus !== status) {
        setStatus(newStatus);
      }
    }, [newStatus, status]);

    // Auto-dismiss logic with useCallback to prevent unnecessary function recreations
    const handleAutoDismiss = useCallback(() => {
      if (activeJobs.length === 0 && (completedJobs.length > 0 || failedJobs.length > 0)) {
        // Clear any existing timeout first
        if (clearJobsTimeoutRef.current) {
          clearTimeout(clearJobsTimeoutRef.current);
          clearJobsTimeoutRef.current = null;
        }

        const timer = setTimeout(() => {
          setIsVisible(false);
          // Clear the jobs after the exit animation completes
          clearJobsTimeoutRef.current = setTimeout(() => {
            clearAllJobs();
          }, 300); // Allow time for exit animation
        }, autoDismissDelay);

        return () => {
          clearTimeout(timer);
          if (clearJobsTimeoutRef.current) {
            clearTimeout(clearJobsTimeoutRef.current);
            clearJobsTimeoutRef.current = null;
          }
        };
      }
      return undefined;
    }, [
      activeJobs.length,
      completedJobs.length,
      failedJobs.length,
      clearAllJobs,
      autoDismissDelay,
    ]);

    // Apply auto-dismiss effect
    useEffect(() => {
      const cleanup = handleAutoDismiss();
      return cleanup;
    }, [handleAutoDismiss]);

    // Handle animations based on status
    useEffect(() => {
      // Mark that we have animations running that need cleanup
      animationCleanupRef.current = true;

      if (status === "processing") {
        // Stop any ongoing animations first
        cancelAnimation(rotationValue);
        cancelAnimation(iconOpacity);
        cancelAnimation(checkmarkScale);

        // Start rotation animation for cog
        rotationValue.value = 0;
        iconOpacity.value = withTiming(1, ANIMATION_CONFIG.fadeIn);
        rotationValue.value = withRepeat(
          withTiming(1, {
            duration: ANIMATION_CONFIG.rotationDuration,
            easing: Easing.linear,
          }),
          -1, // Infinite repeats
          false
        );
        checkmarkScale.value = 0;
      } else if (status === "completed" || status === "failed") {
        // Stop rotation and transition to checkmark/error icon
        cancelAnimation(rotationValue);
        iconOpacity.value = withTiming(0, ANIMATION_CONFIG.fadeOut, () => {
          "worklet";
          checkmarkScale.value = withTiming(1, ANIMATION_CONFIG.checkmarkScale);
        });
      }

      return () => {
        // Only cancel animations if we've started them
        if (animationCleanupRef.current) {
          cancelAnimation(rotationValue);
          cancelAnimation(iconOpacity);
          cancelAnimation(checkmarkScale);
        }
      };
    }, [status]);

    // Add a cleanup effect for unmounting
    useEffect(() => {
      return () => {
        // Cancel all animations
        cancelAnimation(rotationValue);
        cancelAnimation(iconOpacity);
        cancelAnimation(checkmarkScale);

        // Clear any timeouts
        if (clearJobsTimeoutRef.current) {
          clearTimeout(clearJobsTimeoutRef.current);
          clearJobsTimeoutRef.current = null;
        }
      };
    }, []);

    // Memoize animated styles - these will only update when the shared values change
    const rotationAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotationValue.value * 360}deg` }],
      opacity: iconOpacity.value,
    }));

    const checkmarkAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: checkmarkScale.value }],
      opacity: checkmarkScale.value,
      position: "absolute",
    }));

    // Memoize position style - only recalculate when position prop changes
    const positionStyle = useMemo(() => {
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
    }, [position]);

    // Memoize status color - only recalculate when status changes
    const statusColor = useMemo(() => {
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
    }, [status]);

    // Memoize the indicator style
    const indicatorStyle = useMemo(
      () => [styles.indicator, { backgroundColor: statusColor }],
      [statusColor]
    );

    // If component is not visible or no jobs at all, don't render
    if (!isVisible || (totalJobs === 0 && status === "idle")) {
      return null;
    }

    return (
      <Animated.View
        style={[styles.container, positionStyle]}
        entering={BOUNCE_IN}
        exiting={BOUNCE_OUT}
        layout={SPRING_LAYOUT}
      >
        <Animated.View style={indicatorStyle} layout={SPRING_LAYOUT}>
          {/* Rotating cog for processing */}
          {status === "processing" && <ProcessingIcon style={rotationAnimatedStyle} />}

          {/* Checkmark or error icon that appears when complete */}
          {(status === "completed" || status === "failed") && (
            <StatusIcon style={checkmarkAnimatedStyle} status={status} />
          )}
        </Animated.View>

        <View style={styles.contentContainer}>
          {/* Progress bar - only render when processing */}
          {status === "processing" && (
            <ProgressBar percentage={progressPercentage} color={statusColor} />
          )}

          {/* Job count text - only render when there are jobs */}
          {totalJobs > 0 && <JobCountText count={totalJobs} />}
        </View>
      </Animated.View>
    );
  }
);

export default QueueIndicator;
