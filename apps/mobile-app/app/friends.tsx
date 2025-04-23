import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import Header from "@/components/Layout/Header";
import ScreenLayout from "@/components/Layout/ScreenLayout";
import Card from "@/components/Layout/Card";
import Animated, { FadeInDown } from "react-native-reanimated";

// Unified color theme matching UserProfile
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
  success: {
    background: "rgba(64, 192, 87, 0.12)",
    border: "rgba(64, 192, 87, 0.2)",
    text: "#40c057",
  },
  error: {
    background: "rgba(220, 38, 38, 0.1)",
    border: "rgba(220, 38, 38, 0.3)",
    text: "#dc2626",
  },
};

interface Friend {
  id: string;
  displayName?: string;
  email: string;
  avatarUrl?: string;
  username?: string;
  friendCode?: string;
}

interface FriendRequest {
  id: string;
  requester: Friend;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
}

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [friendCode, setFriendCode] = useState("");
  const [username, setUsername] = useState("");
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  useEffect(() => {
    loadFriends();
    loadPendingRequests();
  }, []);

  const loadFriends = async () => {
    try {
      const data = await apiClient.getFriends();
      setFriends(data);
    } catch (error) {
      console.error("Error loading friends:", error);
      Alert.alert("Error", "Failed to load friends");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const data = await apiClient.getPendingFriendRequests();
      setPendingRequests(data);
    } catch (error) {
      console.error("Error loading pending requests:", error);
    }
  };

  const handleAddFriend = async () => {
    if (!friendCode && !username) {
      Alert.alert("Error", "Please enter either a friend code or username");
      return;
    }

    try {
      setIsAddingFriend(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (friendCode) {
        await apiClient.sendFriendRequestByCode(friendCode);
      } else {
        await apiClient.sendFriendRequestByUsername(username);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Friend request sent successfully");
      setFriendCode("");
      setUsername("");
      loadPendingRequests();
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      Alert.alert("Error", error.message || "Failed to send friend request");
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await apiClient.acceptFriendRequest(requestId);
      loadPendingRequests();
      loadFriends();
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "Failed to accept friend request");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await apiClient.rejectFriendRequest(requestId);
      loadPendingRequests();
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      Alert.alert("Error", "Failed to reject friend request");
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <Animated.View entering={FadeInDown.duration(600).springify()}>
      <TouchableOpacity
        style={styles.friendItem}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: "/user",
            params: { id: item.id },
          });
        }}
        activeOpacity={0.8}
      >
        <View style={styles.friendAvatar}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color={COLORS.textSecondary} />
          )}
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.displayName || item.username || "Anonymous"}</Text>
          <Text style={styles.friendEmail}>{item.email}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderPendingRequest = ({ item }: { item: FriendRequest }) => (
    <Animated.View entering={FadeInDown.duration(600).springify()}>
      <View style={styles.requestItem}>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>
            {item.requester.displayName || item.requester.username || "Anonymous"}
          </Text>
          <Text style={styles.requestEmail}>{item.requester.email}</Text>
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.requestButton, styles.acceptButton]}
            onPress={() => handleAcceptRequest(item.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={20} color={COLORS.success.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.requestButton, styles.rejectButton]}
            onPress={() => handleRejectRequest(item.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color={COLORS.error.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <ScreenLayout>
      <Header title="Friends" onBack={handleBack} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Card delay={100}>
          <Text style={styles.sectionTitle}>Add Friend</Text>
          <View style={styles.addFriendContainer}>
            <TextInput
              style={styles.input}
              placeholder="Friend Code (e.g., ABC123)"
              placeholderTextColor={COLORS.textSecondary}
              value={friendCode}
              onChangeText={setFriendCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <Text style={styles.orText}>or</Text>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={COLORS.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddFriend}
              disabled={isAddingFriend}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-add"
                size={20}
                color={COLORS.accent}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addButtonText}>
                {isAddingFriend ? "Adding..." : "Add Friend"}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {pendingRequests.length > 0 && (
          <Card delay={200}>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            <FlatList
              data={pendingRequests}
              renderItem={renderPendingRequest}
              keyExtractor={(item) => item.id}
              style={styles.requestsList}
              scrollEnabled={false}
            />
          </Card>
        )}

        <Card delay={300}>
          <Text style={styles.sectionTitle}>Your Friends</Text>
          {isLoading ? (
            <Text style={styles.loadingText}>Loading friends...</Text>
          ) : friends.length === 0 ? (
            <Text style={styles.emptyText}>No friends yet</Text>
          ) : (
            <FlatList
              data={friends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.id}
              style={styles.friendsList}
              scrollEnabled={false}
            />
          )}
        </Card>
      </Animated.ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  addFriendContainer: {
    gap: 12,
  },
  input: {
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 12,
    padding: 12,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  orText: {
    textAlign: "center",
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontSize: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  addButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  friendsList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  requestsList: {
    marginBottom: 16,
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  requestEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  requestActions: {
    flexDirection: "row",
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: COLORS.success.background,
    borderColor: COLORS.success.border,
  },
  rejectButton: {
    backgroundColor: COLORS.error.background,
    borderColor: COLORS.error.border,
  },
  loadingText: {
    textAlign: "center",
    color: COLORS.textSecondary,
    marginTop: 24,
    fontFamily: "SpaceMono",
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textSecondary,
    marginTop: 24,
    fontFamily: "SpaceMono",
  },
});
