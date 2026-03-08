import { duration, spacing, useColors } from "@/theme";
import {
  DiscoveredEventType,
  EventType,
  TrendingEventType,
} from "@/types/types";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

const SectionDivider: React.FC = () => {
  const colors = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border.default,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
      }}
    />
  );
};
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import FeaturedEventsCarousel from "./FeaturedEventsCarousel";
import ContributorsSection from "./LeaderboardSection";
import {
  ScoreHeroSkeleton,
  ContributorsSkeleton,
  TopEventsSkeleton,
  CarouselSkeleton,
  ListSkeleton,
} from "./Skeletons";
import WhatsHappeningSection from "./WhatsHappeningSection";
import ThirdSpaceScoreHero from "./ThirdSpaceScoreHero";
import TopEventsSection from "./TopEventsSection";
import HappeningTodaySection from "./HappeningTodaySection";
import PopularCategoriesSection from "./PopularCategoriesSection";
import FreeThisWeekSection from "./FreeThisWeekSection";
import WeeklyRegularsSection from "./WeeklyRegularsSection";
import CommunityEventsSection from "./CommunityEventsSection";
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
  topEvents?: EventType[];
  happeningTodayEvents?: EventType[];
  freeThisWeekEvents?: EventType[];
  weeklyRegularEvents?: EventType[];
}

interface LandingPageContentProps {
  data: LandingPageData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
  thirdSpaceScore?: ThirdSpaceScoreResponse | null;
  currentUserId?: string;
  topEvents?: EventType[];
  onExploreMap?: () => void;
}

const LandingPageContent: React.FC<LandingPageContentProps> = ({
  data,
  isLoading,
  onRefresh,
  isRefreshing = false,
  thirdSpaceScore,
  currentUserId,
  topEvents,
  onExploreMap,
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
          <ScoreHeroSkeleton />
          <ContributorsSkeleton />
          <ListSkeleton />
          <TopEventsSkeleton />
          <CarouselSkeleton title="What's Happening" />
          <CarouselSkeleton title="Featured Events" />
        </Animated.View>
      )}

      {!isLoading && (
        <>
          {thirdSpaceScore && (
            <Animated.View entering={FadeIn.duration(duration.normal).delay(0)}>
              <ThirdSpaceScoreHero
                score={thirdSpaceScore}
                onExploreMap={onExploreMap}
              />
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
                <SectionDivider />
              </Animated.View>
            )}

          {data?.happeningTodayEvents &&
            data.happeningTodayEvents.length > 0 && (
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(160)}
              >
                <HappeningTodaySection events={data.happeningTodayEvents} />
                <SectionDivider />
              </Animated.View>
            )}

          {data?.popularCategories && data.popularCategories.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(duration.normal).delay(240)}
            >
              <PopularCategoriesSection categories={data.popularCategories} />
              <SectionDivider />
            </Animated.View>
          )}

          {topEvents && topEvents.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(duration.normal).delay(320)}
            >
              <TopEventsSection events={topEvents} />
              <SectionDivider />
            </Animated.View>
          )}

          {data?.freeThisWeekEvents && data.freeThisWeekEvents.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(duration.normal).delay(400)}
            >
              <FreeThisWeekSection events={data.freeThisWeekEvents} />
              <SectionDivider />
            </Animated.View>
          )}

          <Animated.View entering={FadeIn.duration(duration.normal).delay(480)}>
            <WhatsHappeningSection
              trendingEvents={data?.trendingEvents || []}
              justDiscoveredEvents={data?.justDiscoveredEvents || []}
            />
            <SectionDivider />
          </Animated.View>

          {data?.weeklyRegularEvents && data.weeklyRegularEvents.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(duration.normal).delay(560)}
            >
              <WeeklyRegularsSection events={data.weeklyRegularEvents} />
              <SectionDivider />
            </Animated.View>
          )}

          {data?.communityEvents && data.communityEvents.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(duration.normal).delay(640)}
            >
              <CommunityEventsSection events={data.communityEvents} />
              <SectionDivider />
            </Animated.View>
          )}

          <Animated.View entering={FadeIn.duration(duration.normal).delay(720)}>
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

export default LandingPageContent;
