import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import DiscovererCardOverlay from "@/components/EventDetails/DiscovererCardOverlay";
import { useFollowing } from "@/hooks/useFollowing";
import { FollowedUser } from "@/services/api/modules/follows";
import { getTierByName } from "@/utils/gamification";
import {
  useColors,
  spacing,
  radius,
  fontSize,
  fontFamily,
  fontWeight,
  type Colors,
} from "@/theme";

const TIER_COLORS: Record<string, string> = {
  Explorer: "#93c5fd",
  Scout: "#34d399",
  Curator: "#fbbf24",
  Ambassador: "#a78bfa",
};

const FollowingScreen = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { users, isLoading, error, hasMore, loadMore, refresh, unfollowUser } =
    useFollowing();

  const [overlayUser, setOverlayUser] = useState<FollowedUser | null>(null);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleRowPress = useCallback((user: FollowedUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOverlayUser(user);
  }, []);

  const handleUnfollow = useCallback(
    (userId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      unfollowUser(userId);
    },
    [unfollowUser],
  );

  const handleDismissOverlay = useCallback(() => {
    setOverlayUser(null);
  }, []);

  const renderUserItem = useCallback(
    (user: FollowedUser) => {
      const displayName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        "Anonymous";
      const tierInfo = user.currentTier
        ? getTierByName(user.currentTier)
        : null;
      const tierColor = user.currentTier
        ? TIER_COLORS[user.currentTier] || TIER_COLORS.Explorer
        : TIER_COLORS.Explorer;

      return (
        <Pressable style={styles.row} onPress={() => handleRowPress(user)}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>
              {displayName}
            </Text>
            {tierInfo && (
              <Text style={[styles.rowTier, { color: tierColor }]}>
                {tierInfo.emoji} {tierInfo.name}
              </Text>
            )}
            <View style={styles.rowStats}>
              <Text style={styles.rowStatText}>
                {(user.totalXp ?? 0).toLocaleString()} XP
              </Text>
              <Text style={styles.rowStatDot}>{" \u00B7 "}</Text>
              <Text style={styles.rowStatText}>
                {user.discoveryCount ?? 0}{" "}
                {user.discoveryCount === 1 ? "discovery" : "discoveries"}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.unfollowButton}
            onPress={() => handleUnfollow(user.id)}
            hitSlop={8}
          >
            <Text style={styles.unfollowText}>Unfollow</Text>
          </Pressable>
        </Pressable>
      );
    },
    [handleRowPress, handleUnfollow],
  );

  return (
    <>
      <Screen
        isScrollable={false}
        bannerTitle="Following"
        bannerEmoji="👥"
        showBackButton
        onBack={handleBack}
        noAnimation
      >
        <InfiniteScrollFlatList
          data={users}
          renderItem={renderUserItem}
          fetchMoreData={loadMore}
          onRefresh={refresh}
          isLoading={isLoading}
          isRefreshing={isLoading && users.length === 0}
          hasMore={hasMore && !error}
          error={error}
          emptyEmoji="👥"
          emptyTitle="You're not following anyone yet"
          emptySubtitle="Follow discoverers from event details"
          onRetry={refresh}
        />
      </Screen>

      <DiscovererCardOverlay
        visible={!!overlayUser}
        onDismiss={handleDismissOverlay}
        userId={overlayUser?.id}
        firstName={overlayUser?.firstName}
        lastName={overlayUser?.lastName}
        currentTier={overlayUser?.currentTier}
        totalXp={overlayUser?.totalXp}
        discoveryCount={overlayUser?.discoveryCount}
      />
    </>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  rowInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowName: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  rowTier: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
  },
  rowStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowStatText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
  rowStatDot: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
  },
  unfollowButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.bg.elevated,
  },
  unfollowText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
});

export default FollowingScreen;
