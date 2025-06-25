import React from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import { EventType } from "@/types/types";
import FeaturedEventsCarousel from "./FeaturedEventsCarousel";
import PopularCategoriesSection from "./PopularCategoriesSection";
import UpcomingEventsSection from "./UpcomingEventsSection";
import CommunityEventsSection from "./CommunityEventsSection";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface LandingPageData {
  featuredEvents: EventType[];
  upcomingEvents: EventType[];
  communityEvents?: EventType[];
  popularCategories: Category[];
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

      {/* Popular Categories Skeleton */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Popular Categories</Text>
        <View style={styles.categoriesGrid}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View key={i} style={styles.categorySkeletonItem}>
              <View style={styles.categorySkeletonIcon} />
              <View style={styles.categorySkeletonText} />
            </View>
          ))}
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

      <PopularCategoriesSection
        categories={data?.popularCategories || []}
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 16,
    fontFamily: "Poppins-Regular",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    paddingHorizontal: 16,
    fontFamily: "Poppins-Regular",
  },
  carouselContainer: {
    position: "relative",
  },
  featuredScrollContent: {
    paddingHorizontal: (screenWidth - FEATURED_ITEM_WIDTH) / 2,
  },
  communityScrollContent: {
    paddingHorizontal: 16,
  },
  featuredSkeletonItem: {
    width: FEATURED_ITEM_WIDTH,
    marginRight: 16,
  },
  featuredSkeletonCard: {
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
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
    padding: 16,
  },
  featuredSkeletonTitle: {
    height: 16,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 8,
    width: "80%",
  },
  featuredSkeletonDate: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 6,
    width: "60%",
  },
  featuredSkeletonLocation: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    width: "70%",
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 16,
  },
  categorySkeletonItem: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  categorySkeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e0e0e0",
    marginBottom: 10,
  },
  categorySkeletonText: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 6,
    width: "60%",
  },
  communitySkeletonItem: {
    width: COMMUNITY_ITEM_WIDTH,
    marginRight: 12,
  },
  communitySkeletonCard: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
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
    padding: 12,
  },
  communitySkeletonTitle: {
    height: 14,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 6,
    width: "85%",
  },
  communitySkeletonDate: {
    height: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 4,
    width: "50%",
  },
  communitySkeletonLocation: {
    height: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    width: "65%",
  },
  upcomingSkeletonItem: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  upcomingSkeletonCard: {
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
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
    padding: 16,
  },
  upcomingSkeletonTitle: {
    height: 16,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 8,
    width: "90%",
  },
  upcomingSkeletonDate: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 6,
    width: "55%",
  },
  upcomingSkeletonLocation: {
    height: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 8,
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
