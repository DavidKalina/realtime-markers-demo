import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { Friend } from "@/services/ApiClient";

export interface FriendListItemProps {
  friend: Friend;
  onPress?: (friend: Friend) => void;
  emoji?: string;
}

const FriendListItem: React.FC<FriendListItemProps> = ({
  friend,
  onPress,
  emoji = "👤",
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress(friend);
    }
  };

  return (
    <TouchableOpacity
      style={styles.friendItem}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.friendContent}>
        <View style={styles.friendHeader}>
          {emoji && (
            <View style={styles.emojiContainer}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.friendTitle} numberOfLines={1}>
              {friend.displayName || friend.email}
            </Text>
            {friend.displayName && (
              <Text style={styles.friendEmail} numberOfLines={2}>
                {friend.email}
              </Text>
            )}
            <Text style={styles.statusText}>Friend</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  friendItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  friendContent: {
    flex: 1,
  },
  friendHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cardBackgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  emoji: {
    fontSize: 18,
  },
  titleContainer: {
    flex: 1,
  },
  friendTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 4,
  },
  friendEmail: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 4,
  },
  statusText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default FriendListItem;
