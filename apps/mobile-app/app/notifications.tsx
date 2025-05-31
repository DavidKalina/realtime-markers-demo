import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Bell, Mail, MailOpen, Trash2 } from "lucide-react-native";

import Screen from "@/components/Layout/Screen";
import List from "@/components/Layout/List";
import { useNotifications } from "@/hooks/useNotifications";
import { COLORS } from "@/components/Layout/ScreenLayout";
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
  } = useNotifications();

  // Reset unread count when screen mounts
  useEffect(() => {
    console.log("NotificationsScreen - screen mounted, resetting unread count");
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

  const listItems = notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    description: notification.message,
    icon: Bell,
    isActive: !notification.read,
    rightElement: (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteNotification(notification.id)}
      >
        <Trash2 size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    ),
    onPress: () => handleMarkAsRead(notification.id),
  }));

  return (
    <Screen
      bannerTitle="Notifications"
      showBackButton
      onBack={() => router.back()}
      tabs={tabs}
      activeTab={activeFilter}
      onTabChange={setFilter}
      isScrollable={false}
      style={styles.screen}
    >
      <List
        items={listItems}
        refreshing={refreshing}
        onRefresh={onRefresh}
        emptyState={
          initialLoading
            ? undefined
            : {
                icon: Bell,
                title:
                  activeFilter === "unread"
                    ? "No unread notifications"
                    : "No notifications yet",
                description:
                  "You'll see your notifications here when they arrive",
              }
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
