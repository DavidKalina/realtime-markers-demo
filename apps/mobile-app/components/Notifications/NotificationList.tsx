import React from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { Bell } from "lucide-react-native";

import { COLORS } from "@/components/Layout/ScreenLayout";
import { Notification } from "@/services/api/base/types";
import { NotificationItem } from "./NotificationItem";

interface NotificationListProps {
  notifications: Notification[];
  refreshing: boolean;
  loading: boolean;
  initialLoading: boolean;
  activeFilter: "all" | "unread";
  onRefresh: () => void;
  onEndReached: () => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NotificationList({
  notifications,
  refreshing,
  loading,
  initialLoading,
  activeFilter,
  onRefresh,
  onEndReached,
  onMarkAsRead,
  onDelete,
}: NotificationListProps) {
  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      renderItem={({ item, index }) => (
        <NotificationItem
          notification={item}
          index={index}
          onPress={onMarkAsRead}
          onDelete={onDelete}
        />
      )}
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
            {activeFilter === "unread"
              ? "No unread notifications"
              : "No notifications yet"}
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
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    padding: 12,
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
  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
