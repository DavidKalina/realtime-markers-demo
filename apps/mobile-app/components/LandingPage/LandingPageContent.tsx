import React from "react";
import { ScrollView, RefreshControl, View } from "react-native";
import { EventType } from "@/types/types";
import FeaturedEventsSection from "./FeaturedEventsSection";
import PopularCategoriesSection from "./PopularCategoriesSection";
import UpcomingEventsSection from "./UpcomingEventsSection";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface LandingPageData {
  featuredEvents: EventType[];
  upcomingEvents: EventType[];
  popularCategories: Category[];
}

interface LandingPageContentProps {
  data: LandingPageData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

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
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <FeaturedEventsSection
        events={data?.featuredEvents || []}
        isLoading={isLoading}
      />

      <PopularCategoriesSection
        categories={data?.popularCategories || []}
        isLoading={isLoading}
      />

      <UpcomingEventsSection
        events={data?.upcomingEvents || []}
        isLoading={isLoading}
      />

      {/* Add some bottom padding */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

export default LandingPageContent;
