import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    useAnimatedRef,
    useAnimatedScrollHandler,
    useSharedValue
} from "react-native-reanimated";
import EventItem from "../EventItem/EventItem";
import Card from "../Layout/Card";
import { COLORS } from "../Layout/ScreenLayout";

interface EventListProps {
    events: EventType[];
    isLoading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    hasSearched?: boolean;
    onRefresh?: () => void;
    onLoadMore?: () => void;
    onRetry?: () => void;
    emptyStateTitle?: string;
    emptyStateDescription?: string;
    emptyStateIcon?: React.ReactNode;
    showDistance?: boolean;
    showChevron?: boolean;
    keyboardHeight?: number;
    keyboardVisible?: boolean;
}

// Memoize the loading component
const LoadingComponent = React.memo(() => (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading events...</Text>
    </View>
));

// Memoize the error component
const ErrorComponent = React.memo(({ error, onRetry }: { error: string; onRetry?: () => void }) => (
    <Card style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
        )}
    </Card>
));

// Memoize the empty state component
const EmptyStateComponent = React.memo(({
    title,
    description,
    icon
}: {
    title: string;
    description: string;
    icon?: React.ReactNode
}) => (
    <Card style={styles.emptyStateContainer}>
        {icon && (
            <View style={styles.emptyStateIconContainer}>
                {icon}
            </View>
        )}
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateDescription}>{description}</Text>
    </Card>
));

// Memoize the loading footer component
const LoadingFooterComponent = React.memo(() => (
    <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={COLORS.accent} />
        <Text style={styles.loadingFooterText}>Loading more events...</Text>
    </View>
));

// Memoize the list header component
const ListHeaderComponent = React.memo(({ count, hasSearched }: { count: number; hasSearched: boolean }) => (
    <View style={styles.listHeader}>
        <Text style={styles.resultsText}>
            {hasSearched
                ? `${count} ${count === 1 ? "result" : "results"} found`
                : "Showing events"}
        </Text>
    </View>
));

const EventList: React.FC<EventListProps> = ({
    events,
    isLoading,
    isFetchingMore,
    error,
    hasSearched = false,
    onRefresh,
    onLoadMore,
    onRetry,
    emptyStateTitle = "No events found",
    emptyStateDescription = "Try searching for different events or check back later.",
    emptyStateIcon,
    showDistance = false,
    showChevron = false,
    keyboardHeight = 0,
    keyboardVisible = false,
}) => {
    const router = useRouter();
    const scrollY = useSharedValue(0);
    const listRef = useAnimatedRef<FlatList>();

    const handleSelectEvent = useCallback((event: EventType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (event.id) {
            router.push(`/details?eventId=${event.id}`);
        }
    }, [router]);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const renderItem = useCallback(({ item, index }: { item: EventType; index: number }) => (
        <EventItem
            event={item}
            onPress={handleSelectEvent}
            index={index}
            variant="default"
            showChevron={showChevron}
            showDistance={showDistance}
        />
    ), [handleSelectEvent, showChevron, showDistance]);

    // Memoize the content container style
    const contentContainerStyle = useMemo(() => [
        styles.listContent,
        keyboardVisible && { paddingBottom: keyboardHeight },
        events.length === 0 && hasSearched && { flexGrow: 1 },
    ], [keyboardVisible, keyboardHeight, events.length, hasSearched]);

    if (isLoading && events.length === 0) {
        return <LoadingComponent />;
    }

    if (error) {
        return <ErrorComponent error={error} onRetry={onRetry} />;
    }

    if (events.length === 0 && hasSearched) {
        return (
            <EmptyStateComponent
                title={emptyStateTitle}
                description={emptyStateDescription}
                icon={emptyStateIcon}
            />
        );
    }

    return (
        <Animated.FlatList
            ref={listRef}
            data={events}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            renderItem={renderItem}
            ListHeaderComponent={() => <ListHeaderComponent count={events.length} hasSearched={hasSearched} />}
            ListFooterComponent={() => isFetchingMore && <LoadingFooterComponent />}
            keyExtractor={(item) => `${item.id}-${item.time}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle}
            keyboardShouldPersistTaps="handled"
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.3}
            refreshing={isLoading}
            onRefresh={onRefresh}
        />
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 40,
    },
    loadingText: {
        color: COLORS.textSecondary,
        fontFamily: "SpaceMono",
        fontSize: 16,
        marginTop: 16,
    },
    loadingFooter: {
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
    },
    loadingFooterText: {
        color: COLORS.accent,
        fontFamily: "SpaceMono",
        fontSize: 14,
        marginLeft: 8,
    },
    errorContainer: {
        margin: 16,
        alignItems: 'center',
    },
    errorText: {
        color: COLORS.textSecondary,
        fontFamily: "SpaceMono",
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: COLORS.buttonBackground,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.buttonBorder,
    },
    retryButtonText: {
        color: COLORS.textPrimary,
        fontFamily: "SpaceMono",
        fontSize: 14,
    },
    emptyStateContainer: {
        margin: 16,
        alignItems: 'center',
        padding: 24,
    },
    emptyStateIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(147, 197, 253, 0.15)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(147, 197, 253, 0.3)",
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: COLORS.textPrimary,
        fontFamily: "SpaceMono",
        marginBottom: 8,
    },
    emptyStateDescription: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontFamily: "SpaceMono",
        textAlign: 'center',
        lineHeight: 20,
    },
    listContent: {
        paddingBottom: 24,
    },
    listHeader: {
        marginVertical: 8,
    },
    resultsText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontFamily: "SpaceMono",
    },
});

export default React.memo(EventList); 