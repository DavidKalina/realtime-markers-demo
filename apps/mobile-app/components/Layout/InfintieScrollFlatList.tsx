import React, { useCallback, useRef, useEffect } from "react";
import {
  FlatList,
  FlatListProps,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

interface InfiniteScrollFlatListProps<T>
  extends Omit<
    FlatListProps<T>,
    "data" | "renderItem" | "onRefresh" | "refreshing"
  > {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  fetchMoreData: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  isLoading: boolean;
  isRefreshing?: boolean;
  hasMore: boolean;
  error?: string | null;
  emptyListMessage?: string;
  loadingFooterComponent?: React.ReactElement;
  errorRetryComponent?: React.ReactElement;
  onRetry?: () => void;
  onEndReachedThreshold?: number;
}

const InfiniteScrollFlatList = <T extends { id: string | number }>({
  data,
  renderItem,
  fetchMoreData,
  onRefresh,
  isLoading,
  isRefreshing = false,
  hasMore,
  error,
  emptyListMessage = "No items found",
  loadingFooterComponent,
  errorRetryComponent,
  onRetry,
  onEndReachedThreshold = 0.1,
  ...props
}: InfiniteScrollFlatListProps<T>) => {
  const flatListRef = useRef<FlatList<T>>(null);
  const isLoadingMoreRef = useRef(false);

  // Reset loading ref when loading state changes
  useEffect(() => {
    if (!isLoading) {
      isLoadingMoreRef.current = false;
    }
  }, [isLoading]);

  const keyExtractor = useCallback((item: T) => item.id.toString(), []);

  const handleFetchMore = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (isLoadingMoreRef.current || isLoading || !hasMore || error) {
      return;
    }

    isLoadingMoreRef.current = true;
    try {
      await fetchMoreData();
    } catch (err) {
      // Error handling is managed by parent component
      console.warn("Failed to fetch more data:", err);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [fetchMoreData, hasMore, isLoading, error]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;

    try {
      await onRefresh();
    } catch (err) {
      console.warn("Failed to refresh data:", err);
    }
  }, [onRefresh, isRefreshing]);

  const renderFooter = useCallback(() => {
    if (error && onRetry) {
      return (
        errorRetryComponent || (
          <View style={styles.footer}>
            <Text style={styles.errorText}>Failed to load more items</Text>
            <Text style={styles.retryText} onPress={onRetry}>
              Tap to retry
            </Text>
          </View>
        )
      );
    }

    if (isLoading && data.length > 0) {
      return (
        loadingFooterComponent || (
          <View style={styles.footer}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Loading more...</Text>
          </View>
        )
      );
    }

    if (!hasMore && data.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={styles.endText}>No more items</Text>
        </View>
      );
    }

    return null;
  }, [
    error,
    isLoading,
    hasMore,
    data.length,
    loadingFooterComponent,
    errorRetryComponent,
    onRetry,
  ]);

  const renderEmptyComponent = useCallback(() => {
    if (isLoading && data.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          {onRetry && (
            <Text style={styles.retryText} onPress={onRetry}>
              Tap to retry
            </Text>
          )}
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyListMessage}</Text>
      </View>
    );
  }, [isLoading, error, data.length, emptyListMessage, onRetry]);

  return (
    <FlatList
      ref={flatListRef}
      showsVerticalScrollIndicator={false}
      data={data}
      renderItem={({ item, index }) => renderItem(item, index)}
      keyExtractor={keyExtractor}
      onEndReached={handleFetchMore}
      onEndReachedThreshold={onEndReachedThreshold}
      refreshing={isRefreshing}
      onRefresh={onRefresh ? handleRefresh : undefined}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmptyComponent}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={10}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  footer: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    fontFamily: "SpaceMono",
  },
  errorText: {
    fontSize: 14,
    color: "#e74c3c",
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  retryText: {
    fontSize: 14,
    color: "#3498db",
    marginTop: 8,
    textDecorationLine: "underline",
    fontFamily: "SpaceMono",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  endText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    fontFamily: "SpaceMono",
  },
});

export default InfiniteScrollFlatList;
