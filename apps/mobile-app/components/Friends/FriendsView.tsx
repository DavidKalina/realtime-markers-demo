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
import Header from "../Layout/Header";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import Tabs, { TabItem } from "../Layout/Tabs";
import Input from "../Input/Input";
import Card from "../Layout/Card";

type TabType = "friends" | "requests" | "add";

const FriendsView: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("friends");

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleTabSwitch = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  const tabItems: TabItem<TabType>[] = [
    { icon: Users, label: "Friends", value: "friends" },
    { icon: UserPlus, label: "Requests", value: "requests" },
    { icon: Search, label: "Add", value: "add" },
  ];

  return (
    <ScreenLayout>
      <Header title="Friends" onBack={handleBack} />

      <Tabs<TabType>
        items={tabItems}
        activeTab={activeTab}
        onTabPress={handleTabSwitch}
        style={styles.tabsContainer}
      />

      <View style={styles.contentArea}>
        {activeTab === "friends" && <FriendsList />}
        {activeTab === "requests" && <FriendRequestsList />}
        {activeTab === "add" && <AddFriends />}
      </View>
    </ScreenLayout>
  );
};

const FriendsList: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await apiClient.friends.getFriends();
        setFriends(response);
        setError(null);
      } catch (err) {
        setError("Failed to load friends. Please try again.");
        console.error("Error fetching friends:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFriends();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (friends.length === 0) {
    return (
      <Card>
        <View style={styles.emptyContainer}>
          <Users size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptyDescription}>
            Add friends to share events and discover together!
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <View>
      {friends.map((friend) => (
        <Card key={friend.id} style={styles.friendCard}>
          <View style={styles.friendHeader}>
            <View style={styles.friendIconContainer}>
              <Text style={styles.avatarText}>
                {friend.displayName?.[0]?.toUpperCase() ||
                  friend.email[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>
                {friend.displayName || friend.email}
              </Text>
              {friend.displayName && (
                <Text style={styles.friendEmail}>{friend.email}</Text>
              )}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
};

const FriendRequestsList: React.FC = () => {
  const [requests, setRequests] = useState<
    (FriendRequest & { type: "incoming" | "outgoing" })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<
    Record<string, { status: "success" | "error"; message: string } | null>
  >({});

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const [incomingResponse, outgoingResponse] = await Promise.all([
          apiClient.friends.getPendingFriendRequests(),
          apiClient.friends.getOutgoingFriendRequests(),
        ]);

        // Combine and label the requests
        const combinedRequests = [
          ...incomingResponse.map((req) => ({
            ...req,
            type: "incoming" as const,
          })),
          ...outgoingResponse.map((req) => ({
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
        console.log("ERROR", err);
        setError("Failed to load friend requests. Please try again.");
        console.error("Error fetching friend requests:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
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

    // Only remove the request after showing the success message
    if (status === "success") {
      setTimeout(() => {
        setRequests((prev) =>
          prev.filter((request) => request.id !== requestId),
        );
      }, 1000);
    }

    // Clear the message after 2 seconds
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <View style={styles.emptyContainer}>
          <UserPlus size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptyDescription}>
            Friend requests you send or receive will appear here
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <View>
      {requests.map((request) => (
        <Card key={request.id} style={styles.requestCard}>
          <View style={styles.requestTypeContainer}>
            <Text
              style={[
                styles.requestTypeText,
                request.type === "outgoing"
                  ? styles.outgoingText
                  : styles.incomingText,
              ]}
            >
              {request.type === "outgoing" ? "OUTGOING" : "INCOMING"}
            </Text>
          </View>
          <View style={styles.friendHeader}>
            <View style={styles.friendIconContainer}>
              <Text style={styles.avatarText}>
                {request.type === "outgoing"
                  ? request.addressee.displayName?.[0]?.toUpperCase() ||
                    request.addressee.email[0].toUpperCase()
                  : request.requester.displayName?.[0]?.toUpperCase() ||
                    request.requester.email[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>
                {request.type === "outgoing"
                  ? request.addressee.displayName || request.addressee.email
                  : request.requester.displayName || request.requester.email}
              </Text>
              {(request.type === "outgoing"
                ? request.addressee.displayName
                : request.requester.displayName) && (
                <Text style={styles.friendEmail}>
                  {request.type === "outgoing"
                    ? request.addressee.email
                    : request.requester.email}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.requestActions}>
            {actionStates[request.id] && (
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
            )}
            {!actionStates[request.id] &&
              (request.type === "incoming" ? (
                <>
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
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleCancelRequest(request.id)}
                >
                  <Text style={styles.rejectButtonText}>Cancel</Text>
                </TouchableOpacity>
              ))}
          </View>
        </Card>
      ))}
    </View>
  );
};

const AddFriends: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [feedback, setFeedback] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

  const showFeedback = (status: "success" | "error", message: string) => {
    setFeedback({ status, message });
    setTimeout(() => {
      setFeedback(null);
    }, 2000);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      if (searchQuery.includes("@")) {
        // Handle email search
      } else if (searchQuery.length === 6 && /^[A-Z0-9]+$/.test(searchQuery)) {
        await apiClient.friends.sendFriendRequestByCode(searchQuery);
        showFeedback("success", "Friend request sent");
        setSearchQuery(""); // Clear input on success
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await apiClient.friends.sendFriendRequestByUsername(searchQuery);
        showFeedback("success", "Friend request sent");
        setSearchQuery(""); // Clear input on success
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send friend request";
      showFeedback("error", errorMessage);
      console.error("Error sending friend request:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View>
      <Card style={styles.searchCard}>
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
          {feedback && (
            <Text
              style={[
                styles.feedbackText,
                feedback.status === "success"
                  ? styles.successText
                  : styles.errorText,
              ]}
            >
              {feedback.message}
            </Text>
          )}
        </View>
      </Card>
      <Card style={styles.helpCard}>
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
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabsContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    color: "#dc2626",
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
  friendCard: {
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  requestCard: {
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
    position: "relative",
  },
  requestTypeContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  requestTypeText: {
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  outgoingText: {
    color: COLORS.textSecondary,
  },
  incomingText: {
    color: COLORS.accent,
  },
  friendHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  avatarText: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  friendInfo: {
    marginLeft: 10,
    flex: 1,
  },
  friendName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 2,
  },
  friendEmail: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 8,
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
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
});

export default FriendsView;
