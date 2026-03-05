import ShimmerView from "@/components/Layout/ShimmerView";
import {
  colors,
  duration,
  fontFamily,
  fontWeight,
  radius,
  spacing,
} from "@/theme";
import {
  DiscoveredEventType,
  EventType,
  TrendingEventType,
} from "@/types/types";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import FeaturedEventsCarousel from "./FeaturedEventsCarousel";
import ContributorsSection from "./LeaderboardSection";
import WhatsHappeningSection from "./WhatsHappeningSection";
import ThirdSpaceScoreHero from "./ThirdSpaceScoreHero";
import type { ThirdSpaceScoreResponse } from "@/services/api/modules/leaderboard";

interface Category {
  id: string;
  name: string;
  icon: string;
  eventCount?: number;
}

interface LandingPageData {
  featuredEvents: EventType[];
  upcomingEvents?: EventType[];
  communityEvents?: EventType[];
  justDiscoveredEvents?: DiscoveredEventType[];
  trendingEvents?: TrendingEventType[];
  popularCategories?: Category[];
  availableCities?: string[];
}

interface LandingPageContentProps {
  data: LandingPageData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
  thirdSpaceScore?: ThirdSpaceScoreResponse | null;
  currentUserId?: string;
}

const SkeletonCard: React.FC = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonCardInner}>
      <ShimmerView style={styles.skeletonLine} />
      <ShimmerView style={[styles.skeletonLine, { width: "60%" }]} />
      <ShimmerView
        style={[styles.skeletonLine, { width: "40%", marginTop: spacing.sm }]}
      />
    </View>
  </View>
);

const LandingPageContent: React.FC<LandingPageContentProps> = ({
  data,
  isLoading,
  onRefresh,
  isRefreshing = false,
  thirdSpaceScore,
  currentUserId,
}) => {
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
      {isLoading && (
        <Animated.View exiting={FadeOut.duration(duration.fast)}>
          {/* Score Skeleton */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Third Space Score</Text>
            <SkeletonCard />
          </View>

          {/* Contributors Skeleton */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contributors</Text>
            <SkeletonCard />
          </View>

          {/* What's Happening Skeleton */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's Happening</Text>
            <SkeletonCard />
          </View>

          {/* Featured Skeleton */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Events</Text>
            <SkeletonCard />
          </View>
        </Animated.View>
      )}

      {!isLoading && (
        <>
          {thirdSpaceScore && (
            <Animated.View entering={FadeIn.duration(duration.normal).delay(0)}>
              <ThirdSpaceScoreHero score={thirdSpaceScore} />
            </Animated.View>
          )}

          {thirdSpaceScore?.contributors &&
            thirdSpaceScore.contributors.length > 0 && (
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(80)}
              >
                <ContributorsSection
                  contributors={thirdSpaceScore.contributors}
                  currentUserId={currentUserId}
                  city={thirdSpaceScore.current.city}
                />
              </Animated.View>
            )}

          <Animated.View entering={FadeIn.duration(duration.normal).delay(160)}>
            <WhatsHappeningSection
              trendingEvents={data?.trendingEvents || []}
              justDiscoveredEvents={data?.justDiscoveredEvents || []}
            />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(duration.normal).delay(240)}>
            <FeaturedEventsCarousel
              events={data?.featuredEvents || []}
              isLoading={false}
            />
          </Animated.View>
        </>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  skeletonCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: "hidden",
  },
  skeletonCardInner: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
    width: "80%",
  },
  skeletonListItem: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.sm,
  },
});

export default LandingPageContent;
