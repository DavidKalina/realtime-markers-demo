import React, { useCallback, useEffect, useState } from "react";
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
import { ArrowLeft, Share2 } from "lucide-react-native";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import { EdLabel, EdBtn } from "@/components/Editorial";
import { edColors, edFont, edRadius, edShadows } from "@/theme/editorial";

type CategoryColor = "coral" | "amber" | "sage" | "sky";

const COLOR_HEX: Record<CategoryColor, string> = {
  coral: edColors.coral,
  amber: edColors.amber,
  sage: edColors.sage,
  sky: edColors.sky,
};

function categoryColorFor(quest: SidequestResponse): CategoryColor {
  const cat = (quest.categories?.[0] ?? "").toLowerCase();
  if (["trail", "hiking", "park", "outdoors", "walking", "nature"].includes(cat)) return "sage";
  if (["museum", "gallery", "art", "culture", "reading", "learning"].includes(cat)) return "sky";
  if (["cafe", "coffee", "market", "thrifting"].includes(cat)) return "amber";
  return "coral";
}

function formatNumber(num?: number, suffix = ""): string {
  if (num == null) return "—";
  return `${num.toFixed(num % 1 === 0 ? 0 : 1)}${suffix}`;
}

function formatCost(cost: number): { label: string; pct: number; color: string } {
  if (cost === 0) return { label: "Free", pct: 100, color: edColors.coral };
  if (cost < 20) return { label: `$${cost}`, pct: 30, color: edColors.amber };
  if (cost < 50) return { label: `$${cost}`, pct: 60, color: edColors.amber };
  return { label: `$${cost}`, pct: 100, color: edColors.coralDeep };
}

interface MeterProps {
  label: string;
  value: string;
  pct: number;
  color: string;
}

function Meter({ label, value, pct, color }: MeterProps) {
  return (
    <View style={meterStyles.row}>
      <View style={meterStyles.header}>
        <Text style={meterStyles.label}>{label}</Text>
        <Text style={meterStyles.value}>{value}</Text>
      </View>
      <View style={meterStyles.track}>
        <View style={[meterStyles.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const meterStyles = StyleSheet.create({
  row: { gap: 5 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  label: {
    fontFamily: edFont.sansMedium,
    fontSize: 13,
    color: edColors.inkSoft,
    letterSpacing: -0.05,
  },
  value: {
    fontFamily: edFont.serifMedium,
    fontSize: 14,
    color: edColors.ink,
    letterSpacing: -0.1,
  },
  track: {
    height: 4,
    borderRadius: edRadius.pill,
    backgroundColor: edColors.rule,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: edRadius.pill,
  },
});

function truncate(text: string, max = 240): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSentence = slice.lastIndexOf(". ");
  if (lastSentence > max * 0.5) return slice.slice(0, lastSentence + 1);
  return `${slice.trim()}…`;
}

export default function QuestPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [quest, setQuest] = useState<SidequestResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiClient.sidequests
      .getById(id)
      .then(setQuest)
      .catch((err) => {
        console.error("[QuestPreview] Failed to load:", err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleAccept = useCallback(() => {
    if (!quest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/quest/predict/[id]" as const,
      params: { id: quest.id },
    });
  }, [quest, router]);

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

  const categoryColorKey = categoryColorFor(quest);
  const accentHex = COLOR_HEX[categoryColorKey];
  const firstObjective = quest.objectives?.[0];
  const emoji = firstObjective?.emoji ?? "✨";
  const venueName = firstObjective?.venueName;
  const totalCost = (quest.objectives ?? []).reduce(
    (sum, o) => sum + (Number(o.estimatedCost) || 0),
    0,
  );
  const cost = formatCost(totalCost);
  const difficulty = Number(firstObjective?.difficulty ?? 5) || 5;
  const distanceMi = Number(quest.distanceFromHome ?? 0) || 0;

  const roleLabel = (quest.questRole ?? quest.pathwayLabel ?? "QUEST")
    .toUpperCase()
    .replace(/_/g, " ");
  const categoryLabel = (quest.categories ?? [])
    .slice(0, 2)
    .map((c) => c.toUpperCase())
    .join(" · ");

  const narratorText = quest.aiReflection ?? quest.intention ?? quest.summary;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={20} color={edColors.ink} strokeWidth={1.6} />
        </Pressable>
        <EdLabel>{`SQ · ${quest.id.slice(0, 8).toUpperCase()}`}</EdLabel>
        <Pressable style={styles.iconBtn}>
          <Share2 size={18} color={edColors.ink} strokeWidth={1.6} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroShadow}>
          <View style={styles.heroClip}>
            <Svg
              style={StyleSheet.absoluteFill}
              width="100%"
              height="100%"
              preserveAspectRatio="none"
            >
              <Defs>
                <SvgLinearGradient id="heroGrad" x1="60%" y1="0%" x2="40%" y2="100%">
                  <Stop offset="0%" stopColor={accentHex} stopOpacity={0.20} />
                  <Stop offset="60%" stopColor={edColors.paperDeep} stopOpacity={1} />
                  <Stop offset="100%" stopColor={edColors.coral} stopOpacity={0.125} />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGrad)" />
            </Svg>
            <View style={styles.heroInner}>
              <View style={styles.heroTopRow}>
                <Text style={[styles.heroLabel, { color: edColors.coralDeep }]}>{roleLabel}</Text>
                {categoryLabel ? (
                  <Text style={[styles.heroLabel, { color: edColors.inkMute }]}>{categoryLabel}</Text>
                ) : null}
              </View>

              <View style={styles.emojiTile}>
                <Text style={styles.emoji}>{emoji}</Text>
              </View>

              <Text style={styles.title}>{quest.title ?? "Your quest"}</Text>

              <View style={styles.metaRow}>
                {venueName ? <Text style={styles.metaText}>{venueName}</Text> : null}
                {venueName && distanceMi > 0 ? <View style={styles.dot} /> : null}
                {distanceMi > 0 ? (
                  <Text style={[styles.metaText, styles.metaSoft]}>
                    {distanceMi.toFixed(1)} mi away
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.metersBlock}>
          <Meter
            label="Difficulty"
            value={`${difficulty}/10`}
            pct={(difficulty / 10) * 100}
            color={edColors.sage}
          />
          <Meter
            label="Distance"
            value={formatNumber(distanceMi, " mi")}
            pct={Math.min(100, (distanceMi / 5) * 100)}
            color={edColors.sky}
          />
          <Meter
            label="Cost"
            value={cost.label}
            pct={cost.pct}
            color={cost.color}
          />
        </View>

        {narratorText ? (
          <View style={styles.narratorCard}>
            <EdLabel color={edColors.coral} style={styles.narratorLabel}>
              Narrator
            </EdLabel>
            <Text style={styles.narratorQuote}>
              {truncate(narratorText)}
            </Text>
          </View>
        ) : null}

        <View style={[styles.scrollSpacer, { height: 140 + insets.bottom }]} />
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
            <SvgLinearGradient id="footerFade" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={edColors.paper} stopOpacity={0} />
              <Stop offset="40%" stopColor={edColors.paper} stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#footerFade)" />
        </Svg>
      </View>
      <View style={[styles.footer, { bottom: 18 + insets.bottom }]}>
        <EdBtn label="Skip" variant="secondary" onPress={handleSkip} style={styles.skipBtn} />
        <EdBtn
          label="Accept the quest"
          variant="primary"
          onPress={handleAccept}
          style={styles.acceptBtn}
        />
      </View>
    </SafeAreaView>
  );
}

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
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: edColors.paperHi,
    borderWidth: 1,
    borderColor: edColors.rule,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  heroShadow: {
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: edColors.paperHi,
    ...edShadows.cardLifted,
  },
  heroClip: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: edColors.rule,
    overflow: "hidden",
  },
  heroInner: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: {
    fontFamily: edFont.monoMedium,
    fontSize: 10.5,
    letterSpacing: 1.6,
  },
  emojiTile: {
    alignSelf: "center",
    marginTop: 14,
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: edColors.paperHi,
    alignItems: "center",
    justifyContent: "center",
    ...edShadows.cardResting,
  },
  emoji: { fontSize: 56 },
  title: {
    fontFamily: edFont.serifRegular,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: edColors.ink,
    textAlign: "center",
    marginTop: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  metaText: {
    fontFamily: edFont.sansMedium,
    fontSize: 13,
    color: edColors.inkSoft,
    letterSpacing: -0.05,
  },
  metaSoft: {
    color: edColors.inkMute,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: edColors.inkMute,
  },
  metersBlock: {
    marginHorizontal: 22,
    marginTop: 18,
    gap: 14,
  },
  narratorCard: {
    marginHorizontal: 22,
    marginTop: 8,
    padding: 16,
    borderRadius: 22,
    backgroundColor: edColors.paperHi,
    borderWidth: 1,
    borderColor: edColors.rule,
    ...edShadows.cardResting,
  },
  narratorLabel: {
    marginBottom: 6,
  },
  narratorQuote: {
    fontFamily: edFont.serifRegularItalic,
    fontSize: 14,
    lineHeight: 21,
    color: edColors.inkSoft,
  },
  scrollSpacer: { height: 140 },
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
    flexDirection: "row",
    gap: 10,
  },
  skipBtn: { flex: 0.36 },
  acceptBtn: { flex: 1 },
});
