import React, { useEffect, useCallback } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Mail, MailOpen } from "lucide-react-native";

import Screen from "@/components/Layout/Screen";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import NotificationListItem from "@/components/Notification/NotificationListItem";
import { useNotifications } from "@/hooks/useNotifications";
import { apiClient } from "@/services/ApiClient";

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    refreshing,
    initialLoading,
    activeFilter,
    onRefresh,
    handleMarkAsRead,
    handleDeleteNotification,
    setFilter,
    resetUnreadCount,
    onEndReached,
    hasMore,
  } = useNotifications();

  const handleFetchMore = useCallback(async () => {
    onEndReached();
  }, [onEndReached]);

  // Reset unread count when screen mounts
  useEffect(() => {
    resetUnreadCount();
  }, []); // Empty dependency array means this runs once when mounted

  // Mark all notifications as read when the screen is opened
  useEffect(() => {
    const markAllAsRead = async () => {
      try {
        await apiClient.notifications.markAllNotificationsAsRead();
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
      }
    };
    markAllAsRead();
  }, []);

  const tabs = [
    {
      icon: Mail,
      label: "All",
      value: "all" as const,
    },
    {
      icon: MailOpen,
      label: "Unread",
      value: "unread" as const,
    },
  ];

  const renderItem = useCallback(
    (notification: (typeof notifications)[0]) => (
      <NotificationListItem
        id={notification.id}
        title={notification.title}
        message={notification.message}
        read={notification.read}
        onPress={handleMarkAsRead}
        onDelete={handleDeleteNotification}
      />
    ),
    [handleMarkAsRead, handleDeleteNotification],
  );

  return (
    <Screen
      bannerEmoji="🔔"
      bannerTitle="Notifications"
      showBackButton
      onBack={() => router.back()}
      tabs={tabs}
      activeTab={activeFilter}
      onTabChange={setFilter}
      isScrollable={false}
      style={styles.screen}
    >
      <InfiniteScrollFlatList
        data={notifications}
        renderItem={renderItem}
        fetchMoreData={handleFetchMore}
        onRefresh={onRefresh}
        isLoading={initialLoading}
        isRefreshing={refreshing}
        hasMore={hasMore}
        emptyListMessage={
          activeFilter === "unread"
            ? "No unread notifications"
            : "No notifications yet"
        }
        style={styles.list}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
});
