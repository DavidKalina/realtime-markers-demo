import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { User, UserPlus } from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";
import List from "../Layout/List";

interface Friend {
  id: string;
  displayName?: string;
  email?: string;
  lastSeen?: string;
  isOnline?: boolean;
}

interface FriendsSectionProps {
  friends: Friend[];
  isLoading: boolean;
}

const formatLastActive = (date: string) => {
  const now = new Date();
  const lastActive = new Date(date);
  const diffInMinutes = Math.floor(
    (now.getTime() - lastActive.getTime()) / (1000 * 60),
  );

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
};

const FriendsSection: React.FC<FriendsSectionProps> = ({
  friends,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading friends...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <List
        items={friends.slice(0, 5).map((friend) => ({
          id: friend.id,
          icon: User,
          title: friend.displayName || friend.email || "Unknown User",
          description: friend.lastSeen
            ? `Last seen ${formatLastActive(friend.lastSeen)}`
            : "Never seen",
          badge: friend.isOnline ? "Online" : undefined,
        }))}
        scrollable={false}
        onItemPress={(item) => console.log("Friend pressed:", item)}
        onViewAllPress={() => console.log("View all friends")}
        emptyState={{
          icon: UserPlus,
          title: "No Friends Yet",
          description: "Add friends to see them here",
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
});

export default FriendsSection;
