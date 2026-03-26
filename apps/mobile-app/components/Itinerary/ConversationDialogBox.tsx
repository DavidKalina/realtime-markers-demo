import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { ArrowRight } from "lucide-react-native";
import {
  useColors,
  fontFamily,
  fontSize,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import {
  useConversationEngine,
  type ConversationStep,
  type OptionChoice,
  type TriggerSource,
  type ContentType,
  type EngineState,
} from "@/hooks/useConversationEngine";

/* ── Constants ─────────────────────────────────────────────── */

const COLLAPSED_HEIGHT = 44;
const SHEEN_WIDTH = 100;
const EXPANDED_HEIGHT = 450;
const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";

/* ── Generating skeleton components ────────────────────────── */

const GEN_EMOJIS = [
  "\uD83D\uDDFA\uFE0F", "\uD83C\uDFAF", "\uD83C\uDFAA", "\uD83C\uDFAD",
  "\uD83C\uDFA8", "\uD83C\uDFB5", "\uD83C\uDF7D\uFE0F", "\u2615",
  "\uD83C\uDFDE\uFE0F", "\uD83D\uDEB6", "\uD83C\uDFD5\uFE0F", "\uD83C\uDF0A",
  "\uD83C\uDFDB\uFE0F", "\uD83C\uDFA4", "\uD83E\uDDD7", "\uD83C\uDF66",
  "\uD83D\uDEB2", "\uD83C\uDFB6",
];

const GEN_MESSAGES = [
  "Scanning nearby events\u2026",
  "Searching verified venues\u2026",
  "Scouting nearby trails\u2026",
  "Pulling weather forecast\u2026",
  "Curating your stops\u2026",
  "Checking business hours\u2026",
  "Finalizing your sidequest\u2026",
];

const STOP_TITLES = [
  "Finding a caf\u{E9}\u2026",
  "Scouting a park\u2026",
  "Checking galleries\u2026",
  "Mapping restaurants\u2026",
  "Locating a bar\u2026",
  "Searching trails\u2026",
  "Browsing markets\u2026",
  "Pinning a museum\u2026",
];

const REEL_H = 24;

const SkeletonPulseBar = React.memo(function SkeletonPulseBar({
  width,
  height,
  colors,
  rounded,
}: {
  width: number | string;
  height: number;
  colors: Colors;
  rounded?: boolean;
}) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      Math.random() * 400,
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
    );
    const interval = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      );
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Reanimated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: rounded ? height / 2 : radius.sm,
          backgroundColor: colors.bg.elevated,
        },
        animStyle,
      ]}
    />
  );
});

const EmojiReel = React.memo(function EmojiReel() {
  const translateY = useSharedValue(0);
  const reelEmojis = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < 3; i++) items.push(...GEN_EMOJIS);
    return items;
  }, []);

  const spin = useCallback(() => {
    const landIdx =
      2 * GEN_EMOJIS.length + Math.floor(Math.random() * GEN_EMOJIS.length);
    translateY.value = 0;
    translateY.value = withTiming(-landIdx * REEL_H, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  useEffect(() => {
    spin();
    const timer = setInterval(spin, 2800);
    return () => clearInterval(timer);
  }, [spin]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ height: REEL_H, width: REEL_H, overflow: "hidden" }}>
      <Reanimated.View style={animStyle}>
        {reelEmojis.map((emoji, i) => (
          <Text
            key={i}
            style={{
              height: REEL_H,
              lineHeight: REEL_H,
              fontSize: 18,
              textAlign: "center",
            }}
          >
            {emoji}
          </Text>
        ))}
      </Reanimated.View>
    </View>
  );
});

const SkeletonStopRow = React.memo(function SkeletonStopRow({
  index,
  isLast,
  colors,
}: {
  index: number;
  isLast: boolean;
  colors: Colors;
}) {
  const reelTranslateY = useSharedValue(0);
  const [titleIdx, setTitleIdx] = useState(index % STOP_TITLES.length);
  const titleOpacity = useSharedValue(1);

  const reelEmojis = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < 3; i++) items.push(...GEN_EMOJIS);
    return items;
  }, []);

  useEffect(() => {
    const interval = 2200 + index * 250;
    const delay = index * 300;
    const startTimer = setTimeout(() => {
      const spin = () => {
        const landIdx =
          2 * GEN_EMOJIS.length + Math.floor(Math.random() * GEN_EMOJIS.length);
        reelTranslateY.value = 0;
        reelTranslateY.value = withTiming(-landIdx * REEL_H, {
          duration: 1200,
          easing: Easing.out(Easing.cubic),
        });
      };
      spin();
    }, delay);
    const id = setInterval(() => {
      const landIdx =
        2 * GEN_EMOJIS.length + Math.floor(Math.random() * GEN_EMOJIS.length);
      reelTranslateY.value = 0;
      reelTranslateY.value = withTiming(-landIdx * REEL_H, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });
    }, interval);
    return () => {
      clearTimeout(startTimer);
      clearInterval(id);
    };
  }, [index]);

  useEffect(() => {
    const interval = 2600 + index * 200;
    const delay = index * 350;
    const startTimer = setTimeout(() => {
      const id = setInterval(() => {
        titleOpacity.value = withSequence(
          withTiming(0, { duration: 250 }),
          withTiming(1, { duration: 250 }),
        );
        setTimeout(() => {
          setTitleIdx((i) => (i + 1) % STOP_TITLES.length);
        }, 250);
      }, interval);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [index]);

  const reelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reelTranslateY.value }],
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  return (
    <View style={genStyles.stopRow}>
      <View style={genStyles.stopLeft}>
        <SkeletonPulseBar width={28} height={10} colors={colors} />
        <View style={[genStyles.stopDot, { backgroundColor: colors.border.default }]} />
        {!isLast && (
          <View style={[genStyles.stopLine, { backgroundColor: colors.border.default }]} />
        )}
      </View>
      <View style={genStyles.stopContent}>
        <View style={{ width: REEL_H, height: REEL_H, overflow: "hidden" }}>
          <Reanimated.View style={reelStyle}>
            {reelEmojis.map((emoji, i) => (
              <Text
                key={i}
                style={{
                  height: REEL_H,
                  lineHeight: REEL_H,
                  fontSize: 16,
                  textAlign: "center",
                }}
              >
                {emoji}
              </Text>
            ))}
          </Reanimated.View>
        </View>
        <Reanimated.Text
          style={[genStyles.stopTitle, { color: colors.text.secondary }, titleAnimStyle]}
          numberOfLines={1}
        >
          {STOP_TITLES[titleIdx]}
        </Reanimated.Text>
      </View>
    </View>
  );
});

const STOP_PATTERNS = [3, 4, 5, 4, 3, 5];

const SKELETON_TITLES = [
  "Sunset District Crawl",
  "Hidden Gem Day Trip",
  "Culture & Coffee Walk",
  "Neighborhood Explorer",
  "Urban Adventure Loop",
  "Local Flavor Tour",
];

const SKELETON_SUMMARIES = [
  "A mix of outdoor spots and cozy indoor finds",
  "Hitting the best-rated places near you",
  "Balancing chill vibes with hidden discoveries",
  "An afternoon of art, food, and fresh air",
  "Exploring off-the-beaten-path favorites",
];

const GeneratingContent = React.memo(function GeneratingContent({
  colors,
}: {
  colors: Colors;
}) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [titleIdx, setTitleIdx] = useState(0);
  const [summaryIdx, setSummaryIdx] = useState(0);
  const [stopCount, setStopCount] = useState(3);
  const patternIdx = useRef(0);
  const msgOpacity = useSharedValue(1);
  const heroOpacity = useSharedValue(1);

  // Rotate status messages
  useEffect(() => {
    const timer = setInterval(() => {
      msgOpacity.value = withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      );
      setTimeout(() => {
        setMsgIdx((i) => (i + 1) % GEN_MESSAGES.length);
      }, 200);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  // Rotate skeleton hero title/summary
  useEffect(() => {
    const timer = setInterval(() => {
      heroOpacity.value = withSequence(
        withTiming(0.3, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
      );
      setTimeout(() => {
        setTitleIdx((i) => (i + 1) % SKELETON_TITLES.length);
        setSummaryIdx((i) => (i + 1) % SKELETON_SUMMARIES.length);
      }, 300);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Rotate stop count
  useEffect(() => {
    const timer = setInterval(() => {
      patternIdx.current = (patternIdx.current + 1) % STOP_PATTERNS.length;
      setStopCount(STOP_PATTERNS[patternIdx.current]);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const msgAnimStyle = useAnimatedStyle(() => ({ opacity: msgOpacity.value }));
  const heroAnimStyle = useAnimatedStyle(() => ({ opacity: heroOpacity.value }));

  return (
    <View style={genStyles.container}>
      {/* Skeleton hero — rotating title + summary + pill bars */}
      <View style={genStyles.heroSection}>
        <Reanimated.Text
          style={[genStyles.heroTitle, { color: colors.text.primary }, heroAnimStyle]}
          numberOfLines={1}
        >
          {SKELETON_TITLES[titleIdx]}
        </Reanimated.Text>
        <View style={genStyles.pillRow}>
          <SkeletonPulseBar width={72} height={14} colors={colors} rounded />
          <SkeletonPulseBar width={90} height={14} colors={colors} rounded />
        </View>
        <Reanimated.Text
          style={[genStyles.heroSummary, { color: colors.text.disabled }, heroAnimStyle]}
          numberOfLines={1}
        >
          {SKELETON_SUMMARIES[summaryIdx]}
        </Reanimated.Text>
        <View style={genStyles.pillRow}>
          <SkeletonPulseBar width={60} height={20} colors={colors} rounded />
          <SkeletonPulseBar width={48} height={20} colors={colors} rounded />
          <SkeletonPulseBar width={44} height={20} colors={colors} rounded />
        </View>
      </View>

      {/* Status row */}
      <View style={[genStyles.statusRow, { borderColor: colors.border.subtle }]}>
        <EmojiReel />
        <Reanimated.Text
          style={[genStyles.statusText, { color: colors.text.secondary }, msgAnimStyle]}
          numberOfLines={1}
        >
          {GEN_MESSAGES[msgIdx]}
        </Reanimated.Text>
      </View>

      {/* Skeleton stops */}
      <View>
        {Array.from({ length: stopCount }, (_, i) => (
          <Reanimated.View
            key={i}
            entering={FadeIn.duration(300).delay(i * 60)}
            exiting={FadeOut.duration(200)}
          >
            <SkeletonStopRow index={i} isLast={i === stopCount - 1} colors={colors} />
          </Reanimated.View>
        ))}
      </View>
    </View>
  );
});

const genStyles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 4,
  },
  heroSection: {
    gap: 6,
    paddingBottom: 8,
  },
  heroTitle: {
    fontSize: 16,
    fontFamily: fontFamily.mono,
    fontWeight: "700",
  },
  heroSummary: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    lineHeight: 17,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: "600",
  },
  stopRow: {
    flexDirection: "row",
    paddingTop: 8,
    minHeight: 48,
  },
  stopLeft: {
    width: 36,
    alignItems: "center",
    gap: 3,
  },
  stopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stopLine: {
    width: 1,
    flex: 1,
    minHeight: 16,
  },
  stopContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingBottom: 8,
  },
  stopTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: fontFamily.mono,
  },
});

/* ── Option row (compact list item with radio or checkbox) ── */

const OptionRow = React.memo(function OptionRow({
  option,
  selected,
  multiSelect,
  onSelect,
  styles,
}: {
  option: OptionChoice;
  selected: boolean;
  multiSelect: boolean;
  onSelect: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(option.value);
  }, [option.value, onSelect]);

  // Invisible spacer for odd-count grids
  if (option.value === "__spacer") {
    return <View style={[styles.optionRow, { opacity: 0, borderColor: "transparent" }]} />;
  }

  return (
    <Pressable
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={handlePress}
    >
      <View style={styles.optionRowLeft}>
        {option.emoji && (
          <Text style={styles.optionRowEmoji}>{option.emoji}</Text>
        )}
        <Text
          style={[
            styles.optionRowLabel,
            selected && styles.optionRowLabelSelected,
          ]}
          numberOfLines={1}
        >
          {option.label}
        </Text>
      </View>
      {multiSelect ? (
        <View
          style={[styles.checkbox, selected && styles.checkboxSelected]}
        >
          {selected && <Text style={styles.checkmark}>{"✓"}</Text>}
        </View>
      ) : (
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
      )}
    </Pressable>
  );
});

/* ── Main component ────────────────────────────────────────── */

type Phase = "collapsed" | "active";

export interface ConversationDialogBoxProps {
  style?: ViewStyle;
  /** Text shown in the collapsed bar */
  collapsedLabel?: string;
  /** Start expanded */
  defaultExpanded?: boolean;
  /** Reactively expand when this becomes true */
  autoExpand?: boolean;
  /** Conversation steps to run — changing this restarts the conversation */
  steps?: ConversationStep[];
  /** What triggered this conversation */
  trigger?: TriggerSource;
  /** Arbitrary metadata forwarded to step callbacks */
  meta?: Record<string, unknown>;
  /** Called when conversation finishes (all steps exhausted) */
  onComplete?: (responses: Record<number, string>) => void;
  /** Called on dismiss */
  onDismiss?: () => void;
  /** Stream speed override (ms per character, default 25) */
  streamSpeed?: number;
  /**
   * Custom renderer for the middle content zone.
   * Receives the engine state and the content type hint from the current step.
   * Return null to fall back to default options rendering.
   */
  renderContent?: (
    engine: EngineState,
    contentType: ContentType,
  ) => React.ReactNode | null;
}

export default function ConversationDialogBox({
  style,
  collapsedLabel = "Ask me anything",
  defaultExpanded = false,
  autoExpand = false,
  steps: stepsProp,
  trigger = "custom",
  meta,
  onComplete,
  onDismiss,
  streamSpeed,
  renderContent,
}: ConversationDialogBoxProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>(
    defaultExpanded ? "active" : "collapsed",
  );
  const [statusText, setStatusText] = useState(collapsedLabel);
  const [inputText, setInputText] = useState("");

  // Conversation engine
  const engine = useConversationEngine({ streamSpeed });

  // Haptic feedback on step transitions
  const prevStepIndex = useRef(engine.stepIndex);
  useEffect(() => {
    if (engine.stepIndex !== prevStepIndex.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      prevStepIndex.current = engine.stepIndex;
    }
  }, [engine.stepIndex]);

  // Haptic when streaming completes and options appear
  useEffect(() => {
    if (engine.waitingForUser && !engine.isStreaming) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
  }, [engine.waitingForUser, engine.isStreaming]);

  // Detect conversation complete
  useEffect(() => {
    if (
      engine.isActive &&
      !engine.waitingForUser &&
      !engine.isStreaming &&
      engine.displayText.length > 0
    ) {
      const t = setTimeout(() => {
        if (!engine.waitingForUser && !engine.isStreaming) {
          onComplete?.(engine.context.responses);
        }
      }, 600);
      return () => clearTimeout(t);
    }
  }, [engine.isActive, engine.waitingForUser, engine.isStreaming, engine.displayText]);

  // Animation shared values
  const animHeight = useSharedValue(
    defaultExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
  );
  const sheenPos = useSharedValue(0);
  const contentOpacity = useSharedValue(defaultExpanded ? 1 : 0);
  const statusOpacity = useSharedValue(defaultExpanded ? 0 : 1);
  const sheenActive = useSharedValue(defaultExpanded ? 0 : 1);
  const [containerMeasured, setContainerMeasured] = useState(false);
  const containerWidthSV = useSharedValue(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      containerWidthSV.value = w;
      setContainerMeasured(true);
    }
  }, []);

  // Stable callbacks for worklet → RN
  const setCollapsedCb = useCallback(() => {
    setPhase("collapsed");
    setStatusText(collapsedLabel);
  }, [collapsedLabel]);

  const setActivePhaseCb = useCallback(() => {
    setPhase("active");
  }, []);

  // Expand
  const handleExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelAnimation(sheenPos);
    sheenActive.value = 0;
    statusOpacity.value = withTiming(0, { duration: 150 });

    animHeight.value = withTiming(
      EXPANDED_HEIGHT,
      { duration: 350, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          scheduleOnRN(setActivePhaseCb);
          contentOpacity.value = withDelay(
            50,
            withTiming(1, { duration: 200 }),
          );
        }
      },
    );
  }, [setActivePhaseCb]);

  // Collapse / dismiss
  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    contentOpacity.value = withTiming(0, { duration: 150 });
    animHeight.value = withTiming(
      COLLAPSED_HEIGHT,
      { duration: 350, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          scheduleOnRN(setCollapsedCb);
          statusOpacity.value = withTiming(1, { duration: 200 });
        }
      },
    );
    engine.reset();
    setInputText("");
    onDismiss?.();
  }, [setCollapsedCb, engine.reset, onDismiss]);

  // Start conversation when expanded + steps available
  useEffect(() => {
    if (phase === "active" && stepsProp && stepsProp.length > 0) {
      engine.start(stepsProp, trigger, meta);
    }
  }, [phase, stepsProp]);

  // Auto-expand
  useEffect(() => {
    if (autoExpand && phase === "collapsed") {
      handleExpand();
    }
  }, [autoExpand]);

  // Sheen while collapsed
  useEffect(() => {
    if (phase !== "collapsed") return;
    const runSheen = () => {
      sheenActive.value = 1;
      sheenPos.value = 0;
      sheenPos.value = withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
      });
    };
    const initialTimeout = setTimeout(runSheen, 1500);
    const interval = setInterval(runSheen, 15000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [phase]);

  // Handle text submit
  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || !engine.waitingForUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    engine.respond(trimmed);
    setInputText("");
  }, [inputText, engine.waitingForUser, engine.respond]);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
  }));

  const sheenAnimStyle = useAnimatedStyle(() => {
    if (sheenActive.value === 0) return { opacity: 0 };
    const translateX =
      containerWidthSV.value > 0
        ? interpolate(
            sheenPos.value,
            [0, 1],
            [-SHEEN_WIDTH, containerWidthSV.value + SHEEN_WIDTH],
          )
        : -SHEEN_WIDTH;
    const opacity = interpolate(
      sheenPos.value,
      [0, 0.05, 0.95, 1],
      [0, 0.8, 0.8, 0],
    );
    return { opacity, transform: [{ translateX }] };
  });

  const statusAnimStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // Multi-select state (used when step has multiSelect: true)
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());

  // Reset selections when step changes
  const prevEngineStep = useRef(engine.stepIndex);
  useEffect(() => {
    if (engine.stepIndex !== prevEngineStep.current) {
      setSelectedValues(new Set());
      prevEngineStep.current = engine.stepIndex;
    }
  }, [engine.stepIndex]);

  const handleOptionTap = useCallback(
    (value: string) => {
      if (!engine.waitingForUser) return;

      if (engine.multiSelect) {
        // Toggle in the set
        setSelectedValues((prev) => {
          const next = new Set(prev);
          if (next.has(value)) {
            next.delete(value);
          } else {
            next.add(value);
          }
          return next;
        });
      } else {
        // Single-select: just set the one value, confirm advances
        setSelectedValues(new Set([value]));
      }
    },
    [engine.waitingForUser, engine.multiSelect],
  );

  const handleConfirm = useCallback(() => {
    if (selectedValues.size === 0 || !engine.waitingForUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    engine.respond(Array.from(selectedValues).join(","));
    setSelectedValues(new Set());
  }, [selectedValues, engine.waitingForUser, engine.respond]);

  // Render item for vertical FlatList
  const renderOptionRow = useCallback(
    ({ item }: ListRenderItemInfo<OptionChoice>) => (
      <OptionRow
        option={item}
        selected={selectedValues.has(item.value)}
        multiSelect={engine.multiSelect}
        onSelect={handleOptionTap}
        styles={styles}
      />
    ),
    [selectedValues, engine.multiSelect, handleOptionTap, styles],
  );

  const optionKeyExtractor = useCallback((item: OptionChoice) => item.value, []);

  // Resolve middle zone content
  const middleContent = useMemo(() => {
    // Custom renderer gets first shot
    if (renderContent && (engine.waitingForUser || engine.isStreaming)) {
      const custom = renderContent(engine, engine.contentType);
      if (custom !== null) return custom;
    }

    // Generating skeleton — shown even when not waiting for user
    if (engine.contentType === "generating") {
      return <GeneratingContent colors={colors} />;
    }

    if (!engine.waitingForUser && !engine.isStreaming) return null;

    // Default: compact vertical list with checkboxes/radios
    if (
      engine.contentType === "options" &&
      engine.currentOptions &&
      engine.waitingForUser
    ) {
      return (
        <View style={styles.optionsContainer}>
          <FlatList
            data={
              engine.currentOptions.length % 2 !== 0
                ? [...engine.currentOptions, { label: "", value: "__spacer", emoji: "" }]
                : engine.currentOptions
            }
            renderItem={renderOptionRow}
            keyExtractor={optionKeyExtractor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.optionsList}
            style={styles.optionsScroll}
            numColumns={2}
            columnWrapperStyle={styles.optionsColumns}
          />
          <Reanimated.View
            entering={FadeIn.duration(200)}
            style={styles.confirmRow}
          >
            {engine.multiSelect && (
              <Text style={styles.selectedCount}>
                {selectedValues.size} selected
              </Text>
            )}
            <Pressable
              style={[
                styles.confirmButton,
                selectedValues.size === 0 && styles.confirmButtonDisabled,
                { marginLeft: "auto" },
              ]}
              onPress={handleConfirm}
              disabled={selectedValues.size === 0}
            >
              <ArrowRight size={20} color={GREEN_ACCENT} strokeWidth={2.5} />
            </Pressable>
          </Reanimated.View>
        </View>
      );
    }

    return null;
  }, [
    colors,
    engine.waitingForUser,
    engine.isStreaming,
    engine.contentType,
    engine.currentOptions,
    engine.multiSelect,
    selectedValues,
    renderContent,
    renderOptionRow,
    optionKeyExtractor,
    handleConfirm,
    styles,
  ]);

  return (
    <Reanimated.View
      style={[styles.bubble, style, animatedContainerStyle]}
      onLayout={handleLayout}
    >
      {/* Status text overlay (collapsed) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={phase === "collapsed" ? handleExpand : undefined}
      >
        <Reanimated.View
          style={[styles.statusOverlay, statusAnimStyle]}
          pointerEvents="none"
        >
          <Text style={styles.statusText}>{statusText}</Text>
        </Reanimated.View>
      </Pressable>

      {/* Sheen sweep */}
      {containerMeasured && (
        <Reanimated.View
          style={[styles.sheenBeam, sheenAnimStyle]}
          pointerEvents="none"
        >
          <Svg width={SHEEN_WIDTH} height={COLLAPSED_HEIGHT}>
            <Defs>
              <LinearGradient id="convSheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#86efac" stopOpacity="0" />
                <Stop offset="0.3" stopColor="#a8e6c0" stopOpacity="0.3" />
                <Stop offset="0.5" stopColor="#d4f5e0" stopOpacity="0.5" />
                <Stop offset="0.7" stopColor="#a8e6c0" stopOpacity="0.3" />
                <Stop offset="1" stopColor="#86efac" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={SHEEN_WIDTH}
              height={COLLAPSED_HEIGHT}
              fill="url(#convSheen)"
            />
          </Svg>
        </Reanimated.View>
      )}

      {/* ═══ Expanded content: 3-zone layout ═══ */}
      <Reanimated.View style={[styles.expandedContainer, contentAnimStyle]}>
        {phase === "active" && (
          <>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Conversation</Text>
              <Pressable onPress={handleDismiss} style={styles.dismissButton}>
                <Text style={styles.dismissText}>✕</Text>
              </Pressable>
            </View>

            {/* ─── ZONE 1: Narrator text (top) ─── */}
            <View style={styles.narratorZone}>
              <Text style={styles.narratorText}>{engine.displayText}</Text>
              {!engine.isStreaming &&
                engine.displayText.length > 0 &&
                engine.waitingForUser && (
                  <View style={styles.narratorDivider} />
                )}
            </View>

            {/* ─── ZONE 2: Dynamic content (middle) ─── */}
            <View style={styles.contentZone}>{middleContent}</View>

            {/* ─── ZONE 3: Input bar (bottom) ─── */}
            {engine.waitingForUser && !engine.hideInput && (
              <Reanimated.View
                entering={FadeIn.duration(200)}
                style={styles.inputZone}
              >
                <TextInput
                  style={styles.textInput}
                  placeholder={engine.inputPlaceholder}
                  placeholderTextColor={colors.text.disabled}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  autoCorrect
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    !inputText.trim() && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim()}
                >
                  <Text style={styles.sendButtonText}>{">"}</Text>
                </Pressable>
              </Reanimated.View>
            )}
          </>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

/* ── Styles ────────────────────────────────────────────────── */

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    /* Shell — matches ItineraryDialogBox */
    bubble: {
      backgroundColor: colors.bg.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      overflow: "hidden",
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 1,
      borderColor: colors.border.subtle,
      marginBottom: -spacing.lg,
    },
    statusOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2,
    },
    statusText: {
      color: colors.text.secondary,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    sheenBeam: {
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
      zIndex: 5,
    },
    headerTitle: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    dismissButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bg.elevated,
      alignItems: "center",
      justifyContent: "center",
    },
    dismissText: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: "600",
    },

    /* 3-zone layout */
    expandedContainer: {
      flex: 1,
    },

    /* Zone 1: Narrator */
    narratorZone: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    narratorText: {
      color: colors.text.primary,
      fontSize: 15,
      lineHeight: 23,
      fontFamily: fontFamily.mono,
    },
    narratorDivider: {
      height: 1,
      backgroundColor: colors.border.subtle,
      marginTop: spacing.sm,
    },

    /* Zone 2: Content */
    contentZone: {
      flex: 1,
      paddingTop: spacing.sm,
    },
    optionsContainer: {
      flex: 1,
    },
    optionsScroll: {
      flex: 1,
    },
    optionsList: {
      gap: 6,
    },
    optionsColumns: {
      gap: 6,
    },
    optionRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    optionRowSpacer: {
      flex: 1,
    },
    optionRowSelected: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    optionRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    optionRowEmoji: {
      fontSize: 16,
    },
    optionRowLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
    },
    optionRowLabelSelected: {
      color: GREEN_ACCENT,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.border.medium,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: {
      backgroundColor: GREEN_ACCENT,
      borderColor: GREEN_ACCENT,
    },
    checkmark: {
      fontSize: 11,
      fontWeight: "800",
      color: "#0a2618",
      lineHeight: 13,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: colors.border.medium,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      borderColor: GREEN_ACCENT,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: GREEN_ACCENT,
    },

    /* Multi-select confirm */
    confirmRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: "auto",
      paddingTop: spacing.sm,
    },
    selectedCount: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.disabled,
      letterSpacing: 0.5,
    },
    confirmButton: {
      backgroundColor: GREEN_MUTED,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmButtonDisabled: {
      opacity: 0.35,
    },

    /* Zone 3: Input */
    inputZone: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.subtle,
    },
    textInput: {
      flex: 1,
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.primary,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: GREEN_MUTED,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      alignItems: "center",
      justifyContent: "center",
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
    sendButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 16,
      color: GREEN_ACCENT,
      fontWeight: "700",
    },
  });
