/**
 * CardOverlay — shared flippable card inspect/preview modal.
 *
 * Used by:
 *  - QuestCardDeck (long-press inspect)
 *  - BatchRevealOverlay (week pack quest reveal with accept/dismiss)
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
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useGyroTilt, GyroTiltDebugPanel } from "@/hooks/useGyroTilt";
import {
  getCategoryColor,
  getFoilVariant,
  getQuestPurpose,
  PURPOSE_COLORS,
  PURPOSE_FOILS,
  PURPOSE_LABELS,
} from "@/utils/categoryColors";
import HolographicFoil, { hashString } from "@/components/effects/HolographicFoil";
import type { FoilVariant } from "@/components/effects/HolographicFoil";
import { QUEST_ROLE_LABELS } from "@realtime-markers/shared";
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

// ── Tilt sheen shader ──────────────────────────────────────────────────

const TILT_SHEEN_SKSL = `
uniform float2 resolution;
uniform float tiltX;
uniform float tiltY;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  float diag = uv.x + uv.y;

  // Normalize tilt from ±18 deg to ±1 range
  float normX = tiltX / 18.0;
  float normY = tiltY / 18.0;

  // Sheen band center sweeps across the full diagonal (0..2) with tilt
  float center = 1.0 + normY * 0.8 + normX * 0.5;
  float bandWidth = 0.28;
  float dist = abs(diag - center) / bandWidth;
  float band = exp(-dist * dist * 2.0);

  // Secondary softer band for depth
  float dist2 = abs(diag - center + 0.4) / (bandWidth * 1.5);
  float band2 = exp(-dist2 * dist2 * 2.0) * 0.25;

  // Intensity ramps up with any tilt movement
  float tiltMag = length(vec2(normX, normY));
  float intensity = smoothstep(0.05, 0.5, tiltMag);

  float alpha = (band + band2) * intensity * 0.6;
  vec3 color = vec3(1.0, 1.0, 1.0);
  return half4(color * alpha, alpha);
}
`;

const tiltSheenShader = Skia.RuntimeEffect.Make(TILT_SHEEN_SKSL)!;

// ── Helpers ────────────────────────────────────────────────────────────

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
    option.objectives?.find((o) => o.venueCategory)?.venueCategory ??
    option.activityTypes?.[0] ??
    option.rarity ??
    "common"
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
    const { tiltX, tiltY, debugOverride, setDebugOverride } =
      useGyroTilt(visible);
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
    const cardHex = getCategoryColor(colorKey);
    const rarityKey = (card.rarity ?? "common").toLowerCase();
    const tierMeta = {
      label: RARITY_LABELS[rarityKey] ?? RARITY_LABELS.common,
      ...hexToCardColors(cardHex),
    };
    const purpose = getQuestPurpose(card);
    const purposeColor = PURPOSE_COLORS[purpose] ?? "#7dd3fc";
    const cardAccent = !card.promotedAt ? purposeColor : tierMeta.text;
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
          { borderColor: `${cardAccent}66` },
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

        {/* Foil overlay — promoted cards get rarity foil, unpromoted get role foil */}
        {card.promotedAt && (
          <HolographicFoil
            width={OVERLAY_CARD_W}
            height={OVERLAY_CARD_H}
            variant={getFoilVariant(
              card.rarity,
              colorKey,
              card.distanceFromHome,
            )}
            seed={hashString(card.id)}
            intensity={0.12}
          />
        )}
        {!card.promotedAt && (
          <HolographicFoil
            width={OVERLAY_CARD_W}
            height={OVERLAY_CARD_H}
            variant={(PURPOSE_FOILS[purpose] ?? "role_explore") as FoilVariant}
            seed={hashString(card.id)}
            intensity={(() => {
              const diff = card.objectives?.[0]?.difficulty ?? 5;
              if (diff <= 3) return 0.05;
              if (diff <= 6) return 0.1;
              return 0.14;
            })()}
          />
        )}

        <Pressable style={s.cardInner} onPress={handleFlip}>
          {/* HEADER */}
          <View style={s.headerBand}>
            {face === "front" ? (
              <>
                {card.promotedAt && card.rarity ? (
                  <Text style={[s.headerTier, { color: tierMeta.text }]}>
                    {"\u2605"} {tierMeta.label}
                  </Text>
                ) : (
                  <Text style={[s.headerTier, { color: purposeColor }]}>
                    {PURPOSE_LABELS[purpose] ?? purpose.toUpperCase()}
                  </Text>
                )}
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
                          borderColor: `${cardAccent}44`,
                          backgroundColor: obj.checkedInAt ? `${cardAccent}18` : "transparent",
                        },
                      ]}
                    >
                      <Text style={s.stopEmoji}>{obj.emoji ?? "\u{1F4CD}"}</Text>
                    </View>
                    <View style={s.stopText}>
                      <Text style={s.stopName} numberOfLines={1}>
                        {(obj.venueName || obj.title || "Stop").split("|")[0].trim()}
                      </Text>
                    </View>
                  </View>
                ))
              : [...(objective?.suggestedActivities ?? []), ...(objective?.actionItems ?? [])].map((activity) => {
                  const emoji = activity.match(/^\p{Emoji_Presentation}/u)?.[0];
                  const label = emoji ? activity.slice(emoji.length).trim() : activity;
                  return (
                    <View key={activity} style={s.stopRow}>
                      <View style={[s.stopCircle, { borderColor: `${cardAccent}44` }]}>
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

          {/* QUEST STATS (front) */}
          {face === "front" && (() => {
            const diff = Math.min(Number(objective?.difficulty ?? 1), 10);
            const dist = card.distanceFromHome != null ? Number(card.distanceFromHome) : null;
            const diffPct = (diff / 10) * 100;
            const distPct = dist != null ? Math.min(dist / 10, 1) * 100 : 0;
            const costPct = totalCost > 0 ? Math.min(totalCost / 50, 1) * 100 : 0;
            return (
              <View style={s.statsBlock}>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>Difficulty</Text>
                  <View style={s.statBarTrack}>
                    <View style={[s.statBarFill, { width: `${diffPct}%`, backgroundColor: cardAccent }]} />
                  </View>
                  <Text style={[s.statValue, { color: cardAccent }]}>{diff}/10</Text>
                </View>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>Distance</Text>
                  <View style={s.statBarTrack}>
                    <View style={[s.statBarFill, { width: `${distPct}%`, backgroundColor: cardAccent }]} />
                  </View>
                  <Text style={[s.statValue, { color: cardAccent }]}>
                    {dist != null ? (dist < 0.1 ? "<0.1" : dist.toFixed(1)) : "?"} mi
                  </Text>
                </View>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>Cost</Text>
                  <View style={s.statBarTrack}>
                    <View style={[s.statBarFill, { width: `${costPct}%`, backgroundColor: cardAccent }]} />
                  </View>
                  <Text style={[s.statValue, { color: cardAccent }]}>
                    {totalCost > 0 ? `$${totalCost}` : "FREE"}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* FLAVOR TEXT */}
          {face === "front" && (objective?.hook || card.summary) && objectives.length <= 3 ? (
            <View style={[s.flavorBlock, { flex: 1, overflow: "hidden" }]}>
              <Text style={s.flavorText} numberOfLines={5}>
                {"\u201C"}{(objective?.hook ?? card.summary ?? "").split(/[.!]/)[0].trim()}.{"\u201D"}
              </Text>
            </View>
          ) : face === "front" ? (
            <View style={{ flex: 1 }} />
          ) : null}

          {/* BACK FACE CONTENT */}
          {face === "back" && objective?.journalPrompt && (
            <View style={s.flavorBlock}>
              <Text style={s.flavorText}>
                {"\u201C"}{objective.journalPrompt}{"\u201D"}
              </Text>
              <Text style={s.flavorAttrib}>{"\u2014"} After your visit</Text>
            </View>
          )}

          {face === "back" && objective?.hook && (
            <View style={s.flavorBlock}>
              <Text style={s.flavorText}>{objective.hook}</Text>
              <Text style={s.flavorAttrib}>{"\u2014"} Why this stop</Text>
            </View>
          )}

          {(face === "front" || face === "back") && <View style={{ flex: 1 }} />}

          <View style={s.serialRow}>
            <Text style={s.serialNumber}>
              SQ{"\u00B7"}{(card.id ?? "").slice(0, 8).toUpperCase()}
            </Text>
            {face === "front" && (
              <Text style={s.serialStat}>
                {"\u00B7"} {objectives.length} STOP{objectives.length !== 1 ? "S" : ""}
              </Text>
            )}
            <View style={{ flex: 1 }} />
            <Text style={s.serialStat}>{card.city?.toUpperCase() ?? ""}</Text>
          </View>
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

          {/* Flippable card with 3D tilt */}
          <Animated.View style={[s.cardWrap, cardContainerStyle]}>
            {/* Front face — normal flow, defines the container size */}
            <Animated.View style={frontFaceStyle}>
              {renderCardFace("front")}
            </Animated.View>
            {/* Back face — overlaid on top */}
            <Animated.View style={[s.backFace, backFaceStyle]}>
              {renderCardFace("back")}
            </Animated.View>
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

          {__DEV__ && (
            <GyroTiltDebugPanel
              tiltX={tiltX}
              tiltY={tiltY}
              debugOverride={debugOverride}
              setDebugOverride={setDebugOverride}
            />
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
    backFace: {
      ...StyleSheet.absoluteFillObject,
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
      borderWidth: 1.5,
      overflow: "hidden",
      shadowColor: colors.fixed?.black ?? "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    },
    cardInner: {
      flex: 1,
      margin: FRAME_INSET,
      borderRadius: radius.sm - 3,
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
      height: 90,
      borderRadius: radius.sm - 3,
      backgroundColor: "rgba(0, 0, 0, 0.15)",
    },
    artOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.06)",
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
      borderWidth: 1,
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
      backgroundColor: "rgba(255, 255, 255, 0.04)",
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
    // ── Quest stats (row bars) ──
    statsBlock: {
      marginHorizontal: spacing.sm,
      marginTop: spacing.lg,
      gap: spacing._10,
    },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
      width: 68,
    },
    statBarTrack: {
      flex: 1,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      overflow: "hidden",
    },
    statBarFill: {
      height: 3,
      borderRadius: 1.5,
    },
    statValue: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      width: 44,
      textAlign: "right",
    },
    serialRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      marginTop: spacing.sm,
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
    // ── Back face activities ──
    backActivities: {
      paddingHorizontal: spacing.sm,
      marginTop: spacing.md,
      gap: 2,
    },
    backActivitiesLabel: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.2,
      marginBottom: spacing.xs,
    },
    backActivityItem: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 20,
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
      backgroundColor: colors.accent.primary,
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
