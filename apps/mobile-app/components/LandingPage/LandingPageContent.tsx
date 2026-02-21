import React from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { EventType } from "@/types/types";
import FeaturedEventsCarousel from "./FeaturedEventsCarousel";
import CommunityEventsSection from "./CommunityEventsSection";
import UpcomingEventsSection from "./UpcomingEventsSection";

interface LandingPageData {
  featuredEvents: EventType[];
  upcomingEvents: EventType[];
  communityEvents?: EventType[];
}

interface LandingPageContentProps {
  data: LandingPageData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

const { width: screenWidth } = Dimensions.get("window");
const FEATURED_ITEM_WIDTH = screenWidth * 0.85;
const COMMUNITY_ITEM_WIDTH = screenWidth * 0.75;

const LandingPageSkeleton: React.FC = () => {
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Featured Events Skeleton */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Featured Events</Text>
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredScrollContent}
          >
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.featuredSkeletonItem}>
                <View style={styles.featuredSkeletonCard}>
                  <View style={styles.featuredSkeletonImage} />
                  <View style={styles.featuredSkeletonContent}>
                    <View style={styles.featuredSkeletonTitle} />
                    <View style={styles.featuredSkeletonDate} />
                    <View style={styles.featuredSkeletonLocation} />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Community Events Skeleton */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Community Events</Text>
        <Text style={styles.sectionSubtitle}>
          Events discovered by the community through photo scanning
        </Text>
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.communityScrollContent}
          >
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.communitySkeletonItem}>
                <View style={styles.communitySkeletonCard}>
                  <View style={styles.communitySkeletonImage} />
                  <View style={styles.communitySkeletonContent}>
                    <View style={styles.communitySkeletonTitle} />
                    <View style={styles.communitySkeletonDate} />
                    <View style={styles.communitySkeletonLocation} />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Upcoming Events Skeleton */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Upcoming Events</Text>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.upcomingSkeletonItem}>
            <View style={styles.upcomingSkeletonCard}>
              <View style={styles.upcomingSkeletonImage} />
              <View style={styles.upcomingSkeletonContent}>
                <View style={styles.upcomingSkeletonTitle} />
                <View style={styles.upcomingSkeletonDate} />
                <View style={styles.upcomingSkeletonLocation} />
                <View style={styles.upcomingSkeletonDescription} />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Bottom padding */}
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
      <FeaturedEventsCarousel
        events={data?.featuredEvents || []}
        isLoading={false}
      />

      <CommunityEventsSection
        events={data?.communityEvents || []}
        isLoading={false}
      />

      <UpcomingEventsSection
        events={data?.upcomingEvents || []}
        isLoading={false}
      />

      {/* Add some bottom padding */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: spacing["2xl"],
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: "#666",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  carouselContainer: {
    position: "relative",
  },
  featuredScrollContent: {
    paddingHorizontal: (screenWidth - FEATURED_ITEM_WIDTH) / 2,
  },
  communityScrollContent: {
    paddingHorizontal: spacing.lg,
  },
  featuredSkeletonItem: {
    width: FEATURED_ITEM_WIDTH,
    marginRight: spacing.lg,
  },
  featuredSkeletonCard: {
    backgroundColor: "#f0f0f0",
    borderRadius: radius.xl,
    overflow: "hidden",
    shadowColor: colors.fixed.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  featuredSkeletonImage: {
    height: 120,
    backgroundColor: "#e0e0e0",
  },
  featuredSkeletonContent: {
    padding: spacing.lg,
  },
  featuredSkeletonTitle: {
    height: 16,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: spacing.sm,
    width: "80%",
  },
  featuredSkeletonDate: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: spacing._6,
    width: "60%",
  },
  featuredSkeletonLocation: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    width: "70%",
  },
  communitySkeletonItem: {
    width: COMMUNITY_ITEM_WIDTH,
    marginRight: spacing.md,
  },
  communitySkeletonCard: {
    backgroundColor: "#f0f0f0",
    borderRadius: radius.md,
    overflow: "hidden",
    shadowColor: colors.fixed.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  communitySkeletonImage: {
    height: 100,
    backgroundColor: "#e0e0e0",
  },
  communitySkeletonContent: {
    padding: spacing.md,
  },
  communitySkeletonTitle: {
    height: 14,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: spacing._6,
    width: "85%",
  },
  communitySkeletonDate: {
    height: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: spacing.xs,
    width: "50%",
  },
  communitySkeletonLocation: {
    height: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    width: "65%",
  },
  upcomingSkeletonItem: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  upcomingSkeletonCard: {
    backgroundColor: "#f0f0f0",
    borderRadius: radius.xl,
    overflow: "hidden",
    shadowColor: colors.fixed.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  upcomingSkeletonImage: {
    height: 140,
    backgroundColor: "#e0e0e0",
  },
  upcomingSkeletonContent: {
    padding: spacing.lg,
  },
  upcomingSkeletonTitle: {
    height: 16,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: spacing.sm,
    width: "90%",
  },
  upcomingSkeletonDate: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: spacing._6,
    width: "55%",
  },
  upcomingSkeletonLocation: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: spacing.sm,
    width: "75%",
  },
  upcomingSkeletonDescription: {
    height: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    width: "80%",
  },
});

export default LandingPageContent;
