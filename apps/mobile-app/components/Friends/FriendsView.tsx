import apiClient from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Search, User, UserPlus, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Header from "../Layout/Header";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import Tabs, { TabItem } from "../Layout/Tabs";
import Input from "../Input/Input";
import Card from "../Layout/Card";

type TabType = "friends" | "requests" | "add";
type Friend = {
  id: string;
  displayName?: string;
  email: string;
  avatarUrl?: string;
};

type FriendRequest = {
  id: string;
  requester: Friend;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
};

const FriendsView: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

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
        const response = await apiClient.getFriends();
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
          <View style={styles.friendContent}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {friend.displayName?.[0]?.toUpperCase() || friend.email[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{friend.displayName || friend.email}</Text>
              {friend.displayName && <Text style={styles.friendEmail}>{friend.email}</Text>}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
};

const FriendRequestsList: React.FC = () => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await apiClient.getPendingFriendRequests();
        setRequests(response);
        setError(null);
      } catch (err) {
        setError("Failed to load friend requests. Please try again.");
        console.error("Error fetching friend requests:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await apiClient.acceptFriendRequest(requestId);
      setRequests(requests.filter((request) => request.id !== requestId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Error accepting friend request:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await apiClient.rejectFriendRequest(requestId);
      setRequests(requests.filter((request) => request.id !== requestId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Error rejecting friend request:", err);
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
          <Text style={styles.emptyDescription}>Friend requests you receive will appear here</Text>
        </View>
      </Card>
    );
  }

  return (
    <View>
      {requests.map((request) => (
        <Card key={request.id} style={styles.requestCard}>
          <View style={styles.requestContent}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {request.requester.displayName?.[0]?.toUpperCase() ||
                  request.requester.email[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.requestInfo}>
              <Text style={styles.friendName}>
                {request.requester.displayName || request.requester.email}
              </Text>
              {request.requester.displayName && (
                <Text style={styles.friendEmail}>{request.requester.email}</Text>
              )}
            </View>
          </View>
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
        </Card>
      ))}
    </View>
  );
};

const AddFriends: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      if (searchQuery.includes("@")) {
        // Handle email search
      } else if (searchQuery.length === 6 && /^[A-Z0-9]+$/.test(searchQuery)) {
        await apiClient.sendFriendRequestByCode(searchQuery);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await apiClient.sendFriendRequestByUsername(searchQuery);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error("Error sending friend request:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View>
      <Card>
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
        </View>
      </Card>
      <Card style={styles.helpCard}>
        <Text style={styles.helpTitle}>How to add friends</Text>
        <Text style={styles.helpText}>
          • Enter their username{"\n"}• Enter their friend code{"\n"}• Share your friend code with
          them
        </Text>
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
  },
  friendContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  avatarText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  friendInfo: {
    marginLeft: 12,
    flex: 1,
  },
  friendName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  friendEmail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: "SpaceMono",
    marginTop: 2,
  },
  requestCard: {
    marginBottom: 8,
  },
  requestContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  requestInfo: {
    marginLeft: 12,
    flex: 1,
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: "rgba(64, 192, 87, 0.12)",
    borderColor: "rgba(64, 192, 87, 0.3)",
  },
  acceptButtonText: {
    color: "#40c057",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  rejectButton: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  rejectButtonText: {
    color: "#dc2626",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  searchContainer: {
    padding: 12,
  },
  helpCard: {
    marginTop: 12,
    padding: 16,
  },
  helpTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 12,
  },
  helpText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    lineHeight: 24,
  },
});

export default FriendsView;
