import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { AlertTriangle, CheckCircle, Cog } from "lucide-react-native";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  SlideInLeft,
  SlideOutLeft,
} from "react-native-reanimated";

interface QueueIndicatorProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
  autoDismissDelay?: number; // Time in ms to auto-dismiss after all jobs are complete/failed
  sessionId?: string;
  initialDelay?: number; // Delay before initial render
}

// Pre-defined animations for reuse
const SPRING_LAYOUT = Layout.springify();
const SLIDE_IN = SlideInLeft.springify().damping(15).mass(0.8);
const SLIDE_OUT = SlideOutLeft.springify().damping(15).mass(0.8);
const FADE_IN = FadeIn.duration(400).delay(100);

// Animation configurations
const ANIMATION_CONFIG = {
  rotationDuration: 2000,
  fadeOut: { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) },
  fadeIn: { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) },
  checkmarkScale: {
    duration: 500,
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  },
  slide: {
    damping: 15,
    mass: 0.8,
    stiffness: 200,
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
    <Cog size={16} color="rgba(255, 255, 255, 0.7)" />
  </Animated.View>
));

// Component for the completion status icon
const StatusIcon = React.memo(({ style, status, checkmarkScale, floatValue }: { style: any; status: string; checkmarkScale: any; floatValue: any }) => (
  <Animated.View style={style}>
    {status === "completed" ? (
      <Animated.Text style={[styles.emojiText]}>
        ✅
      </Animated.Text>
    ) : (
      <AlertTriangle size={16} color="rgba(255, 255, 255, 0.9)" />
    )}
  </Animated.View>
));

// Component for the job count text
const JobCountText = React.memo(({ count, status }: { count: number; status: string }) => (
  <Animated.Text style={styles.countText} entering={FADE_IN} layout={SPRING_LAYOUT}>
    {status === "completed"
      ? "Scan Complete!"
      : status === "failed"
        ? "Scan Failed."
        : `${count} job${count !== 1 ? "s" : ""}`}
  </Animated.Text>
));

const QueueIndicator: React.FC<QueueIndicatorProps> = React.memo(
  ({
    position = "top-right",
    autoDismissDelay = 3000,
    sessionId,
    initialDelay = 800,
  }) => {
    // Get jobs and clearAllJobs action from our store.
    const jobs = useJobSessionStore((state) => state.jobs);
    const clearAllJobs = useJobSessionStore((state) => state.clearAllJobs);

    // Refs for cleanup
    const clearJobsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationCleanupRef = useRef(false);
    const initialRenderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMounted = useRef(true);
    const [shouldRender, setShouldRender] = useState(false);

    // Memoize derived values to prevent unnecessary recalculations
    const { activeJobs, completedJobs, failedJobs, totalJobs, activeJob, progressPercentage } =
      useMemo(() => {
        if (!isMounted.current) return {
          activeJobs: [],
          completedJobs: [],
          failedJobs: [],
          totalJobs: 0,
          activeJob: null,
          progressPercentage: 0
        };

        // Only process jobs that have changed
        const activeJobs = jobs.filter(
          (job) => job.status === "pending" || job.status === "processing"
        );
        const completedJobs = jobs.filter((job) => job.status === "completed");
        const failedJobs = jobs.filter((job) => job.status === "failed");
        const totalJobs = jobs.length;

        // Only find active job if there are active jobs
        const activeJob = activeJobs.length > 0
          ? activeJobs.reduce((prev, current) =>
            new Date(prev.updatedAt) > new Date(current.updatedAt) ? prev : current
          )
          : null;

        // Only calculate progress if there's an active job
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
    const floatValue = useSharedValue(0);

    // Handle delayed initial render
    useEffect(() => {
      if (!isMounted.current) return;

      if (totalJobs > 0) {
        // Clear any existing timeout
        if (initialRenderTimeoutRef.current) {
          clearTimeout(initialRenderTimeoutRef.current);
          initialRenderTimeoutRef.current = null;
        }

        // Set a timeout for initial render
        initialRenderTimeoutRef.current = setTimeout(() => {
          if (isMounted.current) {
            setShouldRender(true);
            setIsVisible(true);
          }
        }, initialDelay);

        return () => {
          if (initialRenderTimeoutRef.current) {
            clearTimeout(initialRenderTimeoutRef.current);
            initialRenderTimeoutRef.current = null;
          }
        };
      } else {
        setShouldRender(false);
        setIsVisible(false);
      }
    }, [totalJobs, initialDelay]);

    // Setup visibility when there are jobs
    useEffect(() => {
      if (!isMounted.current) return;
      if (totalJobs > 0) {
        setIsVisible(true);
      }
    }, [totalJobs]);

    // Derive status from job data with memoization
    const newStatus = useMemo(() => {
      if (!isMounted.current) return "idle";
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
      if (!isMounted.current) return;
      if (newStatus !== status) {
        setStatus(newStatus);
      }
    }, [newStatus, status]);

    // Auto-dismiss logic with optimized cleanup
    const handleAutoDismiss = useCallback(() => {
      if (!isMounted.current) return;

      if (activeJobs.length === 0 && (completedJobs.length > 0 || failedJobs.length > 0)) {
        // Clear any existing timeout first
        if (clearJobsTimeoutRef.current) {
          clearTimeout(clearJobsTimeoutRef.current);
          clearJobsTimeoutRef.current = null;
        }

        const timer = setTimeout(() => {
          if (!isMounted.current) return;
          setIsVisible(false);
          // Clear the jobs after the exit animation completes
          clearJobsTimeoutRef.current = setTimeout(() => {
            if (isMounted.current) {
              clearAllJobs();
            }
          }, 300);
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
    }, [activeJobs.length, completedJobs.length, failedJobs.length, clearAllJobs, autoDismissDelay]);

    // Apply auto-dismiss effect with cleanup
    useEffect(() => {
      const cleanup = handleAutoDismiss();
      return () => {
        if (cleanup) cleanup();
      };
    }, [handleAutoDismiss]);

    // Handle animations based on status
    useEffect(() => {
      if (!isMounted.current) return;
      animationCleanupRef.current = true;

      const cleanupAnimations = () => {
        try {
          cancelAnimation(rotationValue);
          cancelAnimation(iconOpacity);
          cancelAnimation(checkmarkScale);
          cancelAnimation(floatValue);
        } catch (error) {
          console.error('Error cleaning up animations:', error);
        }
      };

      // Only setup new animations if status actually changed
      if (status === "processing") {
        cleanupAnimations();
        try {
          rotationValue.value = 0;
          iconOpacity.value = withTiming(1, ANIMATION_CONFIG.fadeIn);
          rotationValue.value = withRepeat(
            withTiming(1, {
              duration: ANIMATION_CONFIG.rotationDuration,
              easing: Easing.linear,
            }),
            -1,
            false
          );
          checkmarkScale.value = 0;
          floatValue.value = 0;
        } catch (error) {
          console.error('Error setting up processing animation:', error);
        }
      } else if (status === "completed" || status === "failed") {
        // Only animate if we're transitioning from processing
        if (animationCleanupRef.current) {
          cleanupAnimations();
          try {
            iconOpacity.value = withTiming(0, ANIMATION_CONFIG.fadeOut, () => {
              "worklet";
              checkmarkScale.value = withSpring(1, {
                damping: 12,
                stiffness: 100,
                mass: 0.8,
              });

              if (status === "completed") {
                floatValue.value = withRepeat(
                  withTiming(1, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
                  -1,
                  true
                );
              }
            });
          } catch (error) {
            console.error('Error setting up completion animation:', error);
          }
        }
      }

      return () => {
        if (animationCleanupRef.current) {
          cleanupAnimations();
        }
      };
    }, [status]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        isMounted.current = false;

        // Cancel all animations
        try {
          cancelAnimation(rotationValue);
          cancelAnimation(iconOpacity);
          cancelAnimation(checkmarkScale);
          cancelAnimation(floatValue);
        } catch (error) {
          console.error('Error cleaning up animations on unmount:', error);
        }

        // Clear any timeouts
        if (clearJobsTimeoutRef.current) {
          clearTimeout(clearJobsTimeoutRef.current);
          clearJobsTimeoutRef.current = null;
        }
        if (initialRenderTimeoutRef.current) {
          clearTimeout(initialRenderTimeoutRef.current);
          initialRenderTimeoutRef.current = null;
        }
      };
    }, []);

    // Add cleanup for when component becomes invisible
    useEffect(() => {
      if (!isVisible && isMounted.current) {
        try {
          cancelAnimation(rotationValue);
          cancelAnimation(iconOpacity);
          cancelAnimation(checkmarkScale);
          cancelAnimation(floatValue);
        } catch (error) {
          console.error('Error cleaning up animations on visibility change:', error);
        }
      }
    }, [isVisible]);

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

    // Add new animated style for floating
    const floatAnimatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: checkmarkScale.value },
        {
          translateY: withSpring(floatValue.value * -4, {
            damping: 12,
            stiffness: 80,
            mass: 1,
          })
        }
      ],
    }));

    // Memoize position style - only recalculate when position prop changes
    const positionStyle = useMemo(() => {
      switch (position) {
        case "top-right":
          return { top: 150, left: 16 }; // Bottom position
        case "bottom-right":
          return { bottom: 50, right: 16 };
        case "bottom-left":
          return { bottom: 50, left: 16 };
        case "top-left":
          return { top: 150, left: 16 }; // Bottom position
        case "custom":
          return {};
        default:
          return { top: 150, left: 16 }; // Bottom position
      }
    }, [position]);

    // Memoize status color - only recalculate when status changes
    const statusColor = useMemo(() => {
      switch (status) {
        case "processing":
          return "rgba(255, 140, 0, 0.95)"; // Industrial orange
        case "completed":
          return "rgba(107, 114, 128, 0.95)"; // Subtle emerald
        case "failed":
          return "rgba(239, 68, 68, 0.95)"; // Subtle red
        default:
          return "rgba(107, 114, 128, 0.95)"; // Subtle gray
      }
    }, [status]);

    // Memoize the indicator style
    const indicatorStyle = useMemo(
      () => [styles.indicator, { backgroundColor: statusColor }],
      [statusColor]
    );

    // If component should not render yet or no jobs at all, don't render
    if (!shouldRender || !isVisible || (totalJobs === 0 && status === "idle")) {
      return null;
    }

    return (
      <Animated.View
        style={[styles.container, positionStyle]}
        entering={SLIDE_IN}
        exiting={SLIDE_OUT}
        layout={SPRING_LAYOUT}
      >
        <Animated.View style={indicatorStyle} layout={SPRING_LAYOUT}>
          {/* Rotating cog for processing */}
          {status === "processing" && <ProcessingIcon style={rotationAnimatedStyle} />}

          {/* Thumbs up or error icon that appears when complete */}
          {(status === "completed" || status === "failed") && (
            <StatusIcon
              style={[checkmarkAnimatedStyle, status === "completed" && floatAnimatedStyle]}
              status={status}
              checkmarkScale={checkmarkScale}
              floatValue={floatValue}
            />
          )}
        </Animated.View>

        <View style={styles.contentContainer}>
          {/* Progress bar - only render when processing */}
          {status === "processing" && (
            <ProgressBar percentage={progressPercentage} color={statusColor} />
          )}

          {/* Job count text - only render when there are jobs */}
          {totalJobs > 0 && <JobCountText count={totalJobs} status={status} />}
        </View>
      </Animated.View>
    );
  }
);

// Refined styles to match our card-like design language
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(51, 51, 51, 0.92)",
    borderRadius: 16,
    padding: 8,
    paddingRight: 10,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    maxWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'hidden',
  },
  contentContainer: {
    flexDirection: "column",
    flex: 1,
  },
  countText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 1,
    marginVertical: 3,
    width: "100%",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 1,
  },
  emojiText: {
    fontSize: 12,
    opacity: 1,
  },
});

export default QueueIndicator;
