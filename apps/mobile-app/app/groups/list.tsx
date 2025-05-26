import React, { useCallback, useEffect, useState, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Search, X, Users } from "lucide-react-native";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import { COLORS } from "@/components/Layout/ScreenLayout";

// Helper function to convert ClientGroup to display format
const convertToGroupItem = (group: ClientGroup) => ({
  id: group.id,
  icon: Users,
  title: group.name,
  description: group.description || "",
  badge: group.memberCount > 100 ? `${group.memberCount} members` : undefined,
});

const GroupsListScreen = () => {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const fetchGroups = useCallback(
    async (refresh = false) => {
      if (!isMounted.current) return;

      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setGroups([]);
        }

        let response;
        if (searchQuery.trim()) {
          response = await apiClient.groups.searchGroups(searchQuery.trim(), {
            limit: 10,
            cursor: refresh ? undefined : cursor,
          });
        } else {
          // Use filter if provided
          switch (filter) {
            case "favorites":
              // TODO: Implement when API is available
              response = await apiClient.groups.listPublicGroups({
                limit: 10,
                cursor: refresh ? undefined : cursor,
              });
              break;
            case "recent":
              // TODO: Implement when API is available
              response = await apiClient.groups.listPublicGroups({
                limit: 10,
                cursor: refresh ? undefined : cursor,
              });
              break;
            case "nearby":
              // TODO: Implement when API is available
              response = await apiClient.groups.listPublicGroups({
                limit: 10,
                cursor: refresh ? undefined : cursor,
              });
              break;
            default:
              response = await apiClient.groups.listPublicGroups({
                limit: 10,
                cursor: refresh ? undefined : cursor,
              });
          }
        }

        if (!isMounted.current) return;

        setHasMore(!!response.nextCursor);
        setCursor(response.nextCursor);

        if (refresh) {
          setGroups(response.groups);
        } else {
          const existingGroupIds = new Set(
            groups.map((group: ClientGroup) => group.id),
          );
          const newGroups = response.groups.filter(
            (group: ClientGroup) => !existingGroupIds.has(group.id),
          );
          if (newGroups.length > 0) {
            setGroups((prev) => [...prev, ...newGroups]);
          }
        }

        setError(null);
      } catch (err) {
        if (!isMounted.current) return;
        setError("Failed to load groups. Please try again.");
        console.error("Error fetching groups:", err);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsSearching(false);
        }
      }
    },
    [cursor, groups, searchQuery, filter],
  );

  // Effect to handle search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        if (isMounted.current) {
          setCursor(undefined);
          setHasMore(true);
          setGroups([]);
          fetchGroups(true);
        }
      }, 500);
    } else {
      if (isMounted.current) {
        setCursor(undefined);
        setHasMore(true);
        setGroups([]);
        fetchGroups(true);
      }
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, fetchGroups]);

  // Initial fetch
  useEffect(() => {
    fetchGroups(true);
  }, [fetchGroups]);

  const handleRefresh = useCallback(async () => {
    await fetchGroups(true);
  }, [fetchGroups]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !cursor) return;
    await fetchGroups();
  }, [hasMore, cursor, fetchGroups]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleGroupPress = useCallback(
    (item: ReturnType<typeof convertToGroupItem>) => {
      router.push({
        pathname: "/group/[id]",
        params: { id: item.id },
      });
    },
    [router],
  );

  const getBannerTitle = () => {
    switch (filter) {
      case "favorites":
        return "Favorite Groups";
      case "recent":
        return "Recent Groups";
      case "nearby":
        return "Nearby Groups";
      default:
        return "All Groups";
    }
  };

  const getBannerDescription = () => {
    switch (filter) {
      case "favorites":
        return "Groups you've favorited";
      case "recent":
        return "Groups you've recently visited";
      case "nearby":
        return "Groups in your area";
      default:
        return "Discover and join groups";
    }
  };

  return (
    <Screen
      bannerTitle={getBannerTitle()}
      bannerDescription={getBannerDescription()}
      bannerEmoji="👥"
      showBackButton
      onBack={() => router.back()}
    >
      <Input
        placeholder="Search groups..."
        value={searchQuery}
        onChangeText={handleSearchChange}
        icon={Search}
        rightIcon={searchQuery ? X : undefined}
        onRightIconPress={handleClearSearch}
        loading={isSearching}
        style={{ marginHorizontal: 16, marginBottom: 16 }}
      />
      <InfiniteScrollFlatList
        data={groups.map(convertToGroupItem)}
        renderItem={(item) => (
          <TouchableOpacity
            style={styles.groupItem}
            onPress={() => handleGroupPress(item)}
          >
            <View style={styles.groupIconContainer}>
              <Users size={18} color={COLORS.textSecondary} />
            </View>
            <View style={styles.groupContent}>
              <Text style={styles.groupTitle}>{item.title}</Text>
              {item.description && (
                <Text style={styles.groupDescription}>{item.description}</Text>
              )}
            </View>
            {item.badge && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        fetchMoreData={handleLoadMore}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        hasMore={hasMore}
        error={error}
        emptyListMessage={
          searchQuery.trim()
            ? "No groups found matching your search"
            : "No groups found"
        }
        onRetry={async () => {
          await fetchGroups(true);
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  groupIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  groupContent: {
    flex: 1,
    marginRight: 8,
  },
  groupTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 2,
  },
  groupDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    opacity: 0.8,
  },
  badgeContainer: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
});

export default GroupsListScreen;
