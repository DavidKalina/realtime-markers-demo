import React, { useCallback, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import EmptyState from "@/components/Layout/EmptyState";
import ItineraryBrowseCard from "@/components/Itinerary/ItineraryBrowseCard";
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
import type { ThirdSpaceScoreResponse } from "@/services/api/modules/leaderboard";
import type { PopularStop } from "@/hooks/usePopularStops";
import type { BrowseItineraryResponse } from "@/hooks/useBrowseItineraries";
import ThirdSpaceScoreHero from "./ThirdSpaceScoreHero";
import { ScoreHeroSkeleton } from "./Skeletons";

/* ─── Types ─── */

type TabKey = "adventures" | "spots" | "people";

const TABS: { key: TabKey; label: string }[] = [
  { key: "adventures", label: "Adventures" },
  { key: "spots", label: "Spots" },
  { key: "people", label: "People" },
];

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

interface CityDetailContentProps {
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
  popularStops?: PopularStop[];
  thirdSpaceScore?: ThirdSpaceScoreResponse | null;
  groupedItineraries?: Record<string, BrowseItineraryResponse[]>;
  onExploreMap?: () => void;
  onSearch?: () => void;
  onItineraryAdopted?: () => void;
}

/* ─── Tier emoji for leaderboard ─── */

const TIER_EMOJI: Record<string, string> = {
  Explorer: "\u{1F9ED}",
  Scout: "\u{1F52D}",
  Curator: "\u{2B50}",
  Ambassador: "\u{1F451}",
};

const RANK_COLORS: Record<number, string> = {
  1: "#fbbf24",
  2: "#a0a0a0",
  3: "#cd7f32",
};

/* ─── Hero crossfade ─── */

const HeroCrossfade: React.FC<{
  isLoading: boolean;
  thirdSpaceScore?: ThirdSpaceScoreResponse | null;
  onExploreMap?: () => void;
}> = ({ isLoading, thirdSpaceScore, onExploreMap }) => {
  if (isLoading) {
    return <ScoreHeroSkeleton />;
  }

  if (thirdSpaceScore) {
    return (
      <Animated.View entering={FadeIn.duration(duration.normal)}>
        <ThirdSpaceScoreHero
          score={thirdSpaceScore}
          onExploreMap={onExploreMap}
        />
      </Animated.View>
    );
  }

  return null;
};

/* ─── Category emoji map ─── */

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: "\u2615",
  restaurant: "\u{1F37D}",
  bar: "\u{1F378}",
  park: "\u{1F333}",
  museum: "\u{1F3DB}",
  gallery: "\u{1F5BC}",
  market: "\u{1F6D2}",
  trail: "\u{1F6B6}",
  attraction: "\u{1F3A0}",
  venue: "\u{1F3A4}",
};

/* ─── Main component ─── */

const CityDetailContent: React.FC<CityDetailContentProps> = ({
  isLoading,
  onRefresh,
  isRefreshing = false,
  thirdSpaceScore,
  popularStops,
  groupedItineraries,
  onExploreMap,
  onSearch,
  onItineraryAdopted,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("adventures");

  const handleTabPress = useCallback((tab: TabKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  const totalItineraries = useMemo(() => {
    if (!groupedItineraries) return 0;
    return Object.values(groupedItineraries).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
  }, [groupedItineraries]);

  const tabCounts = useMemo(
    () => ({
      adventures: totalItineraries,
      spots: popularStops?.length || 0,
      people: thirdSpaceScore?.contributors?.length || 0,
    }),
    [totalItineraries, popularStops, thirdSpaceScore?.contributors],
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "adventures":
        return renderAdventuresTab();
      case "spots":
        return renderSpotsTab();
      case "people":
        return renderPeopleTab();
    }
  };

  const renderAdventuresTab = () => {
    if (!groupedItineraries || totalItineraries === 0) {
      return renderEmptyTab(
        "\u{1F30D}",
        "No adventures yet",
        "Be the first to complete an adventure here and it'll show up for others to try.",
      );
    }

    const sortedIntentions = INTENTION_ORDER.filter(
      (key) => groupedItineraries[key] && groupedItineraries[key].length > 0,
    );

    return (
      <View style={styles.tabContent}>
        {sortedIntentions.map((intentionKey) => {
          const itineraries = groupedItineraries[intentionKey];
          const meta = INTENTION_LABELS[intentionKey] || {
            label: intentionKey,
            emoji: "\u{1F30D}",
          };

          return (
            <View key={intentionKey} style={styles.intentionSection}>
              <Text style={styles.subSectionTitle}>
                {meta.emoji} {meta.label.toUpperCase()}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {itineraries.map((it) => (
                  <ItineraryBrowseCard
                    key={it.id}
                    itinerary={it}
                    onAdopted={onItineraryAdopted}
                  />
                ))}
              </ScrollView>
            </View>
          );
        })}
      </View>
    );
  };

  const renderSpotsTab = () => {
    if (!popularStops || popularStops.length === 0) {
      return renderEmptyTab(
        "\u{1F4CD}",
        "No popular spots yet",
        "Spots with the most adventures will appear here.",
      );
    }

    return (
      <View style={styles.tabContent}>
        <Text style={styles.subSectionTitle}>WHERE PEOPLE ACTUALLY GO</Text>
        {popularStops.map((stop, index) => {
          const emoji =
            stop.emoji ||
            (stop.venueCategory
              ? CATEGORY_EMOJI[stop.venueCategory] || "\u{1F4CD}"
              : "\u{1F4CD}");
          const pct = Math.round(stop.completionRate * 100);
          const isLast = index === popularStops.length - 1;

          const openSpot = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (stop.googlePlaceId) {
              Linking.openURL(
                `https://www.google.com/maps/place/?q=place_id:${stop.googlePlaceId}`,
              );
            } else if (stop.latitude && stop.longitude) {
              Linking.openURL(
                `https://maps.apple.com/?ll=${stop.latitude},${stop.longitude}&q=${encodeURIComponent(stop.venueName)}`,
              );
            }
          };

          return (
            <Pressable
              key={`${stop.venueName}-${index}`}
              style={[styles.eventRow, isLast && styles.eventRowLast]}
              onPress={openSpot}
            >
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName} numberOfLines={1}>
                  {stop.venueName}
                </Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {emoji} {stop.venueCategory || "spot"}
                  {stop.googleRating
                    ? ` \u00B7 ${stop.googleRating}\u2605`
                    : ""}
                  {` \u00B7 ${stop.frequency}x planned \u00B7 ${pct}% went`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderPeopleTab = () => {
    const contributors = thirdSpaceScore?.contributors;
    if (!contributors || contributors.length === 0) {
      return renderEmptyTab(
        "\u{1F465}",
        "No contributors yet",
        "People who explore this city will show up here.",
      );
    }

    return (
      <View style={styles.tabContent}>
        {contributors.map((entry, index) => {
          const rankColor = RANK_COLORS[entry.rank];
          const tierEmoji =
            TIER_EMOJI[entry.currentTier] || TIER_EMOJI.Explorer;
          const displayName =
            [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
            "Anonymous";
          const isLast = index === contributors.length - 1;

          return (
            <View
              key={entry.userId}
              style={[styles.eventRow, isLast && styles.eventRowLast]}
            >
              <Text
                style={[
                  styles.leaderRank,
                  rankColor ? { color: rankColor } : undefined,
                ]}
              >
                #{entry.rank}
              </Text>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {`${tierEmoji} ${entry.currentTier}`}
                  {entry.label ? ` \u00B7 ${entry.label}` : ""}
                </Text>
              </View>
              <Text style={styles.leaderScore}>{entry.contribution}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderEmptyTab = (emoji: string, title: string, subtitle: string) => (
    <EmptyState
      emoji={emoji}
      title={title}
      subtitle={subtitle}
      action={{
        label: "Browse other cities",
        onPress: () => router.navigate("/spaces"),
        variant: "outline",
      }}
      style={{ paddingVertical: spacing["2xl"] }}
    />
  );

  const scrollContent = (
    <>
      <HeroCrossfade
        isLoading={isLoading}
        thirdSpaceScore={thirdSpaceScore}
        onExploreMap={onExploreMap}
      />

      {!isLoading && (
        <Animated.View entering={FadeIn.duration(duration.normal).delay(160)}>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tabCounts[tab.key];
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  onPress={() => handleTabPress(tab.key)}
                >
                  <Text
                    style={[styles.tabText, isActive && styles.tabTextActive]}
                  >
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <Text
                      style={[
                        styles.tabCount,
                        isActive && styles.tabCountActive,
                      ]}
                    >
                      {count}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Tab content */}
          <Animated.View
            key={activeTab}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(120)}
            layout={LinearTransition.duration(250)}
          >
            {renderTabContent()}
          </Animated.View>
        </Animated.View>
      )}

      <View style={{ height: 120 }} />
    </>
  );

  if (onSearch) {
    return (
      <PullToActionScrollView
        onSearch={onSearch}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      >
        {scrollContent}
      </PullToActionScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        !isLoading ? (
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {scrollContent}
    </ScrollView>
  );
};

/* ─── Styles ─── */

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
      flexDirection: "row",
      paddingVertical: spacing.sm,
      borderRadius: radius.lg - 2,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
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
    tabCount: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.disabled,
    },
    tabCountActive: {
      color: colors.text.secondary,
    },

    /* Tab content */
    tabContent: {
      paddingHorizontal: spacing.lg,
    },
    subSectionTitle: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },

    /* Intention section */
    intentionSection: {
      marginBottom: spacing.md,
    },
    horizontalScroll: {
      paddingRight: spacing.lg,
    },

    /* Unified row */
    eventRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing._10,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    eventRowLast: {
      borderBottomWidth: 0,
    },
    rankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.bg.elevated,
      justifyContent: "center",
      alignItems: "center",
    },
    rankText: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    eventInfo: {
      flex: 1,
      gap: 2,
    },
    eventName: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
    },
    eventMeta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },

    /* Leaderboard */
    leaderRank: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      minWidth: 28,
    },
    leaderScore: {
      fontSize: 13,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
  });

export default CityDetailContent;
