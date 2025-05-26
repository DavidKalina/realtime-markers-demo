import React, { useState, useCallback, useMemo } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { View, StyleSheet } from "react-native";
import Screen from "@/components/Layout/Screen";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import List, { ListItem } from "@/components/Layout/List";
import Feed, { FeedItem } from "@/components/Layout/Feed";
import { Bell, Heart, Settings } from "lucide-react-native";

// Types for different list views
type ListViewType = "activity" | "favorites" | "settings" | "map";
type ListItemType = FeedItem | ListItem;
type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "warning"
  | "error";

// Mock data generators
const generateActivityItems = (count: number): FeedItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i + 1}`,
    icon: Bell,
    title: `Activity Item ${i + 1}`,
    description: `Description for activity item ${i + 1}`,
    timestamp: `${i + 1} hours ago`,
    isRead: i % 2 === 0,
    badge: i === 0 ? "New" : undefined,
  }));
};

const generateFavoriteItems = (count: number): ListItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i + 1}`,
    icon: Heart,
    title: `Favorite Location ${i + 1}`,
    description: `Last visited ${i + 1} days ago`,
    badge: i === 0 ? "New" : undefined,
  }));
};

const generateSettingsItems = (count: number): ListItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i + 1}`,
    icon: Settings,
    title: `Setting ${i + 1}`,
    description: `Description for setting ${i + 1}`,
  }));
};

const ListScreen = () => {
  const navigation = useNavigation();
  const { type, title } = useLocalSearchParams<{
    type: ListViewType;
    title: string;
  }>();

  // State for pagination
  const [items, setItems] = useState<ListItemType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Generate initial data based on type
  const initialData = useMemo(() => {
    switch (type) {
      case "activity":
        return generateActivityItems(itemsPerPage);
      case "favorites":
        return generateFavoriteItems(itemsPerPage);
      case "settings":
        return generateSettingsItems(itemsPerPage);
      default:
        return [];
    }
  }, [type]);

  // Set initial data
  React.useEffect(() => {
    setItems(initialData);
  }, [initialData]);

  // Fetch more data
  const fetchMoreData = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newItems = (() => {
        switch (type) {
          case "activity":
            return generateActivityItems(itemsPerPage);
          case "favorites":
            return generateFavoriteItems(itemsPerPage);
          case "settings":
            return generateSettingsItems(itemsPerPage);
          default:
            return [];
        }
      })();

      setItems((prev) => [...prev, ...newItems]);
      setPage((prev) => prev + 1);

      // Simulate end of data after 3 pages
      if (page >= 3) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, type, page]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const refreshedItems = (() => {
        switch (type) {
          case "activity":
            return generateActivityItems(itemsPerPage);
          case "favorites":
            return generateFavoriteItems(itemsPerPage);
          case "settings":
            return generateSettingsItems(itemsPerPage);
          default:
            return [];
        }
      })();

      setItems(refreshedItems);
      setPage(1);
      setHasMore(true);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  // Render item based on type
  const renderItem = useCallback(
    (item: ListItemType) => {
      switch (type) {
        case "activity":
          return (
            <Feed
              items={[item as FeedItem]}
              onItemPress={() => console.log("Activity item pressed:", item)}
              maxItems={1}
            />
          );
        case "favorites":
        case "settings":
          return (
            <List
              items={[item as ListItem]}
              onItemPress={() => console.log("Item pressed:", item)}
              scrollable={false}
            />
          );
        default:
          return (
            <List
              items={[item as ListItem]}
              onItemPress={() => console.log("Item pressed:", item)}
              scrollable={false}
            />
          );
      }
    },
    [type],
  );

  // Get footer buttons based on type
  const footerButtons = useMemo(() => {
    const buttons = [
      {
        label: "Back",
        onPress: () => navigation.goBack(),
        variant: "outline" as ButtonVariant,
      },
    ];

    // Add type-specific buttons
    switch (type) {
      case "activity":
        buttons.push({
          label: "Mark All Read",
          onPress: () => console.log("Mark all as read"),
          variant: "primary" as ButtonVariant,
        });
        break;
      case "favorites":
        buttons.push({
          label: "Add New",
          onPress: () => console.log("Add new favorite"),
          variant: "primary" as ButtonVariant,
        });
        break;
      case "settings":
        buttons.push({
          label: "Save Changes",
          onPress: () => console.log("Save settings"),
          variant: "primary" as ButtonVariant,
        });
        break;
    }

    return buttons;
  }, [type, navigation]);

  return (
    <Screen
      bannerTitle={title || "List View"}
      bannerDescription={`Comprehensive view of ${type} items`}
      bannerEmoji={
        type === "activity"
          ? "📱"
          : type === "favorites"
            ? "❤️"
            : type === "settings"
              ? "⚙️"
              : "🗺️"
      }
      onBack={() => navigation.goBack()}
      isScrollable={false}
      footerButtons={footerButtons}
    >
      <View style={styles.listContainer}>
        <InfiniteScrollFlatList
          data={items}
          renderItem={renderItem}
          fetchMoreData={fetchMoreData}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          hasMore={hasMore}
          emptyListMessage={`No ${type} items found`}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    minHeight: 0, // Important for flex to work properly with nested scrollable views
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16, // Add some padding at the bottom for better spacing with footer
  },
});

export default ListScreen;
