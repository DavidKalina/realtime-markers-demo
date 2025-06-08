import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Bell, Trash2 } from "lucide-react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";

export interface NotificationListItemProps {
  id: string;
  title: string;
  message: string;
  read: boolean;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
}

const NotificationListItem: React.FC<NotificationListItemProps> = ({
  id,
  title,
  message,
  read,
  onPress,
  onDelete,
}) => {
  const handlePress = () => {
    onPress(id);
  };

  const handleDelete = () => {
    onDelete(id);
  };

  return (
    <TouchableOpacity
      style={[styles.notificationItem, !read && styles.unreadItem]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={styles.iconContainer}>
            <Bell
              size={18}
              color={read ? COLORS.textSecondary : COLORS.accent}
              style={styles.icon}
            />
          </View>
          <View style={styles.titleContainer}>
            <Text
              style={[styles.notificationTitle, !read && styles.unreadTitle]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={styles.notificationMessage} numberOfLines={2}>
              {message}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  notificationItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  unreadItem: {
    backgroundColor: "rgba(147, 197, 253, 0.05)",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  icon: {
    opacity: 0.9,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 8,
  },
  notificationTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  unreadTitle: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  notificationMessage: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    lineHeight: 15,
    opacity: 0.8,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
});

export default NotificationListItem;
