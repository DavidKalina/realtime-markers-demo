import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Settings,
  ChevronRight,
  AlertCircle,
  X,
} from "lucide-react-native";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  CameraAnimateToLocationEvent,
  EventTypes,
} from "@/services/EventBroker";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { useJobSheetStore } from "@/stores/useJobSheetStore";
import { useColors, spacing, fontFamily, type Colors } from "@/theme";
import type { TrackedJob } from "@/hooks/useJobProgress";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const HANDLE_HEIGHT = 28;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 56;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.45;

function JobRow({
  job,
  onDismiss,
  onFlyTo,
  colors,
}: {
  job: TrackedJob;
  onDismiss: (jobId: string) => void;
  onFlyTo: (coordinates: [number, number]) => void;
  colors: Colors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rotation = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  const isInFlight =
    job.status === "pending" || job.status === "processing";
  const eventId =
    job.status === "completed"
      ? (job.result?.eventId as string) ?? (job.result?.id as string) ?? null
      : null;
  // Backend calls tracker.complete() even for rejected images (no event detected).
  // Treat completed-without-eventId as a rejection.
  const isCompleted = job.status === "completed" && !!eventId;
  const isRejected = job.status === "completed" && !eventId;
  const isFailed = job.status === "failed" || isRejected;

  useEffect(() => {
    if (isInFlight) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
      );
    }
  }, [isInFlight, rotation]);

  useEffect(() => {
    progressWidth.value = withTiming(job.progress ?? 0, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
  }, [job.progress, progressWidth]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const coordinates = isCompleted
    ? (job.result?.coordinates as [number, number] | undefined)
    : null;

  const handlePress = () => {
    if (isCompleted && coordinates) {
      onFlyTo(coordinates);
    }
  };

  const rejectionMessage = isRejected
    ? (job.result?.message as string) || "No event detected"
    : null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400)}
      exiting={FadeOutUp.duration(300)}
    >
      <Pressable
        style={styles.row}
        onPress={handlePress}
        disabled={!isCompleted || !coordinates}
      >
        {/* Left icon */}
        <View style={styles.rowLeft}>
          {isInFlight ? (
            <Reanimated.View style={spinStyle}>
              <Settings
                size={18}
                color={colors.accent.primary}
                strokeWidth={2.5}
              />
            </Reanimated.View>
          ) : isCompleted ? (
            <Text style={styles.emoji}>
              {job.extractions?.emoji || (job.result?.emoji as string) || "✅"}
            </Text>
          ) : (
            <AlertCircle
              size={18}
              color={colors.status.error.text}
              strokeWidth={2.5}
            />
          )}
        </View>

        {/* Center content */}
        <View style={styles.rowCenter}>
          {isInFlight ? (
            <>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {job.extractions?.title || job.stepLabel || "Processing"}
              </Text>
              <View style={styles.progressTrack}>
                <Reanimated.View
                  style={[
                    styles.progressBar,
                    progressBarStyle,
                    {
                      backgroundColor: colors.accent.primary,
                      shadowColor: colors.accent.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 4,
                    },
                  ]}
                />
              </View>
            </>
          ) : isCompleted ? (
            <Text style={styles.rowTitle} numberOfLines={1}>
              {job.extractions?.title ||
                (job.result?.title as string) ||
                "Completed"}
            </Text>
          ) : (
            <Text
              style={[styles.rowTitle, { color: colors.status.error.text }]}
              numberOfLines={2}
            >
              {rejectionMessage || job.error || "Processing failed"}
            </Text>
          )}
        </View>

        {/* Right action */}
        <View style={styles.rowRight}>
          {isInFlight ? (
            <Text style={styles.progressText}>
              {Math.round(job.progress ?? 0)}%
            </Text>
          ) : isCompleted && coordinates ? (
            <ChevronRight
              size={18}
              color={colors.text.secondary}
              strokeWidth={2}
            />
          ) : isFailed ? (
            <Pressable
              onPress={() => onDismiss(job.jobId)}
              hitSlop={8}
            >
              <X
                size={16}
                color={colors.text.secondary}
                strokeWidth={2}
              />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Reanimated.View>
  );
}

export function JobTrackerBottomSheet() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { publish } = useEventBroker();
  const translateY = useRef(new Animated.Value(MAX_SHEET_HEIGHT)).current;
  const { activeJobs, dismissJob } = useJobProgressContext();
  const { close } = useJobSheetStore();

  const jobCount = activeJobs.length;
  const inFlightCount = activeJobs.filter(
    (j) => j.status === "pending" || j.status === "processing",
  ).length;

  // Dynamic sheet height (at least 1 row height for empty state)
  const contentRows = Math.max(jobCount, 1);
  const sheetHeight = Math.min(
    HANDLE_HEIGHT + HEADER_HEIGHT + ROW_HEIGHT * contentRows + insets.bottom + 16,
    MAX_SHEET_HEIGHT,
  );

  // Slide in on mount
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [translateY]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: sheetHeight,
      duration: 250,
      useNativeDriver: true,
    }).start(() => close());
  };

  const handleFlyTo = (coordinates: [number, number]) => {
    dismiss();
    publish<CameraAnimateToLocationEvent>(
      EventTypes.CAMERA_ANIMATE_TO_LOCATION,
      {
        coordinates,
        timestamp: Date.now(),
        source: "job_tracker",
        zoomLevel: 16,
        allowZoomChange: true,
      },
    );
  };

  const handleDismissJob = (jobId: string) => {
    dismissJob(jobId);
    // Auto-close if this was the last job
    if (jobCount <= 1) {
      dismiss();
    }
  };

  // Swipe-down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || gesture.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    }),
  ).current;

  const headerText =
    jobCount === 0
      ? "Scan jobs"
      : inFlightCount > 0
        ? `Processing ${inFlightCount} job${inFlightCount !== 1 ? "s" : ""}`
        : `${jobCount} job${jobCount !== 1 ? "s" : ""}`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={dismiss} />

      <Animated.View
        style={[
          styles.sheet,
          { height: sheetHeight, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY }] },
        ]}
      >
        {/* Handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>{headerText}</Text>
        </View>

        {/* Job rows */}
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {jobCount === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateHint}>
                Go to the scan screen to submit a new job
              </Text>
            </View>
          ) : (
            activeJobs.map((job) => (
              <JobRow
                key={job.jobId}
                job={job}
                onDismiss={handleDismissJob}
                onFlyTo={handleFlyTo}
                colors={colors}
              />
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.3)",
    },
    sheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.bg.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 10,
    },
    handleArea: {
      alignItems: "center",
      paddingVertical: 12,
      height: HANDLE_HEIGHT,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.text.secondary,
    },
    header: {
      paddingHorizontal: spacing.md,
      height: HEADER_HEIGHT,
      justifyContent: "center",
    },
    headerText: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    scrollContent: {
      flex: 1,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      height: ROW_HEIGHT,
      paddingHorizontal: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.default,
    },
    rowLeft: {
      width: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    emoji: {
      fontSize: 20,
    },
    rowCenter: {
      flex: 1,
      marginHorizontal: spacing.sm,
      justifyContent: "center",
    },
    rowTitle: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    progressTrack: {
      height: 3,
      backgroundColor: colors.border.subtle,
      borderRadius: 1.5,
      marginTop: 4,
      overflow: "visible",
    },
    progressBar: {
      height: 3,
      borderRadius: 1.5,
    },
    rowRight: {
      width: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    progressText: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    emptyState: {
      height: ROW_HEIGHT,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.md,
    },
    emptyStateHint: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
  });
