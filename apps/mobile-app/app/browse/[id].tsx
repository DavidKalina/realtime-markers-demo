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
  FadeOut,
  LinearTransition,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle } from "react-native-svg";
import { ChevronRight } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import ItineraryBrowseCard from "@/components/Itinerary/ItineraryBrowseCard";
import ItineraryDialogBox from "@/components/Itinerary/ItineraryDialogBox";
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

/* ─── Hero ─── */

const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 8;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HERO_STATS = [
  { label: "Adventures", derive: "adventures" },
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
  onExploreMap,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
    </Animated.View>
  );
};

/* ─── Adventures tab (own fetch) ─── */

type SortMode = "popular" | "recent" | "top_rated";

const SORT_TABS: { key: SortMode; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
  { key: "top_rated", label: "Top Rated" },
];

const MAX_SECTIONS = 4;
const MAX_PER_SECTION = 4;

const AdventuresTab: React.FC<{ districtId: string }> = ({ districtId }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [itineraries, setItineraries] = useState<BrowseItineraryPreview[]>([]);

  // Fetch when districtId or sortMode changes
  useEffect(() => {
    let cancelled = false;
    const fetchItineraries = async () => {
      try {
        const result = await apiClient.districts.getDetail(districtId, {
          sort: sortMode,
        });
        if (!cancelled) setItineraries(result.itineraries);
      } catch (err) {
        console.error("Error fetching sorted itineraries:", err);
      }
    };
    fetchItineraries();
    return () => { cancelled = true; };
  }, [districtId, sortMode]);

  const refetchItineraries = useCallback(async () => {
    try {
      const result = await apiClient.districts.getDetail(districtId, {
        sort: sortMode,
      });
      setItineraries(result.itineraries);
    } catch (err) {
      console.error("Error refetching itineraries:", err);
    }
  }, [districtId, sortMode]);

  const groupedByIntention = useMemo(() => {
    if (itineraries.length === 0) return null;
    const groups: Record<string, BrowseItineraryPreview[]> = {};
    for (const it of itineraries) {
      const key = it.intention || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    }
    return groups;
  }, [itineraries]);

  const sortedIntentions = useMemo(() => {
    if (!groupedByIntention) return [];
    return INTENTION_ORDER.filter(
      (key) => groupedByIntention[key] && groupedByIntention[key].length > 0,
    ).slice(0, MAX_SECTIONS);
  }, [groupedByIntention]);

  return (
    <>
      <View style={styles.sortBar}>
        {SORT_TABS.map((tab) => {
          const isActive = sortMode === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.sortButton, isActive && styles.sortButtonActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode(tab.key);
              }}
            >
              <Text style={[styles.sortText, isActive && styles.sortTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {sortedIntentions.length === 0 ? (
        <View style={styles.emptyInline}>
          <Text style={styles.emptyText}>
            No adventures in this district yet.
          </Text>
        </View>
      ) : (
        <View style={styles.tabContent}>
          {sortedIntentions.map((intentionKey) => {
            const items = groupedByIntention![intentionKey].slice(0, MAX_PER_SECTION);
            const meta = INTENTION_LABELS[intentionKey] || {
              label: intentionKey,
              emoji: "\u{1F30D}",
            };
            return (
              <View key={intentionKey} style={styles.intentionSection}>
                <Text style={styles.sectionTitle}>
                  {meta.emoji} {meta.label.toUpperCase()}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {items.map((it) => (
                    <ItineraryBrowseCard
                      key={it.id}
                      itinerary={it as any}
                      onAdopted={refetchItineraries}
                    />
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
};

/* ─── Main screen ─── */

const DistrictDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"adventures" | "insights">("adventures");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, refetch } = useDistrictDetail(id || null);

  const handleExploreMap = useCallback(() => {
    if (!data?.district) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/");
  }, [data, router]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleSearch = useCallback(() => {
    router.push("/search");
  }, [router]);

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
        <ItineraryDialogBox
          defaultActivities={dominantActivities}
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
          onExploreMap={handleExploreMap}
        />

        {/* Best Match */}
        {data.bestMatch && (
          <View style={styles.bestMatchSection}>
            <Text style={styles.bestMatchLabel}>BEST MATCH FOR YOU</Text>
            <ItineraryBrowseCard
              itinerary={data.bestMatch as any}
              onAdopted={refetch}
            />
          </View>
        )}

        {/* Top-level tabs: Adventures / Insights */}
        {!isLoading && (
          <View>
            <View style={styles.tabBar}>
              {(["adventures", "insights"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveTab(tab);
                    }}
                  >
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View>
              {activeTab === "adventures" && (
                <AdventuresTab districtId={district.id} />
              )}

              {activeTab === "insights" && (
                <View style={styles.insightsContent}>
                  {data.activityDna && data.activityDna.length > 0 && (
                    <VenueDnaChart
                      data={data.activityDna.map((d) => ({
                        category: d.activity,
                        pct: d.pct,
                        count: 0,
                      }))}
                    />
                  )}
                  {data.activityHeatmap && data.activityHeatmap.length > 0 && (
                    <ActivityHeatmap data={data.activityHeatmap} />
                  )}
                  {(!data.activityDna || data.activityDna.length === 0) &&
                    (!data.activityHeatmap || data.activityHeatmap.length === 0) && (
                      <Text style={styles.emptyText}>No insights yet</Text>
                    )}
                </View>
              )}
            </View>
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
      marginBottom: spacing["3xl"],
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
    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    tag: {
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    tagText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.xs,
      color: colors.text.secondary,
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

    /* Best match */
    bestMatchSection: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    bestMatchLabel: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.accent.primary,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },

    /* Tab bar */
    tabBar: {
      flexDirection: "row",
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      padding: 2,
    },
    tabButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg - 2,
      alignItems: "center",
      justifyContent: "center",
    },
    tabButtonActive: {
      backgroundColor: colors.bg.elevated,
    },
    tabText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    tabTextActive: {
      color: colors.text.primary,
    },

    /* Sort sub-tabs (within adventures) */
    sortBar: {
      flexDirection: "row",
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    sortButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    sortButtonActive: {
      backgroundColor: colors.bg.elevated,
    },
    sortText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    sortTextActive: {
      color: colors.text.primary,
      fontWeight: fontWeight.semibold,
    },

    /* Insights content */
    insightsContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing["2xl"],
      paddingTop: spacing.md,
    },

    /* Tab content */
    tabContent: {
      paddingHorizontal: spacing.lg,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    intentionSection: {
      marginBottom: spacing.md,
    },
    horizontalScroll: {
      paddingRight: spacing.lg,
    },

    /* Empty */
    emptyInline: {
      paddingVertical: spacing["3xl"],
      paddingHorizontal: spacing.lg,
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
