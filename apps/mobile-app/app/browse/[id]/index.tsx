import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle } from "react-native-svg";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import QuestDialogBox from "@/components/Quest/QuestDialogBox";
import ActivityHeatmap from "@/components/UserProfile/ActivityHeatmap";
import VenueDnaChart from "@/components/UserProfile/VenueDnaChart";
import useDistrictDetail from "@/hooks/useDistrictDetail";
import { apiClient } from "@/services/ApiClient";
import {
  useColors,
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import type { BrowseItineraryPreview } from "@/services/api/modules/districts";

/* ─── Intention labels ─── */

const INTENTION_LABELS: Record<string, { label: string; emoji: string }> = {
  recharge: { label: "Recharge", emoji: "\u{1F9D8}" },
  explore: { label: "Explore", emoji: "\u{1F9ED}" },
  socialize: { label: "Socialize", emoji: "\u{1F37B}" },
  move: { label: "Move", emoji: "\u{1F3C3}" },
  learn: { label: "Learn", emoji: "\u{1F4DA}" },
  treat_yourself: { label: "Treat Yourself", emoji: "\u{2728}" },
  other: { label: "Other", emoji: "\u{1F30D}" },
};

const INTENTION_ORDER = [
  "recharge",
  "explore",
  "socialize",
  "move",
  "learn",
  "treat_yourself",
  "other",
];

/* ─── Sort config ─── */

type SortMode = "popular" | "recent" | "top_rated";

const SORT_CHIPS: { key: SortMode; label: string; emoji: string }[] = [
  { key: "popular", label: "Hot", emoji: "\u{1F525}" },
  { key: "recent", label: "Fresh", emoji: "\u{1F331}" },
  { key: "top_rated", label: "Legendary", emoji: "\u2B50" },
];

/* ─── Hero ─── */

const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 8;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HERO_STATS = [
  { label: "Sidequests", derive: "adventures" },
  { label: "Avg Rating", derive: "avgRating" },
  { label: "Adopted", derive: "adopted" },
  { label: "Variety", derive: "variety" },
] as const;

const STAT_COLORS = ["#86efac", "#fbbf24", "#a78bfa", "#60a5fa"];

function getVitalityColor(score: number): string {
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#facc15";
  return "#f87171";
}

const AnimatedStatValue: React.FC<{
  value: number;
  color: string;
  delay: number;
}> = ({ value, color, delay }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const animated = useSharedValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withDelay(
      delay,
      withTiming(value, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [value, delay, animated]);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (current) => {
      scheduleOnRN(setDisplayed, current);
    },
  );

  return <Text style={[styles.heroStatValue, { color }]}>{displayed}</Text>;
};

const MOMENTUM_CONFIG = {
  rising: { arrow: "\u2191", color: "#4ade80" },
  steady: { arrow: "\u2192", color: "#a3a3a3" },
  cooling: { arrow: "\u2193", color: "#7dd3fc" },
} as const;

const DistrictHero: React.FC<{
  name: string;
  description: string | null;
  vitalityScore: number;
  itineraryCount: number;
  avgRating: number | null;
  totalAdoptions: number;
  activityTags: string[];
  itineraries: BrowseItineraryPreview[];
  momentum: import("@/services/api/modules/districts").DistrictMomentum | null;
  activityDna: { activity: string; pct: number }[];
  activityHeatmap: { date: string; count: number }[];
  onExploreMap?: () => void;
}> = ({
  name,
  description,
  vitalityScore,
  itineraryCount,
  avgRating,
  totalAdoptions,
  activityTags,
  itineraries,
  momentum,
  activityDna,
  activityHeatmap,
  onExploreMap,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [intelExpanded, setIntelExpanded] = useState(false);

  const ringColor = getVitalityColor(vitalityScore);
  const ringTarget = vitalityScore / 100;

  const animatedProgress = useSharedValue(0);
  const animatedCount = useSharedValue(0);
  const [displayedCount, setDisplayedCount] = useState(0);

  useEffect(() => {
    animatedProgress.value = 0;
    animatedProgress.value = withDelay(
      300,
      withTiming(ringTarget, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );
    animatedCount.value = 0;
    animatedCount.value = withDelay(
      300,
      withTiming(vitalityScore, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [ringTarget, vitalityScore, animatedProgress, animatedCount]);

  useAnimatedReaction(
    () => Math.round(animatedCount.value),
    (current) => {
      scheduleOnRN(setDisplayedCount, current);
    },
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - animatedProgress.value),
  }));

  const derivedStats = useMemo(() => {
    const uniqueIntentions = new Set(
      itineraries.map((it) => it.intention).filter(Boolean),
    );
    return {
      adventures: itineraryCount,
      avgRating: avgRating ?? 0,
      adopted: totalAdoptions,
      variety: uniqueIntentions.size,
    };
  }, [itineraries, itineraryCount, avgRating, totalAdoptions]);

  const hasIntel =
    (activityDna && activityDna.length > 0) ||
    (activityHeatmap && activityHeatmap.length > 0);

  const intelRotation = useSharedValue(0);

  useEffect(() => {
    intelRotation.value = withTiming(intelExpanded ? 180 : 0, {
      duration: 200,
    });
  }, [intelExpanded, intelRotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${intelRotation.value}deg` }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(duration.normal)}
      style={styles.heroContainer}
    >
      <View style={styles.heroHeaderRow}>
        <View>
          <Text style={styles.heroName}>{name}</Text>
          <Text style={styles.heroLabel}>DISTRICT</Text>
        </View>
        {momentum && (
          <Animated.Text
            style={[
              styles.momentumBadge,
              { color: MOMENTUM_CONFIG[momentum.momentum].color },
            ]}
          >
            {MOMENTUM_CONFIG[momentum.momentum].arrow}{" "}
            {momentum.momentum.charAt(0).toUpperCase() + momentum.momentum.slice(1)}
          </Animated.Text>
        )}
      </View>

      {/* Freshness stats */}
      {momentum && (momentum.weeklyNewItineraries > 0 || momentum.uniqueExplorers > 0) && (
        <View style={styles.freshnessRow}>
          {momentum.uniqueExplorers > 0 && (
            <Text style={styles.freshnessText}>
              {momentum.uniqueExplorers} explorer
              {momentum.uniqueExplorers !== 1 ? "s" : ""}
            </Text>
          )}
          {momentum.weeklyNewItineraries > 0 && (
            <Text style={[styles.freshnessText, { color: "#4ade80" }]}>
              +{momentum.weeklyNewItineraries} new this week
            </Text>
          )}
        </View>
      )}

      <View style={styles.heroTopRow}>
        {/* Ring */}
        <View style={styles.circleWrapper}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={colors.border.accent}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <AnimatedCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={ringColor}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={animatedProps}
              transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.circleLabel}>
            <Text style={[styles.circleCount, { color: ringColor }]}>
              {displayedCount}
            </Text>
            <Text style={styles.circleSubLabel}>VITALITY</Text>
          </View>
        </View>

        {/* Stats column */}
        <View style={styles.heroStatsColumn}>
          {HERO_STATS.map((item, index) => {
            const raw = derivedStats[item.derive];
            const isRating = item.derive === "avgRating";
            const display = isRating && raw > 0
              ? `\u2605 ${raw.toFixed(1)}`
              : isRating
                ? "\u2014"
                : undefined;

            return (
              <View key={item.label} style={styles.heroStatRow}>
                <View style={styles.heroStatLabelRow}>
                  <View
                    style={[
                      styles.heroStatDot,
                      { backgroundColor: STAT_COLORS[index] },
                    ]}
                  />
                  <Text style={styles.heroStatLabel}>{item.label}</Text>
                </View>
                {display !== undefined ? (
                  <Text
                    style={[
                      styles.heroStatValue,
                      { color: STAT_COLORS[index] },
                    ]}
                  >
                    {display}
                  </Text>
                ) : (
                  <AnimatedStatValue
                    value={raw}
                    color={STAT_COLORS[index]}
                    delay={400 + index * 150}
                  />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {description && (
        <Text style={styles.heroDescription}>{description}</Text>
      )}

      {onExploreMap && (
        <Pressable
          style={({ pressed }) => [
            styles.exploreButton,
            pressed && { opacity: 0.6 },
          ]}
          onPress={onExploreMap}
        >
          <Text style={[styles.exploreButtonText, { color: ringColor }]}>
            Explore map
          </Text>
          <ChevronRight size={14} color={ringColor} />
        </Pressable>
      )}

      {/* District Intel (collapsible insights) */}
      {hasIntel && (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.intelToggle,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIntelExpanded((prev) => !prev);
            }}
          >
            <Text style={styles.intelToggleText}>DISTRICT INTEL</Text>
            <Animated.View style={chevronStyle}>
              <ChevronDown size={14} color={colors.text.secondary} />
            </Animated.View>
          </Pressable>

          {intelExpanded && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={styles.intelContent}
            >
              {activityDna && activityDna.length > 0 && (
                <VenueDnaChart
                  data={activityDna.map((d) => ({
                    category: d.activity,
                    pct: d.pct,
                    count: 0,
                  }))}
                />
              )}
              {activityHeatmap && activityHeatmap.length > 0 && (
                <ActivityHeatmap data={activityHeatmap} />
              )}
            </Animated.View>
          )}
        </>
      )}
    </Animated.View>
  );
};

/* ─── Pinned Quest ─── */

const PinnedQuest: React.FC<{
  quest: BrowseItineraryPreview;
  onPress: () => void;
}> = ({ quest, onPress }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const firstEmoji = useMemo(() => {
    for (const i of quest.items) {
      if (i.emoji) return i.emoji;
    }
    return "\u{1F5FA}\u{FE0F}";
  }, [quest.items]);

  const reason = useMemo(() => {
    if (quest.timesAdopted === 0) return "Uncharted \u2014 be the first";
    if (quest.rating && quest.rating >= 4) return "Highly rated in this district";
    if (quest.intention) {
      const meta = INTENTION_LABELS[quest.intention];
      if (meta) return `Matches your ${meta.label.toLowerCase()} vibe`;
    }
    return "Recommended for you";
  }, [quest]);

  const meta = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${quest.itemCount} stops`);
    parts.push(`${quest.durationHours}h`);
    if (quest.timesAdopted > 0) {
      parts.push(`${quest.timesAdopted} adventurer${quest.timesAdopted !== 1 ? "s" : ""}`);
    }
    return parts.join(" \u00B7 ");
  }, [quest]);

  const stars = quest.rating
    ? "\u2605".repeat(quest.rating) + "\u2606".repeat(5 - quest.rating)
    : null;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.pinnedQuest,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.pinnedLabel}>PINNED QUEST</Text>
      <View style={styles.pinnedBody}>
        <Text style={styles.pinnedEmoji}>{firstEmoji}</Text>
        <View style={styles.pinnedInfo}>
          <View style={styles.pinnedTitleRow}>
            <Text style={styles.pinnedTitle} numberOfLines={1}>
              {quest.title || "Untitled Sidequest"}
            </Text>
            {stars && <Text style={styles.pinnedStars}>{stars}</Text>}
          </View>
          <Text style={styles.pinnedMeta} numberOfLines={1}>{meta}</Text>
          <Text style={styles.pinnedReason}>{reason}</Text>
        </View>
        <ChevronRight size={14} color={colors.text.disabled} />
      </View>
    </Pressable>
  );
};

/* ─── Quest Log Item ─── */

const MAX_EMOJI_PREVIEW = 4;

const QuestLogItem: React.FC<{
  item: BrowseItineraryPreview;
  onPress: (id: string) => void;
}> = React.memo(({ item, onPress }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item.id);
  }, [item.id, onPress]);

  const firstEmoji = useMemo(() => {
    for (const i of item.items) {
      if (i.emoji) return i.emoji;
    }
    return "\u{1F5FA}\u{FE0F}";
  }, [item.items]);

  const emojiTrail = useMemo(() => {
    const emojis = item.items
      .slice(1, MAX_EMOJI_PREVIEW + 1)
      .map((i) => i.emoji || "\u{1F4CD}")
      .join(" ");
    const extra = item.itemCount - (MAX_EMOJI_PREVIEW + 1);
    return extra > 0 ? `${emojis} +${extra}` : emojis;
  }, [item.items, item.itemCount]);

  const meta = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${item.itemCount} stops`);
    parts.push(`${item.durationHours}h`);
    if (item.creatorFirstName) {
      parts.push(`by ${item.creatorFirstName}`);
    }
    return parts.join(" \u00B7 ");
  }, [item]);

  const stars = item.rating
    ? "\u2605".repeat(item.rating) + "\u2606".repeat(5 - item.rating)
    : null;

  const isUncharted = item.timesAdopted === 0;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.questRow, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.questEmoji}>{firstEmoji}</Text>
      <View style={styles.questInfo}>
        <View style={styles.questTitleRow}>
          <Text style={styles.questTitle} numberOfLines={1}>
            {item.title || "Untitled Sidequest"}
          </Text>
          {stars && <Text style={styles.questStars}>{stars}</Text>}
        </View>
        <View style={styles.questMetaRow}>
          <Text style={styles.questMeta} numberOfLines={1}>{meta}</Text>
          {isUncharted ? (
            <View style={styles.unchartedBadge}>
              <Text style={styles.unchartedText}>UNCHARTED</Text>
            </View>
          ) : (
            <Text style={styles.questAdopters}>
              {item.timesAdopted} adventurer{item.timesAdopted !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
        {emojiTrail.length > 0 && (
          <Text style={styles.questEmojiTrail} numberOfLines={1}>
            {emojiTrail}
          </Text>
        )}
      </View>
      <ChevronRight size={14} color={colors.text.disabled} />
    </Pressable>
  );
});

QuestLogItem.displayName = "QuestLogItem";

/* ─── Quest Filters ─── */

const QuestFilters: React.FC<{
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  intentionFilter: string | null;
  onIntentionChange: (intention: string | null) => void;
  availableIntentions: string[];
}> = ({ sortMode, onSortChange, intentionFilter, onIntentionChange, availableIntentions }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.filtersContainer}>
      {/* Sort row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {SORT_CHIPS.map((chip) => {
          const isActive = sortMode === chip.key;
          return (
            <Pressable
              key={chip.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSortChange(chip.key);
              }}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {chip.emoji} {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Intention row */}
      {availableIntentions.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            style={[
              styles.filterChip,
              intentionFilter === null && styles.filterChipActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onIntentionChange(null);
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                intentionFilter === null && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {availableIntentions.map((key) => {
            const meta = INTENTION_LABELS[key] || { label: key, emoji: "\u{1F30D}" };
            const isActive = intentionFilter === key;
            return (
              <Pressable
                key={key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onIntentionChange(isActive ? null : key);
                }}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {meta.emoji} {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

/* ─── Main screen ─── */

const DistrictDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [intentionFilter, setIntentionFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [questItineraries, setQuestItineraries] = useState<BrowseItineraryPreview[]>([]);

  const { data, isLoading, refetch } = useDistrictDetail(id || null);

  // Fetch quest log when sort changes
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchQuests = async () => {
      try {
        const result = await apiClient.districts.getDetail(id, {
          sort: sortMode,
        });
        if (!cancelled) setQuestItineraries(result.itineraries);
      } catch (err) {
        console.error("Error fetching sorted quests:", err);
      }
    };
    fetchQuests();
    return () => { cancelled = true; };
  }, [id, sortMode]);

  // Derive available intentions from quest data
  const availableIntentions = useMemo(() => {
    const present = new Set<string>();
    for (const it of questItineraries) {
      const key = it.intention || "other";
      present.add(key);
    }
    return INTENTION_ORDER.filter((k) => present.has(k));
  }, [questItineraries]);

  // Filter by intention client-side
  const filteredQuests = useMemo(() => {
    if (!intentionFilter) return questItineraries;
    return questItineraries.filter(
      (it) => (it.intention || "other") === intentionFilter,
    );
  }, [questItineraries, intentionFilter]);

  const handleExploreMap = useCallback(() => {
    if (!data?.district) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/");
  }, [data, router]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    // Also re-fetch quest log
    if (id) {
      try {
        const result = await apiClient.districts.getDetail(id, {
          sort: sortMode,
        });
        setQuestItineraries(result.itineraries);
      } catch {}
    }
    setIsRefreshing(false);
  }, [refetch, id, sortMode]);

  const handleSearch = useCallback(() => {
    router.push("/search");
  }, [router]);

  const handleQuestPress = useCallback(
    (itineraryId: string) => {
      router.push({
        pathname: "/itineraries/[id]" as const,
        params: { id: itineraryId },
      });
    },
    [router],
  );

  const handlePinnedPress = useCallback(() => {
    if (!data?.bestMatch) return;
    router.push({
      pathname: "/itineraries/[id]" as const,
      params: { id: data.bestMatch.id },
    });
  }, [data?.bestMatch, router]);

  const dominantActivities = useMemo(() => {
    if (!data?.activityDna || data.activityDna.length === 0) {
      return data?.district?.activityTags?.slice(0, 2) ?? [];
    }
    const result: string[] = [];
    let cumulative = 0;
    for (const entry of data.activityDna) {
      result.push(entry.activity);
      cumulative += entry.pct;
      if (cumulative >= 50) break;
    }
    return result.length > 0 ? result : data.district.activityTags.slice(0, 2);
  }, [data?.activityDna, data?.district?.activityTags]);

  if (isLoading && !data) {
    return (
      <Screen isScrollable={false} noAnimation>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
      </Screen>
    );
  }

  if (!data?.district) {
    return (
      <Screen isScrollable={false} noAnimation>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>District not found</Text>
        </View>
      </Screen>
    );
  }

  const { district } = data;

  return (
    <Screen
      isScrollable={false}
      bannerDescription={district.name}
      noAnimation
      bottomContent={
        <QuestDialogBox
          style={{ height: 105, marginBottom: 0 }}
        />
      }
    >
      <PullToActionScrollView
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onSearch={handleSearch}
      >
        <DistrictHero
          name={district.name}
          description={district.description}
          vitalityScore={district.vitalityScore}
          itineraryCount={district.itineraryCount}
          avgRating={district.avgRating}
          totalAdoptions={district.totalAdoptions}
          activityTags={district.activityTags}
          itineraries={data.itineraries}
          momentum={district.momentum}
          activityDna={data.activityDna || []}
          activityHeatmap={data.activityHeatmap || []}
          onExploreMap={handleExploreMap}
        />

        {/* Pinned Quest */}
        {data.bestMatch && (
          <PinnedQuest quest={data.bestMatch} onPress={handlePinnedPress} />
        )}

        {/* Quest Filters */}
        {!isLoading && (
          <QuestFilters
            sortMode={sortMode}
            onSortChange={setSortMode}
            intentionFilter={intentionFilter}
            onIntentionChange={setIntentionFilter}
            availableIntentions={availableIntentions}
          />
        )}

        {/* Quest Log */}
        {!isLoading && (
          <View style={styles.questLog}>
            {filteredQuests.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyText}>
                  No sidequests posted yet {"\u2014"} be the first
                </Text>
              </View>
            ) : (
              filteredQuests.map((it) => (
                <QuestLogItem
                  key={it.id}
                  item={it}
                  onPress={handleQuestPress}
                />
              ))
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </PullToActionScrollView>
    </Screen>
  );
};

/* ─── Styles ─── */

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    /* Hero */
    heroContainer: {
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    heroHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    heroName: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    heroLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginTop: 2,
    },
    momentumBadge: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    freshnessRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    freshnessText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    circleWrapper: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      justifyContent: "center",
      alignItems: "center",
    },
    circleLabel: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    circleCount: {
      fontFamily: fontFamily.mono,
      fontSize: 32,
      fontWeight: fontWeight.bold,
    },
    circleSubLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 1.5,
      marginTop: -2,
    },
    heroStatsColumn: {
      flex: 1,
      gap: spacing.xs,
    },
    heroStatRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroStatLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    heroStatDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    heroStatLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    heroStatValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    heroDescription: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    exploreButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
    },
    exploreButtonText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
    },

    /* District Intel (collapsible) */
    intelToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
    },
    intelToggleText: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    intelContent: {
      gap: spacing["2xl"],
      paddingTop: spacing.sm,
    },

    /* Pinned Quest */
    pinnedQuest: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderLeftWidth: 3,
      borderLeftColor: "#4ade80",
      backgroundColor: colors.bg.card,
      borderRadius: radius.sm,
      padding: spacing.md,
    },
    pinnedLabel: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: "#4ade80",
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
    },
    pinnedBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing._10,
    },
    pinnedEmoji: {
      fontSize: fontSize.xl,
    },
    pinnedInfo: {
      flex: 1,
      gap: 2,
    },
    pinnedTitleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.sm,
    },
    pinnedTitle: {
      flex: 1,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    pinnedStars: {
      fontSize: 10,
      color: "#fbbf24",
      letterSpacing: 1,
    },
    pinnedMeta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    pinnedReason: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: "#4ade80",
      fontStyle: "italic",
      marginTop: 2,
    },

    /* Quest Filters */
    filtersContainer: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    filterRow: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing._6,
      borderRadius: radius.sm,
      backgroundColor: colors.bg.card,
    },
    filterChipActive: {
      backgroundColor: colors.bg.elevated,
    },
    filterChipText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    filterChipTextActive: {
      color: colors.text.primary,
      fontWeight: fontWeight.semibold,
    },

    /* Quest Log */
    questLog: {
      paddingHorizontal: spacing.lg,
    },
    questRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing._10,
      gap: spacing._10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    questEmoji: {
      fontSize: fontSize.lg,
    },
    questInfo: {
      flex: 1,
      gap: 2,
    },
    questTitleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.sm,
    },
    questTitle: {
      flex: 1,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      lineHeight: 18,
    },
    questStars: {
      fontSize: 10,
      color: "#fbbf24",
      letterSpacing: 1,
    },
    questMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    questMeta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 16,
      flexShrink: 1,
    },
    questEmojiTrail: {
      fontSize: 12,
      letterSpacing: 2,
      marginTop: 1,
    },
    questAdopters: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
    },
    unchartedBadge: {
      backgroundColor: "rgba(251, 191, 36, 0.15)",
      paddingHorizontal: spacing._6,
      paddingVertical: 1,
      borderRadius: radius.sm,
    },
    unchartedText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "#fbbf24",
      letterSpacing: 1,
    },

    /* Empty */
    emptyInline: {
      paddingVertical: spacing["3xl"],
      alignItems: "center",
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.disabled,
      textAlign: "center",
    },
  });

export default DistrictDetailScreen;
