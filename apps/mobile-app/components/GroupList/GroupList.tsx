import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Users } from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";

export interface GroupType {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  emoji?: string;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  };
}

interface GroupListProps {
  groups: GroupType[];
  isLoading: boolean;
  isFetchingMore: boolean;
  error: string | null;
  onRefresh: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onGroupPress?: (group: GroupType) => void;
  style?: ViewStyle;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateIcon?: React.ReactNode;
}

const GroupList: React.FC<GroupListProps> = ({
  groups,
  isLoading,
  isFetchingMore,
  error,
  onRefresh,
  onLoadMore,
  onRetry,
  onGroupPress,
  style,
  emptyStateTitle = "No groups found",
  emptyStateDescription = "Groups you create or join will appear here.",
  emptyStateIcon = (
    <Users size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />
  ),
}) => {
  console.log(groups);

  const renderGroupItem = useCallback(
    ({ item: group }: { item: GroupType }) => (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => onGroupPress?.(group)}
        activeOpacity={0.7}
      >
        <View style={styles.groupHeader}>
          <View style={styles.groupTitleContainer}>
            {group.emoji && (
              <Text style={styles.groupEmoji}>{group.emoji}</Text>
            )}
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
          </View>
          <View style={styles.memberCount}>
            <Users size={14} color={COLORS.textSecondary} />
            <Text style={styles.memberCountText}>{group.memberCount}</Text>
          </View>
        </View>
        <Text style={styles.groupDescription} numberOfLines={2}>
          {group.description}
        </Text>
        <Text style={styles.createdBy}>
          Created by {group.createdBy?.displayName || group.createdBy?.email}
        </Text>
      </TouchableOpacity>
    ),
    [onGroupPress],
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        {emptyStateIcon}
        <Text style={styles.emptyStateTitle}>{emptyStateTitle}</Text>
        <Text style={styles.emptyStateDescription}>
          {emptyStateDescription}
        </Text>
      </View>
    ),
    [emptyStateIcon, emptyStateTitle, emptyStateDescription],
  );

  const renderError = useCallback(
    () => (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    ),
    [error, onRetry],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }, [isFetchingMore]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, style]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return renderError();
  }

  return (
    <FlatList
      data={groups}
      renderItem={renderGroupItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.listContent,
        groups.length === 0 && styles.emptyListContent,
        style,
      ]}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={renderEmptyState}
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingVertical: 12,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  groupCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  groupTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  groupEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    flex: 1,
    marginRight: 8,
  },
  memberCount: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.buttonBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  memberCountText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    marginBottom: 8,
    lineHeight: 20,
  },
  createdBy: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    textAlign: "center",
    lineHeight: 20,
  },
  errorContainer: {
    padding: 24,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: COLORS.errorText,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.buttonBackground,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  retryButtonText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
});

export default GroupList;
