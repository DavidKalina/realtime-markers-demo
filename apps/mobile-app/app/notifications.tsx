import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import ScreenLayout from "@/components/Layout/ScreenLayout";
import Header from "@/components/Layout/Header";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient } from "@/services/ApiClient";
import { Notification } from "@/services/ApiClient";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([
        apiClient.getNotifications({ take: 50 }),
        apiClient.getUnreadNotificationCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count.count);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await apiClient.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await apiClient.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      if (!notifications.find((n) => n.id === notificationId)?.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      await apiClient.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const renderNotification = ({ item: notification }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !notification.read && styles.unreadNotification]}
      onPress={() => handleMarkAsRead(notification.id)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationMessage}>{notification.message}</Text>
        <Text style={styles.notificationTime}>
          {new Date(notification.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteNotification(notification.id)}
      >
        <Trash2 size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <ScreenLayout>
      <Header
        onBack={() => router.back()}
        title="Notifications"
        rightIcon={
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
            disabled={notifications.length === 0}
          >
            <Bell size={22} color={COLORS.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.textSecondary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  unreadNotification: {
    backgroundColor: COLORS.cardBackgroundAlt,
    borderColor: COLORS.accent,
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 4,
  },
  notificationTime: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  clearButton: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 16,
  },
});
