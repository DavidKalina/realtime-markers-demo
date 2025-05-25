import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import ScreenLayout from "@/components/Layout/ScreenLayout";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationHeader } from "@/components/Notifications/NotificationHeader";
import { NotificationList } from "@/components/Notifications/NotificationList";

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    refreshing,
    unreadCount,
    loading,
    initialLoading,
    activeFilter,
    onRefresh,
    onEndReached,
    handleMarkAsRead,
    handleDeleteNotification,
    handleClearAll,
    setFilter,
  } = useNotifications();

  return (
    <ScreenLayout>
      <NotificationHeader
        unreadCount={unreadCount}
        activeFilter={activeFilter}
        onBack={() => router.back()}
        onClearAll={handleClearAll}
        onFilterChange={setFilter}
      />
      <View style={styles.contentArea}>
        <NotificationList
          notifications={notifications}
          refreshing={refreshing}
          loading={loading}
          initialLoading={initialLoading}
          activeFilter={activeFilter}
          onRefresh={onRefresh}
          onEndReached={onEndReached}
          onMarkAsRead={handleMarkAsRead}
          onDelete={handleDeleteNotification}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
  },
});
