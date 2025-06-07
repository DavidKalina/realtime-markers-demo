import { apiClient, Friend, FriendRequest } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Check, Search, User, UserPlus, Users, X } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Screen, { Section } from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import Input from "../Input/Input";
import InfiniteScrollFlatList from "../Layout/InfintieScrollFlatList";

type TabType = "friends" | "requests" | "add";

const PAGE_SIZE = 20;

const FriendsView: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<
    (FriendRequest & { type: "incoming" | "outgoing" })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<
    Record<string, { status: "success" | "error"; message: string } | null>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

  // Pagination state
  const [friendsPage, setFriendsPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const [hasMoreFriends, setHasMoreFriends] = useState(true);
  const [hasMoreRequests, setHasMoreRequests] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleTabSwitch = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  // Fetch friends with pagination
  const fetchFriends = useCallback(async (page: number, isRefresh = false) => {
    try {
      const response = await apiClient.friends.getFriends();
      const newFriends = response;

      if (isRefresh) {
        setFriends(newFriends);
      } else {
        setFriends((prev) => [...prev, ...newFriends]);
      }

      setHasMoreFriends(newFriends.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError("Failed to load friends. Please try again.");
      console.error("Error fetching friends:", err);
    }
  }, []);

  // Fetch requests with pagination
  const fetchRequests = useCallback(async (page: number, isRefresh = false) => {
    try {
      console.log("Fetching friend requests...");
      const [incomingResponse, outgoingResponse] = await Promise.all([
        apiClient.friends.getPendingFriendRequests(),
        apiClient.friends.getOutgoingFriendRequests(),
      ]);

      console.log("Incoming friend requests:", incomingResponse);
      console.log("Outgoing friend requests:", outgoingResponse);

      const combinedRequests = [
        ...incomingResponse
          .filter((req): req is FriendRequest => Boolean(req && req.requester))
          .map((req) => ({ ...req, type: "incoming" as const })),
        ...outgoingResponse
          .filter((req): req is FriendRequest => Boolean(req && req.addressee))
          .map((req) => ({ ...req, type: "outgoing" as const })),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      console.log("Combined and filtered requests:", combinedRequests);

      if (isRefresh) {
        setRequests(combinedRequests);
      } else {
        setRequests((prev) => [...prev, ...combinedRequests]);
      }

      setHasMoreRequests(combinedRequests.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      console.error("Error details:", err);
      setError("Failed to load friend requests. Please try again.");
      console.error("Error fetching friend requests:", err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchFriends(1, true), fetchRequests(1, true)]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [fetchFriends, fetchRequests]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (activeTab === "friends") {
        await fetchFriends(1, true);
        setFriendsPage(1);
      } else if (activeTab === "requests") {
        await fetchRequests(1, true);
        setRequestsPage(1);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTab, fetchFriends, fetchRequests]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      if (activeTab === "friends" && hasMoreFriends) {
        const nextPage = friendsPage + 1;
        await fetchFriends(nextPage);
        setFriendsPage(nextPage);
      } else if (activeTab === "requests" && hasMoreRequests) {
        const nextPage = requestsPage + 1;
        await fetchRequests(nextPage);
        setRequestsPage(nextPage);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    activeTab,
    friendsPage,
    requestsPage,
    hasMoreFriends,
    hasMoreRequests,
    isLoadingMore,
    fetchFriends,
    fetchRequests,
  ]);

  const showActionFeedback = (
    requestId: string,
    status: "success" | "error",
    message: string,
  ) => {
    setActionStates((prev) => ({
      ...prev,
      [requestId]: { status, message },
    }));

    if (status === "success") {
      setTimeout(() => {
        setRequests((prev) =>
          prev.filter((request) => request.id !== requestId),
        );
      }, 1000);
    }

    setTimeout(() => {
      setActionStates((prev) => ({
        ...prev,
        [requestId]: null,
      }));
    }, 2000);
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await apiClient.friends.acceptFriendRequest(requestId);
      showActionFeedback(requestId, "success", "Friend request accepted");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      showActionFeedback(requestId, "error", "Failed to accept request");
      console.error("Error accepting friend request:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await apiClient.friends.rejectFriendRequest(requestId);
      showActionFeedback(requestId, "success", "Friend request rejected");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      showActionFeedback(requestId, "error", "Failed to reject request");
      console.error("Error rejecting friend request:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await apiClient.friends.cancelFriendRequest(requestId);
      showActionFeedback(requestId, "success", "Friend request canceled");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      showActionFeedback(requestId, "error", "Failed to cancel request");
      console.error("Error canceling friend request:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      if (searchQuery.includes("@")) {
        // Handle email search
      } else if (searchQuery.length === 6 && /^[A-Z0-9]+$/.test(searchQuery)) {
        await apiClient.friends.sendFriendRequestByCode(searchQuery);
        setSearchFeedback({
          status: "success",
          message: "Friend request sent",
        });
        setSearchQuery("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await apiClient.friends.sendFriendRequestByUsername(searchQuery);
        setSearchFeedback({
          status: "success",
          message: "Friend request sent",
        });
        setSearchQuery("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send friend request";
      setSearchFeedback({ status: "error", message: errorMessage });
      console.error("Error sending friend request:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSearching(false);
    }
  };

  const tabs = [
    { icon: Users, label: "Friends", value: "friends" as TabType },
    { icon: UserPlus, label: "Requests", value: "requests" as TabType },
    { icon: Search, label: "Add", value: "add" as TabType },
  ];

  const renderFriendItem = useCallback(
    (friend: Friend) => (
      <View style={styles.listItem}>
        <View style={styles.avatarContainer}>
          <User size={20} color={COLORS.accent} />
        </View>
        <View style={styles.listItemContent}>
          <Text style={styles.listItemTitle} numberOfLines={1}>
            {friend.displayName || friend.email}
          </Text>
          {friend.displayName && (
            <Text style={styles.listItemDescription} numberOfLines={1}>
              {friend.email}
            </Text>
          )}
        </View>
      </View>
    ),
    [],
  );

  const renderRequestItem = useCallback(
    (request: FriendRequest & { type: "incoming" | "outgoing" }) => {
      if (
        !request ||
        (request.type === "incoming" && !request.requester) ||
        (request.type === "outgoing" && !request.addressee)
      ) {
        return <View style={[styles.listItem, styles.emptyItem]} />;
      }

      const user =
        request.type === "incoming" ? request.requester : request.addressee;
      const isIncoming = request.type === "incoming";

      return (
        <View style={styles.listItem}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <User
                size={20}
                color={isIncoming ? COLORS.accent : COLORS.textSecondary}
              />
            </View>
            <View
              style={[
                styles.badgeContainer,
                isIncoming ? styles.incomingBadge : styles.outgoingBadge,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: isIncoming ? "#2b8a3e" : "#4f46e5" },
                ]}
              >
                {isIncoming ? "Incoming" : "Outgoing"}
              </Text>
            </View>
          </View>
          <View style={styles.listItemContent}>
            <View style={styles.listItemHeader}>
              <Text style={styles.listItemTitle} numberOfLines={1}>
                {user.displayName || user.email}
              </Text>
            </View>
            {user.displayName && (
              <Text style={styles.listItemDescription} numberOfLines={1}>
                {user.email}
              </Text>
            )}
          </View>
          {actionStates[request.id] ? (
            <Text
              style={[
                styles.actionFeedback,
                actionStates[request.id]?.status === "success"
                  ? styles.successText
                  : styles.errorText,
              ]}
            >
              {actionStates[request.id]?.message}
            </Text>
          ) : isIncoming ? (
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[styles.iconButton, styles.acceptButton]}
                onPress={() => handleAcceptRequest(request.id)}
              >
                <Check size={14} color="#40c057" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, styles.rejectButton]}
                onPress={() => handleRejectRequest(request.id)}
              >
                <X size={14} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.iconButton, styles.rejectButton]}
              onPress={() => handleCancelRequest(request.id)}
            >
              <X size={14} color="#dc2626" />
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [
      actionStates,
      handleAcceptRequest,
      handleRejectRequest,
      handleCancelRequest,
    ],
  );

  // Memoize sections based on active tab
  const sections = React.useMemo<Section[]>(() => {
    switch (activeTab) {
      case "friends":
        return [
          {
            title: "Friends",
            icon: Users,
            content: (
              <InfiniteScrollFlatList
                data={friends}
                renderItem={renderFriendItem}
                fetchMoreData={handleLoadMore}
                onRefresh={handleRefresh}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                hasMore={hasMoreFriends}
                error={error}
                emptyListMessage="No friends yet. Add friends to share events and discover together!"
                onRetry={() => {
                  setError(null);
                  setIsLoading(true);
                  fetchFriends(1, true);
                }}
              />
            ),
          },
        ];

      case "requests":
        return [
          {
            title: "Friend Requests",
            icon: UserPlus,
            content: (
              <InfiniteScrollFlatList
                data={requests}
                renderItem={renderRequestItem}
                fetchMoreData={handleLoadMore}
                onRefresh={handleRefresh}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                hasMore={hasMoreRequests}
                error={error}
                emptyListMessage="No pending requests. Friend requests you send or receive will appear here."
                onRetry={() => {
                  setError(null);
                  setIsLoading(true);
                  fetchRequests(1, true);
                }}
              />
            ),
          },
        ];

      case "add":
        return [
          {
            title: "Add Friends",
            icon: Search,
            content: (
              <View style={styles.addFriendsContainer}>
                <View style={styles.searchContainer}>
                  <Input
                    icon={Search}
                    placeholder="Enter username or friend code"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={handleSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    loading={isSearching}
                  />
                  {searchFeedback && (
                    <Text
                      style={[
                        styles.feedbackText,
                        searchFeedback.status === "success"
                          ? styles.successText
                          : styles.errorText,
                      ]}
                    >
                      {searchFeedback.message}
                    </Text>
                  )}
                </View>
              </View>
            ),
          },
        ];

      default:
        return [];
    }
  }, [
    activeTab,
    friends,
    requests,
    isLoading,
    isRefreshing,
    error,
    hasMoreFriends,
    hasMoreRequests,
    renderFriendItem,
    renderRequestItem,
    handleLoadMore,
    handleRefresh,
    fetchFriends,
    fetchRequests,
  ]);

  // Memoize footer buttons based on active tab
  const footerButtons = React.useMemo(() => {
    switch (activeTab) {
      case "friends":
        return [
          {
            label: "Add Friends",
            onPress: () => setActiveTab("add"),
            variant: "primary" as const,
          },
        ];
      case "requests":
        return [
          {
            label: "Add Friends",
            onPress: () => setActiveTab("add"),
            variant: "primary" as const,
          },
        ];
      case "add":
        return [
          {
            label: "Back to Friends",
            onPress: () => setActiveTab("friends"),
            variant: "outline" as const,
          },
        ];
      default:
        return [];
    }
  }, [activeTab]);

  return (
    <Screen<TabType>
      bannerTitle="Friends"
      bannerDescription={
        activeTab === "friends"
          ? "Connect with friends and share experiences"
          : activeTab === "requests"
            ? "Manage your friend requests"
            : "Add new friends to your network"
      }
      bannerEmoji={
        activeTab === "friends" ? "👥" : activeTab === "requests" ? "📨" : "🔍"
      }
      showBackButton={true}
      onBack={handleBack}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabSwitch}
      sections={sections}
      footerButtons={footerButtons}
      isScrollable={false}
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  retryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  emptyDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  searchCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  searchContainer: {
    width: "100%",
  },
  helpCard: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  helpTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 16,
  },
  helpContent: {
    gap: 12,
  },
  helpItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  helpText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    lineHeight: 18,
  },
  actionFeedback: {
    fontSize: 13,
    fontFamily: "SpaceMono",
    textAlign: "right",
    marginLeft: 8,
    minWidth: 120,
  },
  feedbackText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  successText: {
    color: "#40c057",
  },
  requestActions: {
    flexDirection: "row",
    gap: 3,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: "rgba(64, 192, 87, 0.08)",
    borderColor: "rgba(64, 192, 87, 0.2)",
  },
  rejectButton: {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderColor: "rgba(220, 38, 38, 0.2)",
  },
  addFriendsContainer: {
    flex: 1,
    padding: 4,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarSection: {
    flexDirection: "column",
    alignItems: "center",
    marginRight: 10,
    gap: 3,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(64, 192, 87, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeContainer: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  incomingBadge: {
    backgroundColor: "rgba(64, 192, 87, 0.15)",
  },
  outgoingBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listItemContent: {
    flex: 1,
    marginRight: 6,
  },
  listItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  listItemTitle: {
    fontSize: 14,
    fontFamily: "SpaceMono",
    color: COLORS.textPrimary,
    fontWeight: "600",
    flex: 1,
  },
  listItemDescription: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    color: COLORS.textSecondary,
  },
  emptyItem: {
    opacity: 0,
    height: 0,
    marginVertical: 0,
    padding: 0,
    borderWidth: 0,
  },
});

export default FriendsView;
