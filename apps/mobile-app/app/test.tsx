import Screen from "@/components/Layout/Screen";
import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";
import {
  Home,
  Settings,
  Bell,
  Heart,
  Map,
  Users,
  MessageCircle,
  Star,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Feed, { FeedItem } from "@/components/Layout/Feed";
import UserStats from "@/components/Layout/UserStats";

// Overview Tab Components
const UserStatsSection = () => {
  const stats = [
    { value: "1,234", label: "Followers", badge: "+12" },
    { value: "567", label: "Following" },
    { value: "89", label: "Posts", badge: "New" },
  ];

  return <UserStats items={stats} />;
};

const ActivityFeed = () => {
  const items = useMemo(() => generateActivityItems(), []);

  const handleItemPress = (item: FeedItem) => {
    console.log("Activity item pressed:", item);
    // Navigate to item details
  };

  const handleViewAll = () => {
    console.log("View all activities");
    // Navigate to full activity feed
  };

  return (
    <Feed
      items={items}
      onItemPress={handleItemPress}
      onViewAllPress={handleViewAll}
      maxItems={3}
      emptyState={{
        icon: Bell,
        title: "No Activity Yet",
        description: "Your activity feed will appear here",
      }}
    />
  );
};

const FavoriteItems = () => (
  <View style={styles.favoritesContainer}>
    <Text style={styles.favoriteItem}>⭐️ Favorite Item 1</Text>
    <Text style={styles.favoriteItem}>⭐️ Favorite Item 2</Text>
    <Text style={styles.favoriteItem}>⭐️ Favorite Item 3</Text>
  </View>
);

const NotificationSettings = () => (
  <View style={styles.settingsContainer}>
    <Text style={styles.settingItem}>🔔 Push Notifications</Text>
    <Text style={styles.settingItem}>📧 Email Updates</Text>
    <Text style={styles.settingItem}>🌙 Dark Mode</Text>
  </View>
);

// Activity Feed Data
const generateActivityItems = (): FeedItem[] => [
  {
    id: "1",
    icon: MessageCircle,
    title: "New Comment",
    description: "John commented on your post",
    timestamp: "2 hours ago",
    isRead: false,
    badge: "New",
  },
  {
    id: "2",
    icon: Heart,
    title: "New Like",
    description: "Sarah liked your photo",
    timestamp: "4 hours ago",
    isRead: false,
  },
  {
    id: "3",
    icon: Users,
    title: "New Follower",
    description: "Mike started following you",
    timestamp: "1 day ago",
    isRead: true,
  },
  {
    id: "4",
    icon: Star,
    title: "Achievement Unlocked",
    description: "You've reached 100 followers!",
    timestamp: "2 days ago",
    isRead: true,
  },
  {
    id: "5",
    icon: MessageCircle,
    title: "Group Message",
    description: "New message in Photography Group",
    timestamp: "3 days ago",
    isRead: true,
  },
];

// Map Tab Components
const MapView = () => (
  <View style={styles.mapContainer}>
    <View style={styles.mapPlaceholder}>
      <Text style={styles.mapPlaceholderText}>🗺️ Map View</Text>
      <Text style={styles.mapPlaceholderSubtext}>
        Interactive map will be displayed here
      </Text>
    </View>
    <View style={styles.mapStats}>
      <View style={styles.mapStatItem}>
        <Text style={styles.mapStatValue}>12</Text>
        <Text style={styles.mapStatLabel}>Locations</Text>
      </View>
      <View style={styles.mapStatItem}>
        <Text style={styles.mapStatValue}>5</Text>
        <Text style={styles.mapStatLabel}>Active Now</Text>
      </View>
      <View style={styles.mapStatItem}>
        <Text style={styles.mapStatValue}>3</Text>
        <Text style={styles.mapStatLabel}>Nearby</Text>
      </View>
    </View>
  </View>
);

type TabType = "overview" | "activity" | "map";

const TestScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const tabs = [
    {
      icon: Home,
      label: "Overview",
      value: "overview" as TabType,
    },
    {
      icon: Bell,
      label: "Activity",
      value: "activity" as TabType,
    },
    {
      icon: Map,
      label: "Map",
      value: "map" as TabType,
    },
  ];

  // Memoize sections based on active tab
  const sections = useMemo(() => {
    switch (activeTab) {
      case "overview":
        return [
          {
            title: "Profile Stats",
            icon: Home,
            content: <UserStatsSection />,
            onPress: () => console.log("Navigate to detailed stats"),
            actionButton: {
              label: "View All",
              onPress: () => console.log("View all stats"),
              variant: "ghost" as const,
            },
          },
          {
            title: "Recent Activity",
            icon: Bell,
            content: <ActivityFeed />,
            onPress: () => console.log("Navigate to activity feed"),
            actionButton: {
              label: "See More",
              onPress: () => console.log("See more activity"),
              variant: "outline" as const,
            },
          },
          {
            title: "Favorites",
            icon: Heart,
            content: <FavoriteItems />,
            onPress: () => console.log("Navigate to favorites"),
            actionButton: {
              label: "Manage",
              onPress: () => console.log("Manage favorites"),
              variant: "secondary" as const,
            },
          },
          {
            title: "Settings",
            icon: Settings,
            content: <NotificationSettings />,
            onPress: () => console.log("Navigate to settings"),
            actionButton: {
              label: "Edit",
              onPress: () => console.log("Edit settings"),
              variant: "primary" as const,
            },
          },
        ];
      case "activity":
        return [
          {
            title: "Activity Feed",
            icon: Bell,
            content: <ActivityFeed />,
            onPress: () => console.log("Navigate to activity details"),
            actionButton: {
              label: "Mark All Read",
              onPress: () => console.log("Mark all as read"),
              variant: "primary" as const,
            },
          },
        ];
      case "map":
        return [
          {
            title: "Location Overview",
            icon: Map,
            content: <MapView />,
            onPress: () => console.log("Navigate to full map"),
            actionButton: {
              label: "Refresh",
              onPress: () => console.log("Refresh map data"),
              variant: "outline" as const,
            },
          },
        ];
      default:
        return [];
    }
  }, [activeTab]);

  // Memoize footer buttons based on active tab
  const footerButtons = useMemo(() => {
    switch (activeTab) {
      case "overview":
        return [
          {
            label: "Edit Profile",
            onPress: () => console.log("Edit profile"),
            variant: "primary" as const,
          },
          {
            label: "Share Profile",
            onPress: () => console.log("Share profile"),
            variant: "outline" as const,
          },
          {
            label: "Logout",
            onPress: () => console.log("Logout"),
            variant: "error" as const,
          },
        ];
      case "activity":
        return [
          {
            label: "Clear All",
            onPress: () => console.log("Clear all activity"),
            variant: "error" as const,
          },
          {
            label: "Filter",
            onPress: () => console.log("Filter activity"),
            variant: "outline" as const,
          },
        ];
      case "map":
        return [
          {
            label: "Share Location",
            onPress: () => console.log("Share location"),
            variant: "primary" as const,
          },
          {
            label: "Settings",
            onPress: () => console.log("Map settings"),
            variant: "outline" as const,
          },
        ];
      default:
        return [];
    }
  }, [activeTab]);

  return (
    <Screen<TabType>
      // Banner props
      bannerTitle={
        activeTab === "overview"
          ? "Profile Dashboard"
          : activeTab === "activity"
            ? "Activity Feed"
            : "Location Map"
      }
      bannerDescription={
        activeTab === "overview"
          ? "View and manage your profile settings and activity"
          : activeTab === "activity"
            ? "Track your recent interactions and updates"
            : "View and manage your locations"
      }
      bannerEmoji={
        activeTab === "overview" ? "👤" : activeTab === "activity" ? "📱" : "🗺️"
      }
      onBack={() => navigation.goBack()}
      // Tabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      // Sections
      sections={sections}
      // Footer buttons
      footerButtons={footerButtons}
    />
  );
};

const styles = StyleSheet.create({
  activityContainer: {
    paddingVertical: 12,
  },
  favoritesContainer: {
    paddingVertical: 12,
  },
  favoriteItem: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  settingsContainer: {
    paddingVertical: 12,
  },
  settingItem: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },

  // New styles for Map Tab
  mapContainer: {
    paddingVertical: 12,
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: COLORS.cardBackgroundAlt,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  mapPlaceholderText: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  mapPlaceholderSubtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  mapStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
  },
  mapStatItem: {
    alignItems: "center",
  },
  mapStatValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  mapStatLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginTop: 4,
  },
});

export default TestScreen;
