import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { RefreshCw } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import { EdLabel, EdBtn } from "@/components/Editorial";
import { edColors, edFont, edRadius, edShadows } from "@/theme/editorial";

const FEELING_EMOJIS = ["😬", "😐", "🙂", "😊", "✨"];

type Comeback = "tomorrow" | "sometime" | "never";
const COMEBACK_OPTIONS: { key: Comeback; label: string }[] = [
  { key: "tomorrow", label: "Tomorrow" },
  { key: "sometime", label: "Sometime" },
  { key: "never", label: "Never" },
];

function formatDateShort(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

function predictedFeelFromAnxiety(anxiety?: number): number | null {
  if (anxiety == null) return null;
  return Math.max(0, Math.min(4, 4 - anxiety));
}

function deltaLabel(felt: number, predicted: number | null): { text: string; color: string } | null {
  if (predicted == null) return null;
  const diff = felt - predicted;
  if (diff > 0) return { text: "↑ BETTER THAN GUESSED", color: edColors.coral };
  if (diff < 0) return { text: "↓ HARDER THAN GUESSED", color: edColors.inkSoft };
  return { text: "= AS GUESSED", color: edColors.inkMute };
}

export default function QuestReflectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [quest, setQuest] = useState<SidequestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feel, setFeel] = useState<number | null>(null);
  const [comeback, setComeback] = useState<Comeback | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient.sidequests
      .getById(id)
      .then(setQuest)
      .catch((err) => console.error("[QuestReflect] Failed to load:", err))
      .finally(() => setLoading(false));
  }, [id]);

  const firstObjective = quest?.objectives?.[0];
  const venueName = firstObjective?.venueName ?? quest?.title ?? "";
  const emoji = firstObjective?.emoji ?? "✨";

  const photoCaption = useMemo(() => {
    const now = new Date();
    const parts = [venueName, formatDateShort(now), formatTime(now)].filter(Boolean);
    return parts.join(" · ");
  }, [venueName]);

  const predictedFeel = useMemo(() => {
    const anxiety = (firstObjective as unknown as { predictedAnxiety?: number })
      ?.predictedAnxiety;
    return predictedFeelFromAnxiety(anxiety);
  }, [firstObjective]);

  const delta = feel != null ? deltaLabel(feel, predictedFeel) : null;

  const handleSelectFeel = useCallback((idx: number) => {
    Haptics.selectionAsync();
    setFeel(idx);
  }, []);

  const handleSelectComeback = useCallback((key: Comeback) => {
    Haptics.selectionAsync();
    setComeback(key);
  }, []);

  const handleStamp = useCallback(async () => {
    if (!quest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const calls: Promise<unknown>[] = [];

      if (feel != null) {
        const rating = feel + 1;
        const comment = comeback ? `come_back:${comeback}` : undefined;
        calls.push(apiClient.sidequests.rate(quest.id, rating, comment));
      }

      if (firstObjective && comeback) {
        calls.push(
          apiClient.sidequests.updateObjectiveJournal(firstObjective.id, {
            wouldReturn: comeback !== "never",
          }),
        );
      }

      await Promise.allSettled(calls);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("[QuestReflect] Save failed:", err);
    } finally {
      setSaving(false);
      router.replace("/itineraries");
    }
  }, [quest, feel, comeback, firstObjective, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={edColors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  if (!quest) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Quest not found.</Text>
          <EdBtn label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.topRow}>
        <EdLabel color={edColors.coral}>QUEST COMPLETE</EdLabel>
        <EdLabel>JUST NOW</EdLabel>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>
          You showed up.{"\n"}
          <Text style={styles.h1Italic}>How was it, really?</Text>
        </Text>

        {/* Photo card */}
        <View style={styles.photoShadow}>
          <View style={styles.photoClip}>
            <Svg
              style={StyleSheet.absoluteFill}
              width="100%"
              height="100%"
              preserveAspectRatio="none"
            >
              <Defs>
                <SvgLinearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#C8D6BE" stopOpacity={1} />
                  <Stop offset="55%" stopColor="#DCD3B2" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#D9B889" stopOpacity={1} />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#skyGrad)" />
            </Svg>
            {/* ground block (bottom 42%) */}
            <View style={styles.groundBlock} />
            {/* sun */}
            <View style={styles.sun} />
            {/* emoji */}
            <Text style={styles.photoEmoji}>{emoji}</Text>
            {/* caption pill */}
            <View style={styles.captionPillWrap} pointerEvents="none">
              <BlurView intensity={30} tint="dark" style={styles.captionBlur}>
                <Text style={styles.captionText}>{photoCaption}</Text>
              </BlurView>
            </View>
            {/* refresh */}
            <Pressable style={styles.refreshBtn} onPress={() => Haptics.selectionAsync()}>
              <RefreshCw size={14} color={edColors.ink} strokeWidth={1.6} />
            </Pressable>
          </View>
        </View>

        {/* Feeling row */}
        <View style={styles.feelingBlock}>
          <View style={styles.feelingHeader}>
            <Text style={styles.feelingLabel}>How did it feel?</Text>
            {delta ? (
              <Text style={[styles.deltaText, { color: delta.color }]}>{delta.text}</Text>
            ) : null}
          </View>
          <View style={styles.feelingRow}>
            {FEELING_EMOJIS.map((e, i) => {
              const selected = feel === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => handleSelectFeel(i)}
                  style={[
                    styles.feelTile,
                    selected ? styles.feelTileSelected : styles.feelTileUnselected,
                  ]}
                >
                  <Text
                    style={[
                      styles.feelEmoji,
                      { fontSize: selected ? 26 : 22 },
                    ]}
                  >
                    {e}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Come-back segmented */}
        <View style={styles.comebackBlock}>
          <Text style={styles.feelingLabel}>Would you come back?</Text>
          <View style={styles.segmented}>
            {COMEBACK_OPTIONS.map((opt) => {
              const selected = comeback === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => handleSelectComeback(opt.key)}
                  style={[
                    styles.segOption,
                    selected && styles.segOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.segText,
                      {
                        fontFamily: selected ? edFont.sansSemibold : edFont.sansMedium,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ height: 120 + insets.bottom }} />
      </ScrollView>

      <View
        style={[styles.footerFade, { height: 110 + insets.bottom }]}
        pointerEvents="none"
      >
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <Defs>
            <SvgLinearGradient id="reflectFade" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={edColors.paper} stopOpacity={0} />
              <Stop offset="40%" stopColor={edColors.paper} stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#reflectFade)" />
        </Svg>
      </View>
      <View style={[styles.footer, { bottom: 18 + insets.bottom }]}>
        <EdBtn
          label={saving ? "Saving…" : "Stamp it & close"}
          variant="primary"
          onPress={handleStamp}
          loading={saving}
          disabled={feel == null && comeback == null}
        />
      </View>
    </SafeAreaView>
  );
}

const PHOTO_ASPECT = 4 / 3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: edColors.paper },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontFamily: edFont.serifMedium,
    fontSize: 18,
    color: edColors.ink,
    letterSpacing: -0.3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 6,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 22 },
  h1: {
    fontFamily: edFont.serifRegular,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.7,
    color: edColors.ink,
    marginTop: 10,
  },
  h1Italic: {
    fontFamily: edFont.serifMediumItalic,
    color: edColors.coral,
  },

  // Photo card
  photoShadow: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: edColors.paperHi,
    ...edShadows.cardLifted,
  },
  photoClip: {
    aspectRatio: PHOTO_ASPECT,
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: edColors.rule,
    overflow: "hidden",
  },
  groundBlock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "42%",
    backgroundColor: edColors.sage,
    opacity: 0.75,
  },
  sun: {
    position: "absolute",
    top: "12%",
    right: "14%",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F4D27A",
    shadowColor: "#F4D27A",
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  photoEmoji: {
    position: "absolute",
    top: "24%",
    left: "12%",
    fontSize: 42,
  },
  captionPillWrap: {
    position: "absolute",
    bottom: 12,
    left: 12,
    borderRadius: 999,
    overflow: "hidden",
  },
  captionBlur: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(26,20,14,0.55)",
  },
  captionText: {
    fontFamily: edFont.sansMedium,
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: -0.05,
  },
  refreshBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Feeling
  feelingBlock: { marginTop: 18, gap: 10 },
  feelingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feelingLabel: {
    fontFamily: edFont.sansMedium,
    fontSize: 13,
    color: edColors.inkSoft,
    letterSpacing: -0.05,
  },
  deltaText: {
    fontFamily: edFont.monoMedium,
    fontSize: 10.5,
    letterSpacing: 1.6,
  },
  feelingRow: {
    flexDirection: "row",
    gap: 8,
  },
  feelTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  feelTileSelected: {
    backgroundColor: edColors.ink,
    transform: [{ translateY: -2 }],
    shadowColor: edColors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  feelTileUnselected: {
    backgroundColor: edColors.paperHi,
    borderWidth: 1,
    borderColor: edColors.rule,
  },
  feelEmoji: {},

  // Comeback
  comebackBlock: { marginTop: 16, gap: 10 },
  segmented: {
    flexDirection: "row",
    backgroundColor: edColors.paperDeep,
    borderRadius: 999,
    padding: 3,
  },
  segOption: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  segOptionSelected: {
    backgroundColor: edColors.paperHi,
    shadowColor: "#1A140E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  segText: {
    fontSize: 13,
    color: edColors.ink,
    letterSpacing: -0.05,
  },

  // Footer
  footerFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footer: {
    position: "absolute",
    left: 22,
    right: 22,
  },
});
