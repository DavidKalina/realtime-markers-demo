/**
 * CardOverlay — shared flippable card inspect/preview modal.
 *
 * Used by:
 *  - QuestCardDeck (long-press inspect)
 *  - PrescribeQuestCard (quest preview with accept/dismiss)
 */

import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useGyroTilt } from "@/hooks/useGyroTilt";
import {
  getCategoryColor,
} from "@/utils/categoryColors";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

// ── Dimensions ─────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const OVERLAY_CARD_W = SCREEN_WIDTH * 0.85;
const OVERLAY_CARD_H = OVERLAY_CARD_W * 1.4;
const FRAME_INSET = 5;
const GREEN_ACCENT = "#86efac";

// ── Tilt sheen shader ──────────────────────────────────────────────────

const TILT_SHEEN_SKSL = `
uniform float2 resolution;
uniform float tiltX;
uniform float tiltY;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  float diag = uv.x + uv.y;
  float center = 1.0 + tiltY * 0.06 + tiltX * 0.04;
  float bandWidth = 0.25;
  float dist = abs(diag - center) / bandWidth;
  float band = exp(-dist * dist * 2.0);
  float dist2 = abs(diag - center + 0.35) / (bandWidth * 1.4);
  float band2 = exp(-dist2 * dist2 * 2.0) * 0.3;
  float tiltMag = length(vec2(tiltX, tiltY));
  float intensity = smoothstep(1.0, 8.0, tiltMag);
  float alpha = (band + band2) * intensity * 0.6;
  vec3 color = vec3(1.0, 1.0, 1.0);
  return half4(color * alpha, alpha);
}
`;

const tiltSheenShader = Skia.RuntimeEffect.Make(TILT_SHEEN_SKSL)!;

// ── Helpers ────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  QUICK: "QUICK & EASY",
  SWEET_SPOT: "SWEET SPOT",
  BEST: "BEST PACKAGE",
};

const TIER_FALLBACK_COLORS: Record<string, string> = {
  QUICK: "#86efac",
  SWEET_SPOT: "#fbbf24",
  BEST: "#a855f7",
};

const RARITY_LABELS: Record<string, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

function hexToCardColors(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.12)`,
    text: `rgba(${r}, ${g}, ${b}, 0.9)`,
    border: `rgba(${r}, ${g}, ${b}, 0.25)`,
  };
}

function getCardColorKey(option: SidequestResponse): string {
  return (
    option.categories?.[0] ??
    option.activityTypes?.[0] ??
    option.tier ??
    "QUICK"
  );
}

// ── Props ──────────────────────────────────────────────────────────────

export interface CardOverlayProps {
  card: SidequestResponse | null;
  visible: boolean;
  onDismiss: () => void;
  /** If provided, shows an "Accept Quest" button instead of just close */
  onAccept?: () => void;
  isAccepting?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────

const CardOverlay: React.FC<CardOverlayProps> = React.memo(
  ({ card, visible, onDismiss, onAccept, isAccepting }) => {
    const colors = useColors();
    const s = useMemo(() => createStyles(colors), [colors]);
    const { tiltX, tiltY } = useGyroTilt(visible);
    const [isFlipped, setIsFlipped] = useState(false);

    const backdropOpacity = useSharedValue(0);
    const cardScale = useSharedValue(0.88);
    const cardOpacity = useSharedValue(0);
    const flip = useSharedValue(0);

    useEffect(() => {
      if (visible && card) {
        backdropOpacity.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.ease),
        });
        cardScale.value = withSpring(1, { damping: 16, stiffness: 130 });
        cardOpacity.value = withTiming(1, { duration: 250 });
        flip.value = 0;
        setIsFlipped(false);
      }
    }, [visible, card?.id]);

    const handleFlip = useCallback(() => {
      const next = !isFlipped;
      setIsFlipped(next);
      flip.value = withSpring(next ? 1 : 0, {
        damping: 18,
        stiffness: 120,
        mass: 0.8,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [isFlipped, flip]);

    const dismiss = useCallback(() => {
      cardScale.value = withTiming(0.85, {
        duration: 250,
        easing: Easing.in(Easing.cubic),
      });
      cardOpacity.value = withTiming(0, { duration: 200 });
      backdropOpacity.value = withTiming(
        0,
        { duration: 300, easing: Easing.in(Easing.ease) },
        () => {
          scheduleOnRN(onDismiss);
        },
      );
    }, [onDismiss]);

    const backdropStyle = useAnimatedStyle(() => ({
      opacity: backdropOpacity.value,
    }));

    const cardContainerStyle = useAnimatedStyle(() => ({
      opacity: cardOpacity.value,
      transform: [
        { scale: cardScale.value },
        { translateX: tiltY.value * 0.5 },
        { translateY: -tiltX.value * 0.5 },
      ],
    }));

    const frontFaceStyle = useAnimatedStyle(() => ({
      opacity: interpolate(flip.value, [0, 0.45, 0.55, 1], [1, 1, 0, 0]),
      transform: [
        {
          scale: interpolate(
            flip.value,
            [0, 0.25, 0.5, 0.75, 1],
            [1, 0.95, 0.9, 0.95, 1],
          ),
        },
      ],
    }));

    const backFaceStyle = useAnimatedStyle(() => ({
      opacity: interpolate(flip.value, [0, 0.45, 0.55, 1], [0, 0, 1, 1]),
      transform: [
        {
          scale: interpolate(
            flip.value,
            [0, 0.25, 0.5, 0.75, 1],
            [1, 0.95, 0.9, 0.95, 1],
          ),
        },
      ],
    }));

    const sheenUniforms = useDerivedValue(() => ({
      resolution: [OVERLAY_CARD_W, OVERLAY_CARD_H] as [number, number],
      tiltX: tiltX.value,
      tiltY: tiltY.value,
    }));

    if (!card) return null;

    const colorKey = getCardColorKey(card);
    const cardHex =
      getCategoryColor(colorKey) ??
      TIER_FALLBACK_COLORS[card.tier ?? "QUICK"] ??
      TIER_FALLBACK_COLORS.QUICK;
    const tierMeta = {
      label:
        card.rarity
          ? (RARITY_LABELS[card.rarity.toLowerCase()] ?? card.rarity.toUpperCase())
          : (TIER_LABELS[card.tier ?? "QUICK"] ?? TIER_LABELS.QUICK),
      ...hexToCardColors(cardHex),
    };
    const objectives = (card.objectives ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const totalCost = objectives.reduce(
      (sum, o) => sum + (Number(o.estimatedCost) || 0),
      0,
    );
    const cardTags: string[] = [];
    for (const c of card.categories ?? []) cardTags.push(c.toUpperCase());
    for (const a of card.activityTypes ?? []) {
      const u = a.toUpperCase();
      if (!cardTags.includes(u)) cardTags.push(u);
    }

    const objective = objectives[0];
    const distanceMi =
      card.distanceFromHome != null ? Number(card.distanceFromHome) : null;

    const renderCardFace = (face: "front" | "back") => (
      <View
        style={[
          s.card,
          { borderColor: tierMeta.text },
        ]}
      >
        {face === "front" && tiltSheenShader && (
          <Canvas
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: OVERLAY_CARD_W,
              height: OVERLAY_CARD_H,
              zIndex: 5,
            }}
            pointerEvents="none"
          >
            <Fill>
              <Shader source={tiltSheenShader} uniforms={sheenUniforms} />
            </Fill>
          </Canvas>
        )}

        <Pressable style={s.cardInner} onPress={handleFlip}>
          {/* HEADER */}
          <View style={s.headerBand}>
            {face === "front" ? (
              <>
                <Text style={[s.headerTier, { color: tierMeta.text }]}>
                  {"\u2605"} {tierMeta.label}
                </Text>
                <View style={{ flex: 1 }} />
                {(() => {
                  const cats = (card.categories ?? []).slice(0, 2);
                  if (cats.length === 0) return null;
                  return (
                    <Text style={s.headerCats}>
                      {cats.map((c) => c.toUpperCase()).join(" \u00B7 ")}
                    </Text>
                  );
                })()}
              </>
            ) : (
              <Text style={[s.headerTier, { color: tierMeta.text }]}>
                {"\u2728"} ACTIVITIES
              </Text>
            )}
          </View>

          {/* ART ZONE */}
          <View style={[s.artZone, { borderColor: tierMeta.border }]}>
            <View style={s.artOverlay} />
            <Text style={s.artEmoji}>
              {objective?.emoji ?? "\u{1F3AF}"}
            </Text>
            {face === "front" && distanceMi != null && (
              <Text style={s.artCorner}>
                {distanceMi < 0.1 ? "< 0.1 MI" : `${distanceMi.toFixed(1)} MI`}
              </Text>
            )}
            {face === "back" && (
              <Text style={s.artCorner}>
                {(objective?.venueName ?? "").toUpperCase().slice(0, 24)}
              </Text>
            )}
          </View>

          {/* TITLE */}
          <View style={s.titlePlate}>
            {face === "front" ? (
              <>
                <Text style={s.title} numberOfLines={2}>
                  {card.title ?? "Sidequest"}
                </Text>
                {card.summary && (
                  <Text style={s.subtitle} numberOfLines={1}>
                    {card.summary.toUpperCase().split(/[.,:!]/, 1)[0].slice(0, 28)}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={s.title} numberOfLines={1}>
                  {objective?.venueName ?? objective?.title ?? "Activities"}
                </Text>
                <Text style={s.subtitle}>IDEAS FOR YOUR VISIT</Text>
              </>
            )}
          </View>

          {/* STOPS / ACTIVITIES */}
          <View style={s.stopsSection}>
            {face === "front"
              ? objectives.slice(0, 3).map((obj, i) => (
                  <View key={obj.id ?? i} style={s.stopRow}>
                    <View
                      style={[
                        s.stopCircle,
                        {
                          borderColor: tierMeta.border,
                          backgroundColor: obj.checkedInAt ? tierMeta.bg : "transparent",
                        },
                      ]}
                    >
                      <Text style={s.stopEmoji}>{obj.emoji ?? "\u{1F4CD}"}</Text>
                    </View>
                    <View style={s.stopText}>
                      <Text style={s.stopName}>
                        {(obj.venueName || obj.title || "Stop").split("|")[0].trim()}
                      </Text>
                      {obj.hook && (
                        <Text style={s.stopHook} numberOfLines={1}>{obj.hook}</Text>
                      )}
                    </View>
                  </View>
                ))
              : (objective?.suggestedActivities ?? []).map((activity) => {
                  const emoji = activity.match(/^\p{Emoji_Presentation}/u)?.[0];
                  const label = emoji ? activity.slice(emoji.length).trim() : activity;
                  return (
                    <View key={activity} style={s.stopRow}>
                      <View style={[s.stopCircle, { borderColor: tierMeta.border }]}>
                        <Text style={s.stopEmoji}>{emoji ?? "\u2728"}</Text>
                      </View>
                      <View style={s.stopText}>
                        <Text style={s.stopName}>{label}</Text>
                      </View>
                    </View>
                  );
                })}
            {face === "front" && objectives.length > 3 && (
              <Text style={s.moreStops}>+{objectives.length - 3} more</Text>
            )}
          </View>

          {/* FLAVOR TEXT */}
          {face === "front" && card.summary && objectives.length <= 3 && (
            <View style={[s.flavorBlock, { borderColor: tierMeta.border }]}>
              <Text style={s.flavorText}>
                {"\u201C"}{card.summary.split(/[.!]/)[0].trim()}.{"\u201D"}
              </Text>
              <Text style={s.flavorAttrib}>{"\u2014"} Quest lore</Text>
            </View>
          )}
          {face === "back" && objective?.journalPrompt && (
            <View style={[s.flavorBlock, { borderColor: tierMeta.border }]}>
              <Text style={s.flavorText}>
                {"\u201C"}{objective.journalPrompt}{"\u201D"}
              </Text>
              <Text style={s.flavorAttrib}>{"\u2014"} After your visit</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          {face === "front" ? (
            <>
              <View style={s.tagRow}>
                {cardTags.slice(0, 3).map((tag) => (
                  <View key={tag} style={[s.tagChip, { borderColor: tierMeta.border }]}>
                    <Text style={[s.tagText, { color: tierMeta.text }]}>{tag}</Text>
                  </View>
                ))}
              </View>
              <View style={s.serialRow}>
                <Text style={s.serialNumber}>
                  SQ{"\u00B7"}{(card.id ?? "").slice(0, 8).toUpperCase()}
                </Text>
                <Text style={s.serialStat}>
                  {"\u00B7"} {objectives.length} STOP{objectives.length !== 1 ? "S" : ""}
                  {totalCost > 0 ? ` \u00B7 $${totalCost}` : ""}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={s.serialStat}>{card.city?.toUpperCase() ?? ""}</Text>
              </View>
            </>
          ) : (
            <View style={s.statsBlock}>
              <View style={[s.statCell, { borderColor: tierMeta.border }]}>
                <Text style={s.statLabel}>DIFFICULTY</Text>
                <Text style={[s.statValue, { color: tierMeta.text }]}>
                  {(() => {
                    const d = Number(objective?.difficulty ?? 1);
                    const dots = ["", "\u2022", "\u2022\u2022", "\u2022\u2022\u2022", "\u2022\u2022\u2022\u2022", "\u2022\u2022\u2022\u2022\u2022"];
                    return dots[Math.min(d, 5)] || "\u2022";
                  })()}
                </Text>
              </View>
              <View style={[s.statCell, { borderColor: tierMeta.border }]}>
                <Text style={s.statLabel}>DISTANCE</Text>
                <Text style={s.statValue}>
                  {distanceMi != null ? (distanceMi < 0.1 ? "<0.1" : distanceMi.toFixed(1)) : "?"}
                </Text>
                <Text style={s.statLabel}>MI</Text>
              </View>
              <View style={[s.statCell, { borderColor: tierMeta.border }]}>
                <Text style={s.statLabel}>COST</Text>
                <Text style={s.statValue}>{totalCost > 0 ? `$${totalCost}` : "FREE"}</Text>
              </View>
            </View>
          )}
        </Pressable>
      </View>
    );

    return (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <View style={s.root}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
          </Animated.View>

          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

          {/* Close button */}
          <Pressable
            style={s.closeButton}
            hitSlop={16}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dismiss();
            }}
          >
            <X size={18} color={colors.text.secondary} />
          </Pressable>

          {/* Flippable card */}
          <Animated.View style={[s.cardWrap, cardContainerStyle]}>
            <View style={s.flipContainer}>
              <Animated.View style={[s.face, frontFaceStyle]}>
                {renderCardFace("front")}
              </Animated.View>
              <Animated.View style={[s.face, backFaceStyle]}>
                {renderCardFace("back")}
              </Animated.View>
            </View>
          </Animated.View>

          {/* Flip hint */}
          <View style={s.flipHintWrap}>
            <Text style={s.flipHint}>
              {isFlipped ? "TAP TO FLIP BACK" : "TAP CARD TO SEE ACTIVITIES"}
            </Text>
          </View>

          {/* Accept buttons (prescribe mode) */}
          {onAccept && (
            <View style={s.acceptArea}>
              <Pressable
                style={s.acceptButton}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  onAccept();
                }}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={s.acceptText}>Accept Quest</Text>
                )}
              </Pressable>
              <Pressable style={s.dismissBtn} onPress={dismiss}>
                <Text style={s.dismissText}>Not this one</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    );
  },
);

CardOverlay.displayName = "CardOverlay";

// ── Styles ─────────────────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
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
    cardWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    flipContainer: {
      width: OVERLAY_CARD_W,
      height: OVERLAY_CARD_H,
      alignItems: "center",
      justifyContent: "center",
    },
    face: {
      position: "absolute",
      width: OVERLAY_CARD_W,
      height: OVERLAY_CARD_H,
      alignItems: "center",
    },
    flipHintWrap: {
      position: "absolute",
      bottom: 80,
      alignSelf: "center",
    },
    flipHint: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: "rgba(255, 255, 255, 0.35)",
      letterSpacing: 1.5,
    },

    // Card shell
    card: {
      width: OVERLAY_CARD_W,
      height: OVERLAY_CARD_H,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.xl,
      borderWidth: 2.5,
      overflow: "hidden",
      shadowColor: colors.fixed?.black ?? "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
      elevation: 14,
    },
    cardInner: {
      flex: 1,
      margin: FRAME_INSET,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      borderColor: colors.border.default,
      overflow: "hidden",
    },
    headerBand: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    headerTier: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
    },
    headerCats: {
      fontSize: 8,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.8,
    },
    artZone: {
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: spacing.sm,
      height: 110,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    artOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.15)",
      borderRadius: radius.sm - 3,
    },
    artEmoji: {
      fontSize: 64,
      textShadowColor: "rgba(0, 0, 0, 0.6)",
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 12,
    },
    artCorner: {
      position: "absolute",
      top: 6,
      right: 10,
      fontSize: 8,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    titlePlate: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    title: {
      fontSize: 16,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 21,
    },
    subtitle: {
      fontSize: 8,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      letterSpacing: 1.2,
      marginTop: 2,
    },
    stopsSection: {
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
    stopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    stopCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    stopEmoji: { fontSize: 14 },
    stopText: {
      flex: 1,
      paddingTop: 2,
      gap: 1,
    },
    stopName: {
      fontSize: 12,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    stopHook: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    moreStops: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      paddingLeft: 42,
    },
    flavorBlock: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    flavorText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      fontStyle: "italic",
      lineHeight: 15,
    },
    flavorAttrib: {
      fontSize: 7,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      marginTop: 2,
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginTop: spacing.xs,
    },
    tagChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
    },
    tagText: {
      fontSize: 7,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.8,
    },
    serialRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingTop: 3,
      paddingBottom: 3,
      marginTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.default,
    },
    serialNumber: {
      fontSize: 7,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.2,
      opacity: 0.5,
    },
    serialStat: {
      fontSize: 7,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 1.2,
    },
    statsBlock: {
      flexDirection: "row",
      marginHorizontal: spacing.sm,
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.xs,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      gap: 1,
    },
    statLabel: {
      fontSize: 7,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      letterSpacing: 0.8,
    },
    statValue: {
      fontSize: 13,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },

    // Accept area (prescribe mode)
    acceptArea: {
      position: "absolute",
      bottom: 40,
      width: OVERLAY_CARD_W,
      alignItems: "center",
      gap: spacing.sm,
    },
    acceptButton: {
      backgroundColor: GREEN_ACCENT,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      width: "100%",
      alignItems: "center",
    },
    acceptText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#000000",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    dismissBtn: {
      paddingVertical: spacing.sm,
    },
    dismissText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
  });

export default CardOverlay;
