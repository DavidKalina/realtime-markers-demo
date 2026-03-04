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
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import {
  CameraAnimateToLocationEvent,
  EventTypes,
} from "@/services/EventBroker";
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
const DIALOG_HEIGHT = 34;
const SHEEN_WIDTH = 100;

interface ScanProgressSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

// --- Marching-dash animation for placeholder slots ---

const AnimatedSvgRect = RAnimated.createAnimatedComponent(Rect);
const AnimatedSvgCircle = RAnimated.createAnimatedComponent(Circle);

const DASH_PATTERN = "6 4";
const DASH_PERIOD = 10;
const SLOT_STROKE = "rgba(255,255,255,0.18)";

function useMarchingDash() {
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withRepeat(
      withTiming(DASH_PERIOD, { duration: 1200, easing: Easing.linear }),
      -1,
    );
  }, []);
  return offset;
}

// --- Emoji placeholder (animated dashed ring) ---

const EMOJI_PLACEHOLDER_SIZE = 36;

const EmojiPlaceholder = React.memo(() => {
  const dashOffset = useMarchingDash();
  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));
  const r = (EMOJI_PLACEHOLDER_SIZE - 1.5) / 2;
  return (
    <Svg width={EMOJI_PLACEHOLDER_SIZE} height={EMOJI_PLACEHOLDER_SIZE}>
      <AnimatedSvgCircle
        cx={EMOJI_PLACEHOLDER_SIZE / 2}
        cy={EMOJI_PLACEHOLDER_SIZE / 2}
        r={r}
        stroke={SLOT_STROKE}
        strokeWidth={1.5}
        strokeDasharray={DASH_PATTERN}
        fill="transparent"
        animatedProps={animProps}
      />
    </Svg>
  );
});

// --- Placeholder line (animated dashed outlined slot) ---

const PlaceholderLine = React.memo(
  ({ width: widthProp, height: h = 14 }: { width: number | string; height?: number }) => {
    const [measured, setMeasured] = useState(0);
    const dashOffset = useMarchingDash();
    const animProps = useAnimatedProps(() => ({
      strokeDashoffset: dashOffset.value,
    }));
    const handleLayout = useCallback(
      (e: { nativeEvent: { layout: { width: number } } }) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setMeasured(w);
      },
      [],
    );
    return (
      <View
        style={
          typeof widthProp === "number"
            ? { width: widthProp, height: h }
            : { width: widthProp, height: h }
        }
        onLayout={handleLayout}
      >
        {measured > 0 && (
          <Svg width={measured} height={h} style={StyleSheet.absoluteFill}>
            <AnimatedSvgRect
              x={0.5}
              y={0.5}
              width={measured - 1}
              height={h - 1}
              rx={4}
              stroke={SLOT_STROKE}
              strokeWidth={1}
              strokeDasharray={DASH_PATTERN}
              fill="transparent"
              animatedProps={animProps}
            />
          </Svg>
        )}
      </View>
    );
  },
);

// --- Tag pill ---

const TagPill = React.memo(({ label }: { label: string }) => (
  <RAnimated.View entering={FadeIn.duration(250)} style={styles.tagPill}>
    <Text style={styles.tagText} numberOfLines={1}>
      {label}
    </Text>
  </RAnimated.View>
));

const PlaceholderPill = React.memo(() => {
  const dashOffset = useMarchingDash();
  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));
  return (
    <Svg width={52} height={20}>
      <AnimatedSvgRect
        x={0.5}
        y={0.5}
        width={51}
        height={19}
        rx={8}
        stroke={SLOT_STROKE}
        strokeWidth={1}
        strokeDasharray={DASH_PATTERN}
        fill="transparent"
        animatedProps={animProps}
      />
    </Svg>
  );
});

// --- DialogBox-inspired status bar ---

const ScanStatusDialog = React.memo(
  ({
    stepLabel,
    isCompleted,
    isFailed,
    resultMessage,
    error,
    bottomInset,
  }: {
    stepLabel: string;
    isCompleted: boolean;
    isFailed: boolean;
    resultMessage: string;
    error?: string;
    bottomInset: number;
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
      <View style={[styles.dialogContainer, { paddingBottom: bottomInset }]}>
        <View style={styles.dialogContent} onLayout={handleLayout}>
          {/* Golden sheen */}
          {dialogWidth > 0 && (
            <RAnimated.View
              style={[styles.dialogSheen, sheenStyle]}
              pointerEvents="none"
            >
              <Svg width={SHEEN_WIDTH} height={DIALOG_HEIGHT}>
                <Defs>
                  <LinearGradient
                    id="dialogSheen"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
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
  const { publish } = useEventBroker();
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

  // Check if an event was actually created
  const result = displayJob?.result;
  const eventCreated =
    isCompleted &&
    ((result?.eventId && !result?.isDuplicate) || result?.isMultiEvent);

  // Only show extractions if still processing or event was created
  const showExtractions = !isTerminal || eventCreated;

  // Derived extraction values
  const emoji = showExtractions ? extractions?.emoji : undefined;
  const title = showExtractions ? extractions?.title : undefined;
  const date = showExtractions ? extractions?.date : undefined;
  const address = showExtractions ? extractions?.address : undefined;
  const categories = showExtractions ? extractions?.categories : undefined;

  const resultMessage =
    (displayJob?.result?.message as string) || "Event Created";

  // Fly-to coordinates (only for single-event results)
  const flyToCoordinates = useMemo(
    () =>
      eventCreated && result?.coordinates ? result.coordinates : undefined,
    [eventCreated, result?.coordinates],
  );

  const handleContentPress = useCallback(() => {
    if (!flyToCoordinates) return;
    publish<CameraAnimateToLocationEvent>(
      EventTypes.CAMERA_ANIMATE_TO_LOCATION,
      {
        coordinates: flyToCoordinates,
        timestamp: new Date().getTime(),
        source: "scan_progress_sheet",
        zoomLevel: 16,
        allowZoomChange: true,
      },
    );
    dismiss();
  }, [flyToCoordinates, publish, dismiss]);

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
            { transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle */}
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          {hasJobs ? (
            <>
              {showExtractions ? (
                /* Side-by-side content: emoji circle + info */
                <Pressable
                  style={styles.contentRow}
                  onPress={handleContentPress}
                  disabled={!flyToCoordinates}
                >
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
                      <EmojiPlaceholder />
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
                        <PlaceholderLine width="90%" height={14} />
                        <PlaceholderLine width="60%" height={14} />
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
                      <PlaceholderLine width="75%" height={12} />
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
                </Pressable>
              ) : (
                /* Terminal state with no event created */
                <RAnimated.View
                  entering={FadeIn.duration(200)}
                  style={styles.noEventContent}
                >
                  <Text style={styles.noEventText}>{resultMessage}</Text>
                </RAnimated.View>
              )}

              {/* Status dialog at bottom */}
              <ScanStatusDialog
                stepLabel={stepLabel}
                isCompleted={isCompleted}
                isFailed={isFailed}
                resultMessage={resultMessage}
                error={displayJob?.error}
                bottomInset={0}
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
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
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
    gap: 4,
  },
  detailText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
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
  // --- Status dialog (bottom bar) ---
  dialogContainer: {
    backgroundColor: colors.bg.cardAlt,
    borderTopWidth: 1,
    borderColor: colors.border.medium,
    overflow: "hidden",
  },
  dialogContent: {
    height: DIALOG_HEIGHT,
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

  // --- No event created state ---
  noEventContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  noEventText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    fontStyle: "italic",
    color: colors.text.secondary,
    textAlign: "center",
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
