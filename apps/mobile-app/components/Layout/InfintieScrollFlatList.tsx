import React, { useCallback, useRef, useEffect, useMemo } from "react";
import {
  FlatList,
  FlatListProps,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeIn,
  LinearTransition,
} from "react-native-reanimated";
import {
  useColors,
  type Colors,
  spacing,
  fontSize,
  fontFamily,
  spring,
  duration,
} from "@/theme";
import EmptyState from "./EmptyState";
import EndOfList from "./EndOfList";

interface InfiniteScrollFlatListProps<T> extends Omit<
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
  emptyEmoji?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyAction?: {
    label: string;
    onPress: () => void;
    variant?:
      | "primary"
      | "secondary"
      | "outline"
      | "ghost"
      | "warning"
      | "error";
  };
  endOfListMessage?: string;
  loadingFooterComponent?: React.ReactElement;
  errorRetryComponent?: React.ReactElement;
  onRetry?: () => void;
  onEndReachedThreshold?: number;
  animated?: boolean;
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
  emptyEmoji,
  emptyTitle,
  emptySubtitle,
  emptyAction,
  endOfListMessage,
  loadingFooterComponent,
  errorRetryComponent,
  onRetry,
  onEndReachedThreshold = 0.1,
  animated = true,
  ...props
}: InfiniteScrollFlatListProps<T>) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const flatListRef = useRef<FlatList<T>>(null);
  const isLoadingMoreRef = useRef(false);

  // Reset loading ref when loading state changes
  useEffect(() => {
    if (!isLoading) {
      isLoadingMoreRef.current = false;
    }
  }, [isLoading]);

  const keyExtractor = useCallback((item: T, index: number) => {
    if (!item || !item.id) {
      console.warn("Item or item.id is undefined:", item);
      return `fallback-${index}`; // Use index as fallback instead of random
    }
    return item.id.toString();
  }, []);

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
      const content = errorRetryComponent || (
        <View style={styles.footer}>
          <Text style={styles.errorText}>Failed to load more items</Text>
          <Text style={styles.retryText} onPress={onRetry}>
            Tap to retry
          </Text>
        </View>
      );
      return animated ? (
        <Animated.View entering={FadeIn.duration(duration.normal)}>
          {content}
        </Animated.View>
      ) : (
        content
      );
    }

    if (isLoading && data.length > 0) {
      const content = loadingFooterComponent || (
        <View style={styles.footer}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading more...</Text>
        </View>
      );
      return animated ? (
        <Animated.View entering={FadeIn.duration(duration.normal)}>
          {content}
        </Animated.View>
      ) : (
        content
      );
    }

    if (!hasMore && data.length > 0) {
      return <EndOfList message={endOfListMessage} animated={animated} />;
    }

    return null;
  }, [
    error,
    isLoading,
    hasMore,
    data.length,
    endOfListMessage,
    loadingFooterComponent,
    errorRetryComponent,
    onRetry,
    animated,
  ]);

  const hasRichEmptyState = !!(emptyEmoji || emptyTitle);

  const renderEmptyComponent = useCallback(() => {
    const wrap = (content: React.ReactElement) =>
      animated ? (
        <Animated.View entering={FadeIn.duration(duration.normal)}>
          {content}
        </Animated.View>
      ) : (
        content
      );

    if (isLoading && data.length === 0) {
      return wrap(
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>,
      );
    }

    if (error) {
      if (hasRichEmptyState) {
        return (
          <EmptyState
            emoji="😵"
            title="Something went wrong"
            subtitle={error}
            variant="error"
            animated={animated}
            action={
              onRetry
                ? { label: "Try Again", onPress: onRetry, variant: "error" }
                : undefined
            }
          />
        );
      }
      return wrap(
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          {onRetry && (
            <Text style={styles.retryText} onPress={onRetry}>
              Tap to retry
            </Text>
          )}
        </View>,
      );
    }

    if (hasRichEmptyState) {
      return (
        <EmptyState
          emoji={emptyEmoji || "📭"}
          title={emptyTitle || emptyListMessage}
          subtitle={emptySubtitle}
          action={emptyAction}
          animated={animated}
        />
      );
    }

    return wrap(
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyListMessage}</Text>
      </View>,
    );
  }, [
    isLoading,
    error,
    data.length,
    emptyListMessage,
    emptyEmoji,
    emptyTitle,
    emptySubtitle,
    emptyAction,
    hasRichEmptyState,
    onRetry,
    animated,
  ]);

  const itemLayoutAnimation = animated
    ? LinearTransition.springify()
        .damping(spring.firm.damping)
        .stiffness(spring.firm.stiffness)
    : undefined;

  return (
    <Animated.FlatList
      ref={flatListRef}
      showsVerticalScrollIndicator={false}
      data={data}
      renderItem={({ item, index }) => {
        const content = renderItem(item, index);
        if (!animated) return content;
        return (
          <Animated.View
            entering={FadeInDown.duration(duration.normal).delay(
              Math.min(index, 8) * 50,
            )}
          >
            {content}
          </Animated.View>
        );
      }}
      keyExtractor={keyExtractor}
      onEndReached={handleFetchMore}
      onEndReachedThreshold={onEndReachedThreshold}
      refreshing={isRefreshing}
      onRefresh={onRefresh ? handleRefresh : undefined}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmptyComponent}
      itemLayoutAnimation={itemLayoutAnimation}
      removeClippedSubviews={!animated}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={10}
      {...props}
    />
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  footer: {
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["3xl"],
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.status.error.text,
    textAlign: "center",
    fontFamily: fontFamily.mono,
  },
  retryText: {
    fontSize: fontSize.sm,
    color: colors.accent.primary,
    marginTop: spacing.sm,
    textDecorationLine: "underline",
    fontFamily: fontFamily.mono,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: "center",
    fontFamily: fontFamily.mono,
  },
});

export default InfiniteScrollFlatList;
