import React from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
  duration,
} from "@/theme";
import { EventType, DiscoveredEventType, TrendingEventType } from "@/types/types";
import ShimmerView from "@/components/Layout/ShimmerView";
import FeaturedEventsCarousel from "./FeaturedEventsCarousel";
import PopularCategoriesSection from "./PopularCategoriesSection";
import JustDiscoveredSection from "./JustDiscoveredSection";
import TrendingEventsSection from "./TrendingEventsSection";
import CommunityEventsSection from "./CommunityEventsSection";
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
}

interface LandingPageContentProps {
  data: LandingPageData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

const LandingPageSkeleton: React.FC = () => {
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Featured Skeleton */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Featured Events</Text>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonCardInner}>
            <ShimmerView style={styles.skeletonLine} />
            <ShimmerView style={[styles.skeletonLine, { width: "60%" }]} />
            <ShimmerView
              style={[
                styles.skeletonLine,
                { width: "40%", marginTop: spacing.sm },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Categories Skeleton */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular Categories</Text>
        <View style={styles.categoriesGrid}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.categorySkeletonItem}>
              <ShimmerView style={styles.categorySkeletonIcon} />
              <ShimmerView style={styles.categorySkeletonLabel} />
            </View>
          ))}
        </View>
      </View>

      {/* Just Discovered Skeleton */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Just Discovered</Text>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonCardInner}>
            <ShimmerView style={styles.skeletonLine} />
            <ShimmerView style={[styles.skeletonLine, { width: "60%" }]} />
            <ShimmerView
              style={[
                styles.skeletonLine,
                { width: "40%", marginTop: spacing.sm },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Trending Skeleton */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonCardInner}>
            <ShimmerView style={styles.skeletonLine} />
            <ShimmerView style={[styles.skeletonLine, { width: "60%" }]} />
            <ShimmerView
              style={[
                styles.skeletonLine,
                { width: "40%", marginTop: spacing.sm },
              ]}
            />
          </View>
        </View>
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

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const LandingPageContent: React.FC<LandingPageContentProps> = ({
  data,
  isLoading,
  onRefresh,
  isRefreshing = false,
}) => {
  if (isLoading) {
    return <LandingPageSkeleton />;
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <Animated.View entering={FadeInDown.duration(duration.normal).delay(0)}>
        <FeaturedEventsCarousel
          events={data?.featuredEvents || []}
          isLoading={false}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(duration.normal).delay(120)}>
        <PopularCategoriesSection
          categories={data?.popularCategories || []}
          isLoading={false}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(duration.normal).delay(240)}>
        <JustDiscoveredSection events={data?.justDiscoveredEvents || []} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(duration.normal).delay(360)}>
        <TrendingEventsSection events={data?.trendingEvents || []} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(duration.normal).delay(480)}>
        <CommunityEventsSection
          events={data?.communityEvents || []}
          isLoading={false}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(duration.normal).delay(600)}>
        <UpcomingEventsSection
          events={data?.upcomingEvents || []}
          isLoading={false}
        />
      </Animated.View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing["2xl"],
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
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
  categoriesGrid: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  categorySkeletonItem: {
    width: "30%",
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  categorySkeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: spacing.sm,
  },
  categorySkeletonLabel: {
    height: 12,
    borderRadius: 6,
    width: "60%",
  },
});

export default LandingPageContent;
