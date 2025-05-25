import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { COLORS } from "@/components/Layout/ScreenLayout";
import { Notification, NotificationType } from "@/services/api/base/types";

interface NotificationItemProps {
  notification: Notification;
  index: number;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "EVENT_CREATED":
    case "EVENT_UPDATED":
    case "EVENT_DELETED":
      return "🎉";
    case "FRIEND_REQUEST":
    case "FRIEND_ACCEPTED":
      return "👥";
    case "LEVEL_UP":
      return "⭐";
    case "ACHIEVEMENT_UNLOCKED":
      return "🏆";
    case "SYSTEM":
      return "🔔";
    default:
      return "📌";
  }
};

export function NotificationItem({
  notification,
  index,
  onPress,
  onDelete,
}: NotificationItemProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(600)
        .delay(index * 100)
        .springify()}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify()}
    >
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !notification.read && styles.unreadNotification,
        ]}
        onPress={() => onPress(notification.id)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationIcon}>
              {getNotificationIcon(notification.type as NotificationType)}
            </Text>
            <Text style={styles.notificationTitle} numberOfLines={2}>
              {notification.title}
            </Text>
          </View>
          <Text style={styles.notificationTime}>
            {new Date(notification.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(notification.id)}
        >
          <Trash2 size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadNotification: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationIcon: {
    fontSize: 16,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.buttonBackground,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    lineHeight: 32,
    textAlign: "center",
  },
  notificationTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.2,
    flex: 1,
  },
  notificationTime: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginTop: 2,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
});
