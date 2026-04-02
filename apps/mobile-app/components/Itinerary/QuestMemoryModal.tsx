import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import type {
  ObjectiveResponse,
  SidequestResponse,
} from "@/services/api/modules/sidequests";
import { getCategoryColor } from "@/utils/categoryColors";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useCallback } from "react";

// ── Social context display ───────────────────────────────────

const SOCIAL_LABELS: Record<string, { emoji: string; label: string }> = {
  solo: { emoji: "\uD83E\uDDD1", label: "Solo" },
  with_someone: { emoji: "\uD83D\uDC6B", label: "With someone" },
  met_someone_new: { emoji: "\uD83D\uDC4B", label: "Met someone new" },
  group_activity: { emoji: "\uD83D\uDC65", label: "Group activity" },
};

// ── Rarity colors ────────────────────────────────────────────

const RARITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  common: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.5)" },
  uncommon: { bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.25)", text: "rgba(74,222,128,0.9)" },
  rare: { bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.25)", text: "rgba(96,165,250,0.9)" },
  epic: { bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.25)", text: "rgba(168,85,247,0.9)" },
  legendary: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", text: "rgba(251,191,36,1)" },
};

// ── Helpers ──────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Parallax widget (same pattern as CheckinCaptureModal) ────

const PARALLAX = [1.0, 0.94, 0.88, 0.82, 0.76, 0.72, 0.68, 0.64];

const ParallaxWidget: React.FC<{
  scrollY: SharedValue<number>;
  index: number;
  enterDelay: number;
  children: React.ReactNode;
}> = ({ scrollY, index, enterDelay, children }) => {
  const rate = PARALLAX[index] ?? 0.64;

  const parallaxStyle = useAnimatedStyle(() => {
    const offset = scrollY.value * (1 - rate);
    return { transform: [{ translateY: -offset }] };
  });

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).duration(400)}
      style={parallaxStyle}
    >
      {children}
    </Animated.View>
  );
};

// ── Component ────────────────────────────────────────────────

interface QuestMemoryModalProps {
  quest: SidequestResponse | null;
  visible: boolean;
  onDismiss: () => void;
}

export function QuestMemoryModal({
  quest,
  visible,
  onDismiss,
}: QuestMemoryModalProps) {
  const colors = useColors();
  const scrollY = useSharedValue(0);

  const obj = quest?.objectives?.[0];
  const category = obj?.venueCategory ?? "other";
  const accentHex = getCategoryColor(category);
  const [ar, ag, ab] = useMemo(() => hexToRgb(accentHex), [accentHex]);

  const s = useMemo(
    () => createStyles(colors, accentHex, ar, ag, ab),
    [colors, accentHex, ar, ag, ab],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  if (!visible || !quest || !obj) return null;

  const social = obj.socialContext
    ? SOCIAL_LABELS[obj.socialContext]
    : null;
  const rarityKey = (quest.rarity ?? "common").toLowerCase();
  const rarityStyle = RARITY_COLORS[rarityKey] ?? RARITY_COLORS.common;

  let widgetIdx = 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={s.container}
      >
        <BlurView
          tint="dark"
          intensity={60}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Close */}
        <Pressable style={s.closeButton} hitSlop={16} onPress={onDismiss}>
          <X size={18} color={colors.text.secondary} />
        </Pressable>

        <Animated.ScrollView
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={100}>
            <View style={s.headerWidget}>
              <Text style={s.headerEmoji}>
                {obj.emoji || "\u2728"}
              </Text>
              <Text style={s.headerTitle}>
                {quest.title ?? "Sidequest"}
              </Text>
              <View style={s.labelRow}>
                <View style={s.labelPill}>
                  <Text style={s.labelPillText}>COMPLETED</Text>
                </View>
                <Text style={s.dot}> · </Text>
                <Text style={s.meta}>{quest.city}</Text>
                {quest.completedAt && (
                  <>
                    <Text style={s.dot}> · </Text>
                    <Text style={s.meta}>{formatDate(quest.completedAt)}</Text>
                  </>
                )}
              </View>
            </View>
          </ParallaxWidget>

          {/* ── Summary ── */}
          {quest.summary && (
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={200}>
              <Text style={s.summary}>{quest.summary}</Text>
            </ParallaxWidget>
          )}

          {/* ── Stat chips ── */}
          <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={250}>
            <View style={s.chipRow}>
              <View style={[s.chip, { backgroundColor: rarityStyle.bg, borderColor: rarityStyle.border }]}>
                <Text style={[s.chipText, { color: rarityStyle.text }]}>
                  {rarityKey.toUpperCase()}
                </Text>
              </View>
              {quest.distanceFromHome != null && (
                <View style={s.chip}>
                  <Text style={s.chipText}>
                    {Number(quest.distanceFromHome).toFixed(1)} mi
                  </Text>
                </View>
              )}
              {obj.difficulty != null && (
                <View style={s.chip}>
                  <Text style={s.chipText}>
                    Difficulty {obj.difficulty}/5
                  </Text>
                </View>
              )}
              {quest.rating != null && quest.rating > 0 && (
                <View style={s.chip}>
                  <Text style={s.chipText}>
                    {"\u2605".repeat(quest.rating)}{"\u2606".repeat(5 - quest.rating)}
                  </Text>
                </View>
              )}
            </View>
          </ParallaxWidget>

          {/* ── Venue ── */}
          <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={350}>
            <Text style={s.widgetLabel}>VENUE</Text>
            <View style={s.venueCard}>
              <View style={s.venueHeader}>
                <View style={s.emojiCircle}>
                  <Text style={s.emojiText}>{obj.emoji || "\uD83D\uDCCD"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.venueName}>{obj.venueName ?? obj.title}</Text>
                  {obj.venueCategory && (
                    <Text style={s.venueCategory}>{obj.venueCategory}</Text>
                  )}
                </View>
              </View>
              {obj.venueAddress && (
                <Text style={s.address}>{obj.venueAddress}</Text>
              )}
            </View>
          </ParallaxWidget>

          {/* ── Hook ── */}
          {obj.hook && (
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={400}>
              <Text style={s.widgetLabel}>WHY THIS STOP</Text>
              <View style={s.hookCard}>
                <Text style={s.hookText}>{obj.hook}</Text>
              </View>
            </ParallaxWidget>
          )}

          {/* ── What you did ── */}
          {obj.completedActivity && (
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={450}>
              <Text style={s.widgetLabel}>WHAT YOU DID</Text>
              <Text style={s.bodyText}>{obj.completedActivity}</Text>
            </ParallaxWidget>
          )}

          {/* ── Social context ── */}
          {social && (
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={500}>
              <Text style={s.widgetLabel}>WHO YOU WERE WITH</Text>
              <View style={s.socialChip}>
                <Text style={s.socialText}>
                  {social.emoji} {social.label}
                </Text>
              </View>
            </ParallaxWidget>
          )}

          {/* ── Photo ── */}
          {obj.photoUrl && (
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={550}>
              <Text style={s.widgetLabel}>PHOTO</Text>
              <View style={s.photoContainer}>
                <Image
                  source={{ uri: obj.photoUrl }}
                  style={s.photo}
                  resizeMode="cover"
                />
              </View>
            </ParallaxWidget>
          )}

          {/* ── Journal ── */}
          {obj.journalEntry && (
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={600}>
              <Text style={s.widgetLabel}>
                {obj.journalPrompt
                  ? `\u201C${obj.journalPrompt}\u201D`
                  : "JOURNAL"}
              </Text>
              <View style={s.journalCard}>
                <Text style={s.journalText}>{obj.journalEntry}</Text>
              </View>
            </ParallaxWidget>
          )}
        </Animated.ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────

const createStyles = (
  colors: Colors,
  accentHex: string,
  ar: number,
  ag: number,
  ab: number,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    closeButton: {
      position: "absolute",
      top: 56,
      right: 20,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    scrollContent: {
      paddingTop: 100,
      paddingHorizontal: 28,
      paddingBottom: 80,
      gap: spacing["2xl"],
    },

    // ── Header ──
    headerWidget: {
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    headerEmoji: {
      fontSize: 48,
      textShadowColor: "rgba(0, 0, 0, 0.4)",
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 12,
    },
    headerTitle: {
      fontFamily: fontFamily.display,
      fontSize: 22,
      color: colors.text.primary,
      textAlign: "center",
      lineHeight: 28,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    labelPill: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.1)`,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    labelPillText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: accentHex,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    dot: {
      fontSize: 11,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
    },
    meta: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },

    summary: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 20,
      textAlign: "center",
    },

    // ── Widget label (matches CheckinCaptureModal) ──
    widgetLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
    },

    // ── Chips ──
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
    },
    chip: {
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.08)`,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipText: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: accentHex,
    },

    // ── Venue ──
    venueCard: {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    venueHeader: {
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "center",
    },
    emojiCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.1)`,
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiText: {
      fontSize: 22,
    },
    venueName: {
      fontSize: 16,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 22,
    },
    venueCategory: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      marginTop: 2,
    },
    address: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 18,
    },

    // ── Hook ──
    hookCard: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.06)`,
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.15)`,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    hookText: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.primary,
      lineHeight: 20,
      fontStyle: "italic",
    },

    // ── Body text ──
    bodyText: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 20,
    },

    // ── Social ──
    socialChip: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.08)`,
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
      borderRadius: radius.full,
      paddingHorizontal: 14,
      paddingVertical: 8,
      alignSelf: "flex-start",
    },
    socialText: {
      fontSize: 13,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: accentHex,
    },

    // ── Photo ──
    photoContainer: {
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    photo: {
      width: "100%",
      height: 220,
      borderRadius: radius.lg,
    },

    // ── Journal ──
    journalCard: {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    journalText: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.primary,
      lineHeight: 22,
      fontStyle: "italic",
    },
  });
