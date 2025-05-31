import { useCallback, useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import { apiClient } from "@/services/ApiClient";
import { Notification } from "@/services/ApiClient";

const PAGE_SIZE = 20;

export type NotificationType =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "LEVEL_UP"
  | "ACHIEVEMENT_UNLOCKED"
  | "SYSTEM";

export type NotificationFilter = "all" | "unread";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [selectedType] = useState<NotificationType | undefined>();

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
          unreadCountResponse =
            await apiClient.notifications.getUnreadNotificationCount();
          console.log("Unread count response:", unreadCountResponse);
          setUnreadCount(unreadCountResponse.count);
        } catch (error) {
          console.error("Error fetching unread count:", error);
          setUnreadCount(0);
        }

        // Then fetch notifications
        try {
          const notifs = await apiClient.notifications.getNotifications({
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
    [notifications.length, activeFilter, selectedType],
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
  }, [activeFilter, selectedType, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await apiClient.notifications.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await apiClient.notifications.deleteNotification(notificationId);
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notificationId),
      );
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
      await apiClient.notifications.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const setFilter = useCallback((filter: NotificationFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(filter);
  }, []);

  const resetUnreadCount = useCallback(async () => {
    try {
      // Just set the local state to 0 without making an API call
      setUnreadCount(0);
    } catch (error) {
      console.error("Error resetting unread count:", error);
    }
  }, []);

  return {
    notifications,
    refreshing,
    unreadCount,
    loading,
    initialLoading,
    hasMore,
    activeFilter,
    onRefresh,
    onEndReached,
    handleMarkAsRead,
    handleDeleteNotification,
    handleClearAll,
    setFilter,
    resetUnreadCount,
  };
}
