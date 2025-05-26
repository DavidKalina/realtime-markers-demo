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
  Moon,
  Mail,
  Bell as BellIcon,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import Feed, { FeedItem } from "@/components/Layout/Feed";
import UserStats from "@/components/Layout/UserStats";
import List, { StyledSwitch } from "@/components/Layout/List";

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
  const router = useRouter();
  const items = useMemo(() => generateActivityItems(), []);

  const handleItemPress = (item: FeedItem) => {
    console.log("Activity item pressed:", item);
    // Navigate to item details
  };

  const handleViewAll = () => {
    router.push({
      pathname: "/test/list",
      params: { type: "activity", title: "Activity Feed" },
    });
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

const FavoriteItems = () => {
  const router = useRouter();
  const items = [
    {
      id: "1",
      icon: Star,
      title: "Favorite Location 1",
      description: "Last visited 2 days ago",
      badge: "New",
    },
    {
      id: "2",
      icon: Star,
      title: "Favorite Location 2",
      description: "Last visited 1 week ago",
    },
    {
      id: "3",
      icon: Star,
      title: "Favorite Location 3",
      description: "Last visited 2 weeks ago",
    },
  ];

  const handleViewAll = () => {
    router.push({
      pathname: "/test/list",
      params: { type: "favorites", title: "Favorite Locations" },
    });
  };

  return (
    <List
      items={items}
      onItemPress={(item) => console.log("Favorite item pressed:", item)}
      scrollable={false}
      onViewAllPress={handleViewAll}
      emptyState={{
        icon: Heart,
        title: "No Favorites Yet",
        description: "Your favorite locations will appear here",
      }}
    />
  );
};

const NotificationSettings = () => {
  const router = useRouter();
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailUpdates: false,
    darkMode: true,
  });

  const handleSettingChange =
    (key: keyof typeof settings) => (value: boolean) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    };

  const items = [
    {
      id: "1",
      icon: BellIcon,
      title: "Push Notifications",
      description: "Receive notifications on your device",
      rightElement: (
        <StyledSwitch
          value={settings.pushNotifications}
          onValueChange={handleSettingChange("pushNotifications")}
        />
      ),
      isActive: settings.pushNotifications,
    },
    {
      id: "2",
      icon: Mail,
      title: "Email Updates",
      description: "Get updates via email",
      rightElement: (
        <StyledSwitch
          value={settings.emailUpdates}
          onValueChange={handleSettingChange("emailUpdates")}
        />
      ),
      isActive: settings.emailUpdates,
    },
    {
      id: "3",
      icon: Moon,
      title: "Dark Mode",
      description: "Use dark theme",
      rightElement: (
        <StyledSwitch
          value={settings.darkMode}
          onValueChange={handleSettingChange("darkMode")}
        />
      ),
      isActive: settings.darkMode,
    },
  ];

  const handleViewAll = () => {
    router.push({
      pathname: "/test/list",
      params: { type: "settings", title: "Settings" },
    });
  };

  return (
    <List
      items={items}
      onItemPress={(item) => console.log("Setting pressed:", item)}
      scrollable={false}
      onViewAllPress={handleViewAll}
      emptyState={{
        icon: Settings,
        title: "No Settings Available",
        description: "Settings will appear here",
      }}
    />
  );
};

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
  const router = useRouter();
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
            onPress: () =>
              router.push({
                pathname: "/test/list",
                params: { type: "activity", title: "Activity Feed" },
              }),
            actionButton: {
              label: "See More",
              onPress: () =>
                router.push({
                  pathname: "/test/list",
                  params: { type: "activity", title: "Activity Feed" },
                }),
              variant: "outline" as const,
            },
          },
          {
            title: "Favorites",
            icon: Heart,
            content: <FavoriteItems />,
            onPress: () =>
              router.push({
                pathname: "/test/list",
                params: { type: "favorites", title: "Favorite Locations" },
              }),
            actionButton: {
              label: "Manage",
              onPress: () =>
                router.push({
                  pathname: "/test/list",
                  params: { type: "favorites", title: "Favorite Locations" },
                }),
              variant: "secondary" as const,
            },
          },
          {
            title: "Settings",
            icon: Settings,
            content: <NotificationSettings />,
            onPress: () =>
              router.push({
                pathname: "/test/list",
                params: { type: "settings", title: "Settings" },
              }),
            actionButton: {
              label: "Edit",
              onPress: () =>
                router.push({
                  pathname: "/test/list",
                  params: { type: "settings", title: "Settings" },
                }),
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
  }, [activeTab, router]);

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
