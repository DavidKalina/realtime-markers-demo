import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Bell } from "lucide-react-native";

import { COLORS } from "@/components/Layout/ScreenLayout";
import Header from "@/components/Layout/Header";
import Tabs from "@/components/Layout/Tabs";
import { Mail, MailOpen } from "lucide-react-native";

interface NotificationHeaderProps {
  unreadCount: number;
  activeFilter: "all" | "unread";
  onBack: () => void;
  onClearAll: () => void;
  onFilterChange: (filter: "all" | "unread") => void;
}

export function NotificationHeader({
  unreadCount,
  activeFilter,
  onBack,
  onClearAll,
  onFilterChange,
}: NotificationHeaderProps) {
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

  return (
    <>
      <Header
        onBack={onBack}
        title="Notifications"
        rightIcon={
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClearAll}
            disabled={unreadCount === 0}
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
          onTabPress={onFilterChange}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  contentArea: {
    paddingTop: 8,
    paddingHorizontal: 16,
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
});
