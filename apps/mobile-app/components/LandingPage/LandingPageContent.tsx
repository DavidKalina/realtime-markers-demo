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
import CommunityEventsSection from "./CommunityEventsSection";
import FeaturedEventsCarousel from "./FeaturedEventsCarousel";
import JustDiscoveredSection from "./JustDiscoveredSection";
import TrendingEventsSection from "./TrendingEventsSection";
import UpcomingEventsSection from "./UpcomingEventsSection";

interface Category {
  id: string;
  name: string;
  icon: string;
  eventCount?: number;
}

interface LandingPageData {
  featuredEvents: EventType[];
  upcomingEvents: EventType[];
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
          {/* Featured Skeleton */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Events</Text>
            <SkeletonCard />
          </View>

          {/* Just Discovered Skeleton */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Just Discovered</Text>
            <SkeletonCard />
          </View>

          {/* Trending Skeleton */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Now</Text>
            <SkeletonCard />
          </View>

          {/* Upcoming Skeleton */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonListItem}>
                <ShimmerView style={styles.skeletonLine} />
                <ShimmerView style={[styles.skeletonLine, { width: "70%" }]} />
                <ShimmerView
                  style={[
                    styles.skeletonLine,
                    { width: "50%", marginTop: spacing.sm },
                  ]}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {!isLoading && (
        <>
          <Animated.View entering={FadeIn.duration(duration.normal).delay(0)}>
            <FeaturedEventsCarousel
              events={data?.featuredEvents || []}
              isLoading={false}
            />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(duration.normal).delay(80)}>
            <JustDiscoveredSection events={data?.justDiscoveredEvents || []} />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(duration.normal).delay(160)}>
            <TrendingEventsSection events={data?.trendingEvents || []} />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(duration.normal).delay(240)}>
            <CommunityEventsSection
              events={data?.communityEvents || []}
              isLoading={false}
            />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(duration.normal).delay(320)}>
            <UpcomingEventsSection
              events={data?.upcomingEvents || []}
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
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.text.label,
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
