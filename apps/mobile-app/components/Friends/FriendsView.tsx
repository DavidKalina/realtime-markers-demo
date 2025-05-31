import { apiClient, Friend, FriendRequest } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Search, User, UserPlus, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Screen, { Section } from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import Input from "../Input/Input";
import Card from "../Layout/Card";
import List from "../Layout/List";

type TabType = "friends" | "requests" | "add";

const FriendsView: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<
    (FriendRequest & { type: "incoming" | "outgoing" })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleTabSwitch = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  // Fetch friends and requests
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [friendsResponse, incomingResponse, outgoingResponse] =
          await Promise.all([
            apiClient.friends.getFriends(),
            apiClient.friends.getPendingFriendRequests(),
            apiClient.friends.getOutgoingFriendRequests(),
          ]);

        console.log(
          "Incoming requests:",
          JSON.stringify(incomingResponse, null, 2),
        );
        console.log(
          "Outgoing requests:",
          JSON.stringify(outgoingResponse, null, 2),
        );

        setFriends(friendsResponse);

        // Combine and label the requests
        const combinedRequests = [
          ...incomingResponse
            .filter((req): req is FriendRequest =>
              Boolean(req && req.requester),
            )
            .map((req) => ({
              ...req,
              type: "incoming" as const,
            })),
          ...outgoingResponse
            .filter((req): req is FriendRequest =>
              Boolean(req && req.addressee),
            )
            .map((req) => ({
              ...req,
              type: "outgoing" as const,
            })),
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        setRequests(combinedRequests);
        setError(null);
      } catch (err) {
        setError("Failed to load friends data. Please try again.");
        console.error("Error fetching friends data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

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

  // Memoize sections based on active tab
  const sections = React.useMemo<Section[]>(() => {
    switch (activeTab) {
      case "friends":
        return [
          {
            title: "Friends",
            icon: Users,
            content: isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
              </View>
            ) : error ? (
              <Card>
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => setIsLoading(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : friends.length === 0 ? (
              <Card>
                <View style={styles.emptyContainer}>
                  <Users
                    size={40}
                    color={COLORS.accent}
                    style={{ opacity: 0.6 }}
                  />
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptyDescription}>
                    Add friends to share events and discover together!
                  </Text>
                </View>
              </Card>
            ) : (
              <List
                items={friends.map((friend) => ({
                  id: friend.id,
                  icon: User,
                  title: friend.displayName || friend.email,
                  description: friend.displayName ? friend.email : undefined,
                }))}
              />
            ),
          },
        ];

      case "requests":
        return [
          {
            title: "Friend Requests",
            icon: UserPlus,
            content: isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
              </View>
            ) : error ? (
              <Card>
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => setIsLoading(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : requests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <UserPlus
                  size={40}
                  color={COLORS.accent}
                  style={{ opacity: 0.6 }}
                />
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptyDescription}>
                  Friend requests you send or receive will appear here
                </Text>
              </View>
            ) : (
              <List
                items={requests
                  .filter(
                    (
                      request,
                    ): request is FriendRequest & {
                      type: "incoming" | "outgoing";
                    } =>
                      Boolean(
                        request &&
                          ((request.type === "incoming" && request.requester) ||
                            (request.type === "outgoing" && request.addressee)),
                      ),
                  )
                  .map((request) => ({
                    id: request.id,
                    icon: User,
                    title:
                      request.type === "incoming"
                        ? request.requester.displayName ||
                          request.requester.email
                        : request.addressee.displayName ||
                          request.addressee.email,
                    description:
                      request.type === "incoming"
                        ? request.requester.displayName
                          ? request.requester.email
                          : undefined
                        : request.addressee.displayName
                          ? request.addressee.email
                          : undefined,
                    badge: request.type.toUpperCase(),
                    rightElement: actionStates[request.id] ? (
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
                    ) : request.type === "incoming" ? (
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.acceptButton]}
                          onPress={() => handleAcceptRequest(request.id)}
                        >
                          <Text style={styles.acceptButtonText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.rejectButton]}
                          onPress={() => handleRejectRequest(request.id)}
                        >
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleCancelRequest(request.id)}
                      >
                        <Text style={styles.rejectButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    ),
                  }))}
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
                <Text style={styles.helpTitle}>How to add friends</Text>
                <View style={styles.helpContent}>
                  <View style={styles.helpItem}>
                    <UserPlus size={16} color={COLORS.accent} />
                    <Text style={styles.helpText}>Enter their username</Text>
                  </View>
                  <View style={styles.helpItem}>
                    <User size={16} color={COLORS.accent} />
                    <Text style={styles.helpText}>Enter their friend code</Text>
                  </View>
                  <View style={styles.helpItem}>
                    <Users size={16} color={COLORS.accent} />
                    <Text style={styles.helpText}>
                      Share your friend code with them
                    </Text>
                  </View>
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
    error,
    actionStates,
    searchQuery,
    isSearching,
    searchFeedback,
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
      isScrollable
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
    gap: 12,
  },
  helpText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  actionFeedback: {
    flex: 1,
    fontSize: 13,
    fontFamily: "SpaceMono",
    textAlign: "right",
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
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: "rgba(64, 192, 87, 0.12)",
    borderColor: "rgba(64, 192, 87, 0.3)",
  },
  acceptButtonText: {
    color: "#40c057",
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  rejectButton: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  rejectButtonText: {
    color: "#dc2626",
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  addFriendsContainer: {
    flex: 1,
    padding: 4,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
});

export default FriendsView;
