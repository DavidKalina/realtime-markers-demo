import React, { useCallback, useEffect, useState, useRef } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Search, Users, X } from "lucide-react-native";

import Header from "@/components/Layout/Header";
import ScreenLayout, { COLORS } from "@/components/Layout/ScreenLayout";
import GroupList, { GroupType } from "@/components/GroupList/GroupList";
import Input from "@/components/Input/Input";
import apiClient, { ClientGroup } from "@/services/ApiClient";

// Helper function to convert ClientGroup to GroupType
const convertToGroupType = (group: ClientGroup): GroupType => ({
  id: group.id,
  name: group.name,
  description: group.description || "",
  memberCount: group.memberCount,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
  emoji: group.emoji,
  createdBy: {
    id: group.ownerId,
    displayName: group.owner?.displayName || "",
    email: group.owner?.email || "",
  },
});

// Main GroupsView component
const GroupsView: React.FC = () => {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);
  const pageSize = 10;

  // Add refs to track mounted state and prevent state updates after unmount
  const isMounted = useRef(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const fetchGroupsRef = useRef<typeof fetchGroups>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleGroupPress = useCallback(
    (group: GroupType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/group/${group.id}`);
    },
    [router]
  );

  const fetchGroups = useCallback(
    async (refresh = false) => {
      if (!isMounted.current) return;

      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setGroups([]);
        } else if (!refresh && !isLoading) {
          setIsFetchingMore(true);
        }

        let response;
        if (searchQuery.trim()) {
          response = await apiClient.searchGroups(searchQuery.trim(), {
            limit: pageSize,
            cursor: refresh ? undefined : cursor,
          });
        } else {
          response = await apiClient.listPublicGroups({
            limit: pageSize,
            cursor: refresh ? undefined : cursor,
          });
        }

        if (!isMounted.current) return;

        setHasMore(!!response.nextCursor);
        setCursor(response.nextCursor);

        // Convert ClientGroup[] to GroupType[]
        const convertedGroups = response.groups.map(convertToGroupType);

        if (refresh) {
          setGroups(convertedGroups);
        } else {
          // Use Set to efficiently track existing group IDs
          const existingGroupIds = new Set(groups.map((group) => group.id));
          const newGroups = convertedGroups.filter((group) => !existingGroupIds.has(group.id));

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
          setIsFetchingMore(false);
          setIsSearching(false);
        }
      }
    },
    [cursor, groups, searchQuery, isLoading]
  );

  // Update the ref whenever fetchGroups changes
  useEffect(() => {
    fetchGroupsRef.current = fetchGroups;
  }, [fetchGroups]);

  // Effect to handle group search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        if (isMounted.current && fetchGroupsRef.current) {
          setCursor(undefined);
          setHasMore(true);
          setGroups([]);
          fetchGroupsRef.current(true);
        }
      }, 500);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]); // Remove fetchGroups from dependencies

  // Initial fetch - only when component mounts and no search query
  useEffect(() => {
    if (!searchQuery.trim() && fetchGroupsRef.current) {
      fetchGroupsRef.current(true);
    }
  }, []); // Empty dependency array since we only want this on mount

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fetchGroupsRef.current) {
      fetchGroupsRef.current(true);
    }
  }, []); // Remove fetchGroups from dependencies

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isFetchingMore || !cursor) return;

    const now = Date.now();
    if (now - lastLoadMoreAttempt < 2000) return; // Prevent rapid load more attempts
    setLastLoadMoreAttempt(now);

    if (fetchGroupsRef.current) {
      fetchGroupsRef.current();
    }
  }, [hasMore, isFetchingMore, cursor, lastLoadMoreAttempt]); // Remove fetchGroups from dependencies

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setCursor(undefined);
    setHasMore(true);
    setGroups([]);
    if (fetchGroupsRef.current) {
      fetchGroupsRef.current(true);
    }
  }, []); // Remove fetchGroups from dependencies

  return (
    <ScreenLayout>
      <Header title="Groups" onBack={handleBack} />
      <View style={styles.contentArea}>
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            icon={Search}
            rightIcon={searchQuery ? X : undefined}
            onRightIconPress={handleClearSearch}
            loading={isSearching}
            style={styles.searchInput}
          />
        </View>
        <GroupList
          groups={groups}
          isLoading={isLoading}
          isFetchingMore={isFetchingMore}
          error={error}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
          onRetry={() => fetchGroups(true)}
          onGroupPress={handleGroupPress}
          emptyStateTitle={searchQuery.trim() ? "No groups found" : "No groups found"}
          emptyStateDescription={
            searchQuery.trim()
              ? "Try adjusting your search or browse all groups."
              : "Groups you create or join will appear here. Create a group to get started!"
          }
          emptyStateIcon={<Users size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />}
        />
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchContainer: {
    marginVertical: 12,
  },
  searchInput: {
    marginBottom: 0,
  },
});

export default GroupsView;
