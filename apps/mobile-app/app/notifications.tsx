import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Bell, Trash2, Mail, MailOpen } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import ScreenLayout from "@/components/Layout/ScreenLayout";
import Header from "@/components/Layout/Header";
import Tabs from "@/components/Layout/Tabs";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient } from "@/services/ApiClient";
import { Notification } from "@/services/ApiClient";

const PAGE_SIZE = 20;

type NotificationType =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "LEVEL_UP"
  | "ACHIEVEMENT_UNLOCKED"
  | "SYSTEM";

type NotificationFilter = "all" | "unread";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [selectedType, setSelectedType] = useState<NotificationType | undefined>();

  const fetchNotifications = useCallback(
    async (refresh = false) => {
      try {
        setLoading(true);
        const skip = refresh ? 0 : notifications.length;

        console.log("Fetching notifications with params:", {
          skip,
          take: PAGE_SIZE,
          read: activeFilter === "all" ? undefined : false,
          type: selectedType,
        });

        // First try to get unread count
        let unreadCountResponse;
        try {
          unreadCountResponse = await apiClient.getUnreadNotificationCount();
          console.log("Unread count response:", unreadCountResponse);
          setUnreadCount(unreadCountResponse.count);
        } catch (error) {
          console.error("Error fetching unread count:", error);
          setUnreadCount(0);
        }

        // Then fetch notifications
        try {
          const notifs = await apiClient.getNotifications({
            skip,
            take: PAGE_SIZE,
            read: activeFilter === "all" ? undefined : false,
            type: selectedType,
          });

          console.log("Fetched notifications:", {
            count: notifs.length,
            firstNotification: notifs[0],
            lastNotification: notifs[notifs.length - 1],
            total: notifs.length,
          });

          if (refresh) {
            setNotifications(notifs);
          } else {
            setNotifications((prev) => [...prev, ...notifs]);
          }

          setHasMore(notifs.length === PAGE_SIZE);
        } catch (error) {
          console.error("Error fetching notifications:", error);
          // If it's a refresh, clear the notifications
          if (refresh) {
            setNotifications([]);
          }
        }
      } catch (error) {
        console.error("Error in fetchNotifications:", error);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [notifications.length, activeFilter, selectedType]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchNotifications(true);
    setRefreshing(false);
  }, [fetchNotifications]);

  const onEndReached = useCallback(() => {
    if (!loading && hasMore) {
      fetchNotifications();
    }
  }, [loading, hasMore, fetchNotifications]);

  useEffect(() => {
    setInitialLoading(true);
    fetchNotifications(true);
  }, [activeFilter, selectedType]);

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

  const renderNotification = ({
    item: notification,
    index,
  }: {
    item: Notification;
    index: number;
  }) => (
    <Animated.View
      entering={FadeInDown.duration(600)
        .delay(index * 100)
        .springify()}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify()}
    >
      <TouchableOpacity
        style={[styles.notificationItem, !notification.read && styles.unreadNotification]}
        onPress={() => handleMarkAsRead(notification.id)}
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
          onPress={() => handleDeleteNotification(notification.id)}
        >
          <Trash2 size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  const tabs = [
    {
      icon: Mail,
      label: "All",
      value: "all" as NotificationFilter,
    },
    {
      icon: MailOpen,
      label: "Unread",
      value: "unread" as NotificationFilter,
    },
  ];

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
      <View style={styles.contentArea}>
        <Tabs
          items={tabs}
          activeTab={activeFilter}
          onTabPress={(tab) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveFilter(tab);
          }}
        />
        {initialLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : (
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
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Bell size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>
                  {activeFilter === "unread" ? "No unread notifications" : "No notifications yet"}
                </Text>
              </View>
            }
            ListFooterComponent={
              loading && !initialLoading ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  listContent: {
    flexGrow: 1,
    padding: 12,
  },
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
  clearButton: {
    position: "relative",
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginTop: 16,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginTop: 16,
    textAlign: "center",
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
