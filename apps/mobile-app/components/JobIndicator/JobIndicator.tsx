import React, { useEffect, useState, useRef, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSpring,
} from "react-native-reanimated";
import { Settings, CheckCircle2, AlertCircle } from "lucide-react-native";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { colors, spacing, fontFamily } from "@/theme";

// Max visible width for the label area before marquee kicks in
const LABEL_MAX_WIDTH = 120;
const MARQUEE_SPEED = 30; // px per second
const MARQUEE_START_PAUSE = 800;
const MARQUEE_END_PAUSE = 600;

// Shorten verbose backend labels for the compact indicator
function shortenLabel(raw: string): string {
  // Strip "AI Processing: " prefix → just the step name
  const stripped = raw.replace(/^AI Processing:\s*/i, "");

  // Map known long labels to shorter versions
  const SHORT: Record<string, string> = {
    "Validating request": "Validating",
    "Retrieving image": "Retrieving",
    "Uploading to storage": "Uploading",
    "Analyzing image": "Analyzing",
    "Processing details": "Processing",
    "Creating event": "Saving",
    "Processing image with AI": "Analyzing",
    "Extracting text from image": "Reading text",
    "Extracting event details": "Extracting",
    "Generating event embedding": "Embedding",
    "Checking for duplicate events": "Dedup check",
    "Detecting event type": "Detecting",
    "Processing events": "Processing",
    "Finding outdated events": "Querying",
    "Removing events": "Removing",
    "Sending notifications": "Notifying",
  };

  return SHORT[stripped] || SHORT[raw] || stripped;
}

// Simple marquee label that scrolls when text overflows
const MarqueeLabel = React.memo(
  ({ text, color }: { text: string; color: string }) => {
    const [textWidth, setTextWidth] = useState(0);
    const translateX = useSharedValue(0);
    const measured = useRef(false);

    const overflow =
      textWidth > 0 ? Math.max(0, textWidth - LABEL_MAX_WIDTH) : 0;
    const needsMarquee = overflow > 0;

    // Reset + scroll when text or measurement changes
    useEffect(() => {
      if (textWidth <= 0) return;
      cancelAnimation(translateX);
      translateX.value = 0;

      if (!needsMarquee) return;

      const scrollMs = (overflow / MARQUEE_SPEED) * 1000;

      const startTimer = setTimeout(() => {
        translateX.value = withTiming(-overflow, {
          duration: scrollMs,
          easing: Easing.linear,
        });
      }, MARQUEE_START_PAUSE);

      // After scroll completes, snap back and repeat
      const resetTimer = setTimeout(
        () => {
          translateX.value = 0;
        },
        MARQUEE_START_PAUSE + scrollMs + MARQUEE_END_PAUSE,
      );

      return () => {
        clearTimeout(startTimer);
        clearTimeout(resetTimer);
        cancelAnimation(translateX);
      };
    }, [text, textWidth, needsMarquee, overflow, translateX]);

    const marqueeStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    const onMeasure = useCallback(
      (e: { nativeEvent: { layout: { width: number } } }) => {
        const w = Math.ceil(e.nativeEvent.layout.width);
        if (!measured.current || Math.abs(w - textWidth) > 2) {
          measured.current = true;
          setTextWidth(w);
        }
      },
      [textWidth],
    );

    return (
      <View style={styles.marqueeClip}>
        {/* Off-screen measurement */}
        <Text style={styles.measureText} onLayout={onMeasure}>
          {text}
        </Text>

        <Animated.View style={marqueeStyle}>
          <Text
            style={[
              styles.label,
              { color },
              needsMarquee && { width: textWidth },
            ]}
            numberOfLines={1}
          >
            {text}
          </Text>
        </Animated.View>
      </View>
    );
  },
);

const JobIndicator: React.FC = () => {
  const { activeJobs } = useJobProgressContext();
  const rotation = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  // Partition jobs by status
  const inFlightJobs = activeJobs.filter(
    (j) => j.status === "pending" || j.status === "processing",
  );
  const completedJobs = activeJobs.filter((j) => j.status === "completed");
  const failedJobs = activeJobs.filter((j) => j.status === "failed");

  const totalJobs = activeJobs.length;
  const inFlightCount = inFlightJobs.length;
  const hasInFlight = inFlightCount > 0;

  // Determine aggregate status
  const isActive = hasInFlight;
  const isCompleted = !hasInFlight && completedJobs.length > 0;
  const isFailed =
    !hasInFlight && failedJobs.length > 0 && completedJobs.length === 0;
  const isVisible = totalJobs > 0;

  // Compute aggregate progress across all jobs
  const aggregateProgress =
    totalJobs > 0
      ? activeJobs.reduce((sum, j) => sum + (j.progress ?? 0), 0) / totalJobs
      : 0;

  // Pick display label: show the current step being worked on
  const displayLabel = (() => {
    if (inFlightCount > 0) {
      // Show the step label of the most recently active job
      const current = inFlightJobs[inFlightJobs.length - 1];
      return shortenLabel(current.stepLabel || "Processing");
    }
    if (isCompleted) return "Done";
    if (isFailed) return "Failed";
    return "Done";
  })();

  useEffect(() => {
    if (isActive) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
      );
    }
  }, [isActive, rotation]);

  useEffect(() => {
    progressWidth.value = withSpring(aggregateProgress, {
      damping: 20,
      stiffness: 300,
      mass: 1,
    });
  }, [aggregateProgress, progressWidth]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (!isVisible) return null;

  const accentColor = isFailed
    ? colors.status.error.text
    : isCompleted
      ? colors.status.success.text
      : colors.accent.primary;

  return (
    <Animated.View
      entering={FadeIn.springify()}
      exiting={FadeOut.springify()}
      style={styles.container}
    >
      <View style={styles.row}>
        {isActive ? (
          <Animated.View style={spinStyle}>
            <Settings size={12} color={accentColor} strokeWidth={2.5} />
          </Animated.View>
        ) : isCompleted ? (
          <CheckCircle2 size={12} color={accentColor} strokeWidth={2.5} />
        ) : (
          <AlertCircle size={12} color={accentColor} strokeWidth={2.5} />
        )}

        <MarqueeLabel text={displayLabel} color={accentColor} />
      </View>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressBar,
            progressBarStyle,
            { backgroundColor: accentColor },
          ]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 160,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  marqueeClip: {
    overflow: "hidden",
    maxWidth: LABEL_MAX_WIDTH,
    flexShrink: 1,
  },
  measureText: {
    position: "absolute",
    opacity: 0,
    top: -9999,
    fontSize: 11,
    fontFamily: fontFamily.mono,
  },
  label: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    opacity: 0.85,
  },
  progressTrack: {
    height: 1.5,
    backgroundColor: colors.border.subtle,
    borderRadius: 1,
    marginTop: 3,
  },
  progressBar: {
    height: 1.5,
    borderRadius: 1,
  },
});

export default React.memo(JobIndicator);
