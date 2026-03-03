import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  Pressable,
  Dimensions,
} from "react-native";
import RAnimated, {
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.28;
const SNAP_OPEN = 0;
const SNAP_DISMISSED = SHEET_HEIGHT;

const AUTO_DISMISS_DELAY = 3000;
const EMOJI_CIRCLE_SIZE = 80;
const DIALOG_HEIGHT = 44;
const SHEEN_WIDTH = 100;

interface ScanProgressSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

// --- Shimmer wrapper for skeleton loaders ---

const SHIMMER_WIDTH = 80;

function useShimmer() {
  const pos = useSharedValue(0);
  useEffect(() => {
    pos.value = 0;
    pos.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  return pos;
}

const ShimmerPlaceholder = React.memo(
  ({ style, children }: { style: object; children?: React.ReactNode }) => {
    const shimmerPos = useShimmer();
    const [width, setWidth] = useState(0);

    const shimmerStyle = useAnimatedStyle(() => {
      if (width === 0) return { opacity: 0 };
      const tx = interpolate(
        shimmerPos.value,
        [0, 1],
        [-SHIMMER_WIDTH, width + SHIMMER_WIDTH],
      );
      return { opacity: 0.45, transform: [{ translateX: tx }] };
    });

    const handleLayout = useCallback(
      (e: { nativeEvent: { layout: { width: number } } }) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setWidth(w);
      },
      [],
    );

    return (
      <View style={[style, { overflow: "hidden" }]} onLayout={handleLayout}>
        {children}
        {width > 0 && (
          <RAnimated.View
            style={[styles.shimmerBeam, shimmerStyle]}
            pointerEvents="none"
          >
            <Svg width={SHIMMER_WIDTH} height={40}>
              <Defs>
                <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="#fff" stopOpacity="0.15" />
                  <Stop offset="1" stopColor="#fff" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={SHIMMER_WIDTH}
                height={40}
                fill="url(#shimmer)"
              />
            </Svg>
          </RAnimated.View>
        )}
      </View>
    );
  },
);

// --- Placeholder line ---

const PlaceholderLine = React.memo(({ width }: { width: number | string }) => (
  <ShimmerPlaceholder
    style={[
      styles.placeholderLine,
      typeof width === "number" ? { width } : { width },
    ]}
  />
));

// --- Tag pill ---

const TagPill = React.memo(({ label }: { label: string }) => (
  <RAnimated.View entering={FadeIn.duration(250)} style={styles.tagPill}>
    <Text style={styles.tagText} numberOfLines={1}>
      {label}
    </Text>
  </RAnimated.View>
));

const PlaceholderPill = React.memo(() => (
  <ShimmerPlaceholder style={styles.placeholderPill} />
));

// --- DialogBox-inspired status bar ---

const ScanStatusDialog = React.memo(
  ({
    stepLabel,
    isCompleted,
    isFailed,
    resultMessage,
    error,
  }: {
    stepLabel: string;
    isCompleted: boolean;
    isFailed: boolean;
    resultMessage: string;
    error?: string;
  }) => {
    const sheenPos = useSharedValue(0);
    const sheenActive = useSharedValue(0);
    const [dialogWidth, setDialogWidth] = useState(0);
    const isTerminal = isCompleted || isFailed;

    useEffect(() => {
      if (!isTerminal) {
        // Repeat golden sheen while processing
        sheenActive.value = 1;
        cancelAnimation(sheenPos);
        sheenPos.value = 0;
        sheenPos.value = withRepeat(
          withTiming(1, {
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true,
        );
      } else if (isCompleted && dialogWidth > 0) {
        // Final sweep on completion
        cancelAnimation(sheenPos);
        sheenActive.value = 1;
        sheenPos.value = withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(
            1,
            { duration: 600, easing: Easing.inOut(Easing.ease) },
            (finished) => {
              if (finished) sheenActive.value = 0;
            },
          ),
        );
      } else {
        cancelAnimation(sheenPos);
        sheenActive.value = 0;
      }
    }, [isTerminal, isCompleted, dialogWidth]);

    const sheenStyle = useAnimatedStyle(() => {
      if (sheenActive.value === 0) return { opacity: 0 };
      const tx =
        dialogWidth > 0
          ? interpolate(
              sheenPos.value,
              [0, 1],
              [-SHEEN_WIDTH, dialogWidth + SHEEN_WIDTH],
            )
          : -SHEEN_WIDTH;
      const opacity = interpolate(
        sheenPos.value,
        [0, 0.05, 0.95, 1],
        [0, 0.8, 0.8, 0],
      );
      return { opacity, transform: [{ translateX: tx }] };
    });

    const handleLayout = useCallback(
      (e: { nativeEvent: { layout: { width: number } } }) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setDialogWidth(w);
      },
      [],
    );

    const textColor = isFailed
      ? colors.status.error.text
      : isCompleted
        ? colors.status.success.text
        : "#fbbf24";

    const displayText = isCompleted
      ? resultMessage
      : isFailed
        ? error || "Failed"
        : stepLabel;

    return (
      <View style={styles.dialogContainer} onLayout={handleLayout}>
        {/* Golden sheen */}
        {dialogWidth > 0 && (
          <RAnimated.View
            style={[styles.dialogSheen, sheenStyle]}
            pointerEvents="none"
          >
            <Svg width={SHEEN_WIDTH} height={DIALOG_HEIGHT}>
              <Defs>
                <LinearGradient id="dialogSheen" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#fbbf24" stopOpacity="0" />
                  <Stop offset="0.3" stopColor="#fbbf24" stopOpacity="0.5" />
                  <Stop offset="0.5" stopColor="#fef3c7" stopOpacity="0.8" />
                  <Stop offset="0.7" stopColor="#fbbf24" stopOpacity="0.5" />
                  <Stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={SHEEN_WIDTH}
                height={DIALOG_HEIGHT}
                fill="url(#dialogSheen)"
              />
            </Svg>
          </RAnimated.View>
        )}

        {/* Status text */}
        <RAnimated.Text
          key={displayText}
          entering={FadeIn.duration(200)}
          style={[styles.dialogText, { color: textColor }]}
          numberOfLines={1}
        >
          {displayText}
        </RAnimated.Text>
      </View>
    );
  },
);

// --- Main sheet ---

const ScanProgressSheet: React.FC<ScanProgressSheetProps> = ({
  visible,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const { activeJobs } = useJobProgressContext();
  const translateY = useRef(new Animated.Value(SNAP_DISMISSED)).current;
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasJobs = activeJobs.length > 0;

  // Most recent job
  const inFlightJobs = activeJobs.filter(
    (j) => j.status === "pending" || j.status === "processing",
  );
  const displayJob =
    inFlightJobs.length > 0
      ? inFlightJobs[inFlightJobs.length - 1]
      : activeJobs[activeJobs.length - 1];

  const stepLabel = displayJob?.stepLabel ?? "Analyzing flyer";
  const extractions = displayJob?.extractions;
  const isCompleted = displayJob?.status === "completed";
  const isFailed = displayJob?.status === "failed";
  const isTerminal = isCompleted || isFailed;

  // Derived extraction values
  const emoji = extractions?.emoji;
  const title = extractions?.title;
  const date = extractions?.date;
  const address = extractions?.address;
  const categories = extractions?.categories;

  const resultMessage =
    (displayJob?.result?.message as string) || "Event Created";

  // --- Auto-dismiss after completion/failure ---
  useEffect(() => {
    if (visible && isTerminal) {
      autoDismissTimer.current = setTimeout(() => {
        dismiss();
      }, AUTO_DISMISS_DELAY);
    }
    return () => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
        autoDismissTimer.current = null;
      }
    };
  }, [visible, isTerminal]);

  // --- Sheet mechanics ---
  const springTo = useCallback(
    (toValue: number, onDone?: () => void) => {
      Animated.spring(translateY, {
        toValue,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(onDone);
    },
    [translateY],
  );

  const dismiss = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    Animated.timing(translateY, {
      toValue: SNAP_DISMISSED,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [translateY, onDismiss]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(SNAP_DISMISSED);
      springTo(SNAP_OPEN);
    }
  }, [visible, translateY, springTo]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        translateY.setValue(Math.max(SNAP_OPEN, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          dismiss();
        } else {
          springTo(SNAP_OPEN);
        }
      },
    }),
  ).current;

  // Split categories for pills
  const tagList = useMemo(
    () => (categories ? categories.slice(0, 3) : []),
    [categories],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={dismiss} />

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 8 },
            { transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle */}
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          {hasJobs ? (
            <>
              {/* Side-by-side content: emoji circle + info */}
              <View style={styles.contentRow}>
                {/* Emoji circle */}
                <View style={styles.emojiCircle}>
                  {emoji ? (
                    <RAnimated.Text
                      key={emoji}
                      entering={FadeIn.duration(300)}
                      style={styles.emojiText}
                    >
                      {emoji}
                    </RAnimated.Text>
                  ) : (
                    <View style={styles.emojiPlaceholder} />
                  )}
                </View>

                {/* Right info column */}
                <View style={styles.infoColumn}>
                  {/* Title */}
                  {title ? (
                    <RAnimated.Text
                      key={title}
                      entering={FadeIn.duration(250)}
                      style={styles.titleText}
                      numberOfLines={2}
                    >
                      {title}
                    </RAnimated.Text>
                  ) : (
                    <View style={styles.titlePlaceholderGroup}>
                      <PlaceholderLine width="90%" />
                      <PlaceholderLine width="60%" />
                    </View>
                  )}

                  {/* Date + Address */}
                  {date || address ? (
                    <RAnimated.Text
                      entering={FadeIn.duration(250)}
                      style={styles.detailText}
                      numberOfLines={1}
                    >
                      {[date, address].filter(Boolean).join("  ·  ")}
                    </RAnimated.Text>
                  ) : (
                    <PlaceholderLine width="75%" />
                  )}

                  {/* Tags */}
                  <View style={styles.tagsRow}>
                    {tagList.length > 0
                      ? tagList.map((tag) => <TagPill key={tag} label={tag} />)
                      : Array.from({ length: 3 }).map((_, i) => (
                          <PlaceholderPill key={i} />
                        ))}
                  </View>
                </View>
              </View>

              {/* Status dialog at bottom */}
              <ScanStatusDialog
                stepLabel={stepLabel}
                isCompleted={isCompleted}
                isFailed={isFailed}
                resultMessage={resultMessage}
                error={displayJob?.error}
              />
            </>
          ) : (
            <RAnimated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={styles.emptyState}
            >
              <Text style={styles.emptyText}>No active scans</Text>
            </RAnimated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  handleArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.secondary,
  },

  // --- Side-by-side content ---
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.md,
    flex: 1,
  },

  // --- Emoji circle ---
  emojiCircle: {
    width: EMOJI_CIRCLE_SIZE,
    height: EMOJI_CIRCLE_SIZE,
    borderRadius: EMOJI_CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.elevated,
  },
  emojiText: {
    fontSize: 36,
  },
  emojiPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border.subtle,
  },

  // --- Info column ---
  infoColumn: {
    flex: 1,
    gap: spacing._6,
  },
  titleText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: 18,
  },
  titlePlaceholderGroup: {
    gap: 5,
  },
  detailText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },

  // --- Placeholder lines ---
  placeholderLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border.subtle,
  },
  shimmerBeam: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
  },

  // --- Tags ---
  tagsRow: {
    flexDirection: "row",
    gap: spacing._6,
    marginTop: 2,
  },
  tagPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.bg.elevated,
  },
  tagText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
  placeholderPill: {
    width: 52,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.border.subtle,
  },

  // --- Status dialog (bottom bar) ---
  dialogContainer: {
    height: DIALOG_HEIGHT,
    backgroundColor: colors.bg.cardAlt,
    borderTopWidth: 1,
    borderColor: colors.border.medium,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  dialogSheen: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  dialogText: {
    fontSize: 13,
    fontFamily: fontFamily.mono,
    fontStyle: "italic",
    letterSpacing: 1,
  },

  // --- Empty state ---
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontStyle: "italic",
    color: colors.text.disabled,
  },
});

export default React.memo(ScanProgressSheet);
