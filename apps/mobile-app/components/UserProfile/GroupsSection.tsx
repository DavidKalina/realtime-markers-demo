import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Users } from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";
import List from "../Layout/List";

interface Group {
  id: string;
  name: string;
  memberCount: number;
  updatedAt?: string;
  visibility: "PUBLIC" | "PRIVATE";
}

interface GroupsSectionProps {
  groups: Group[];
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
}

const formatLastActive = (date: string) => {
  const now = new Date();
  const lastActive = new Date(date);
  const diffInMinutes = Math.floor(
    (now.getTime() - lastActive.getTime()) / (1000 * 60),
  );

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
};

const GroupsSection: React.FC<GroupsSectionProps> = ({
  groups,
  isLoading,
  error,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading groups...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <List
        items={groups.slice(0, 10).map((group) => ({
          id: group.id,
          icon: Users,
          title: group.name,
          description: `${group.memberCount} members${
            group.updatedAt
              ? ` • Updated ${formatLastActive(group.updatedAt)}`
              : ""
          }`,
          badge: group.visibility === "PUBLIC" ? "Public" : "Private",
        }))}
        scrollable={false}
        onItemPress={(item) => console.log("Group pressed:", item)}
        emptyState={{
          icon: Users,
          title: "No Groups Yet",
          description: "Join or create a group to get started",
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  errorContainer: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 12,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 8,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default GroupsSection;
