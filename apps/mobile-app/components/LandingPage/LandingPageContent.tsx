import { duration } from "@/theme";
import {
  DiscoveredEventType,
  EventType,
  TrendingEventType,
} from "@/types/types";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import FeaturedEventsCarousel from "./FeaturedEventsCarousel";
import ContributorsSection from "./LeaderboardSection";
import {
  ScoreHeroSkeleton,
  ContributorsSkeleton,
  TopEventsSkeleton,
  CarouselSkeleton,
} from "./Skeletons";
import WhatsHappeningSection from "./WhatsHappeningSection";
import ThirdSpaceScoreHero from "./ThirdSpaceScoreHero";
import TopEventsSection from "./TopEventsSection";
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
          <TopEventsSkeleton />
          <CarouselSkeleton title="What's Happening" />
          <CarouselSkeleton title="Featured Events" />
        </Animated.View>
      )}

      {!isLoading && (
        <>
          {thirdSpaceScore && (
            <Animated.View entering={FadeIn.duration(duration.normal).delay(0)}>
              <ThirdSpaceScoreHero score={thirdSpaceScore} onExploreMap={onExploreMap} />
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

          {topEvents && topEvents.length > 0 && (
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(160)}
              >
                <TopEventsSection events={topEvents} />
              </Animated.View>
            )}

          <Animated.View entering={FadeIn.duration(duration.normal).delay(topEvents?.length ? 240 : 160)}>
            <WhatsHappeningSection
              trendingEvents={data?.trendingEvents || []}
              justDiscoveredEvents={data?.justDiscoveredEvents || []}
            />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(duration.normal).delay(topEvents?.length ? 320 : 240)}>
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
