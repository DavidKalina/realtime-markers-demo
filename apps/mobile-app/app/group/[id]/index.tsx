import React, { useCallback } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";
import ScreenLayout, { COLORS } from "@/components/Layout/ScreenLayout";
import {
  useGroupDetails,
  useGroupActions,
  useGroupScroll,
} from "@/hooks/useGroupDetails";
import { GroupHeader } from "@/components/Group/GroupHeader";
import { GroupInfoSection } from "@/components/Group/GroupInfoSection";
import { GroupCategoriesSection } from "@/components/Group/GroupCategoriesSection";
import { GroupMembersSection } from "@/components/Group/GroupMembersSection";
import { GroupEventsSection } from "@/components/Group/GroupEventsSection";
import { GroupActionButton } from "@/components/Group/GroupActionButton";

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { group, loading, error, isAdmin, refreshGroup } = useGroupDetails(id);
  const { isLeaving, isDeleting, handleLeaveGroup, handleDeleteGroup } =
    useGroupActions(group);
  const { scrollY, handleScroll } = useGroupScroll();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const renderContent = useCallback(() => {
    if (!group) return null;

    return (
      <Animated.View
        style={styles.detailsSection}
        entering={FadeInDown.duration(600).delay(200)}
        layout={LinearTransition.springify()}
      >
        <GroupInfoSection
          memberCount={group.memberCount}
          visibility={group.visibility}
          address={group.address}
        />
        <GroupCategoriesSection categories={group.categories} />
        <GroupMembersSection
          groupId={id}
          isOwner={isAdmin}
          onMembershipChange={refreshGroup}
          onViewAllPress={() => router.push(`/group/${id}/members`)}
        />
        <GroupEventsSection
          onViewAllPress={() => router.push(`/group/${id}/events`)}
        />
      </Animated.View>
    );
  }, [group, id, isAdmin, refreshGroup, router]);

  if (loading) {
    return (
      <ScreenLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading Group Details...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (error || !group) {
    return (
      <ScreenLayout>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || "Group not found"}</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        bounces={true}
      >
        <GroupHeader
          emoji={group.emoji || ""}
          name={group.name}
          description={group.description}
          onBack={handleBack}
          scrollY={scrollY}
        />
        {renderContent()}
        <GroupActionButton
          isAdmin={isAdmin}
          onLeave={handleLeaveGroup}
          onDelete={handleDeleteGroup}
          isLeaving={isLeaving}
          isDeleting={isDeleting}
        />
      </Animated.ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 16,
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  detailsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
});
