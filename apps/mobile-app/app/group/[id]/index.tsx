import GroupMembership from "@/components/GroupMembership/GroupMembership";
import ScreenLayout, { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Calendar, Globe, MapPin, Tag, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolate,
  FadeInDown,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add refs to track mounted state
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Animation setup
  const scrollY = useSharedValue(0);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  }, []);

  // Animation styles
  const zoneBannerAnimatedStyle = useAnimatedStyle(() => {
    const bannerPaddingVertical = interpolate(scrollY.value, [0, 100], [24, 12], Extrapolate.CLAMP);
    return {
      paddingBottom: bannerPaddingVertical,
    };
  });

  const animatedBannerEmojiStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, 100], [48, 32], Extrapolate.CLAMP),
    marginBottom: interpolate(scrollY.value, [0, 100], [12, 6], Extrapolate.CLAMP),
  }));

  const animatedBannerNameStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, 100], [28, 22], Extrapolate.CLAMP),
    marginBottom: interpolate(scrollY.value, [0, 100], [8, 4], Extrapolate.CLAMP),
  }));

  const animatedBannerDescriptionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [0, 50], [1, 0.95], Extrapolate.CLAMP) }],
  }));

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const loadGroupDetails = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const groupData = await apiClient.getGroupById(id);
      if (isMounted.current) {
        setGroup(groupData);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError("Failed to load group details");
        console.error("Error fetching group:", err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [id]);

  // Add effect to fetch group details on mount
  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  const renderHeader = useCallback(() => {
    if (!group) return null;

    return (
      <>
        {/* Group Banner */}
        <Animated.View
          style={[styles.zoneBanner, zoneBannerAnimatedStyle]}
          layout={LinearTransition.springify()}
        >
          <TouchableOpacity onPress={handleBack} style={styles.bannerBackButton}>
            <ArrowLeft size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Animated.Text style={[styles.zoneBannerEmoji, animatedBannerEmojiStyle]}>
            {group.emoji || "👥"}
          </Animated.Text>
          <Animated.Text style={[styles.zoneBannerName, animatedBannerNameStyle]}>
            {group.name}
          </Animated.Text>
          <Animated.Text style={[styles.zoneBannerDescription, animatedBannerDescriptionStyle]}>
            {group.description || "Join this group to connect with like-minded people"}
          </Animated.Text>
        </Animated.View>

        {/* Group Details Section */}
        <Animated.View
          style={styles.detailsSection}
          entering={FadeInDown.duration(600).delay(200)}
          layout={LinearTransition.springify()}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <Globe size={20} color={COLORS.accent} />
              </View>
              <Text style={styles.sectionTitle}>Group Info</Text>
            </View>
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Users size={18} color={COLORS.accent} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Members</Text>
                  <Text style={styles.detailValue}>{group.memberCount}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Globe size={18} color={COLORS.accent} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Visibility</Text>
                  <Text style={styles.detailValue}>{group.visibility}</Text>
                </View>
              </View>
              {group.address && (
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.detailIconContainer}>
                    <MapPin size={18} color={COLORS.accent} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailValue}>{group.address}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {group.categories && group.categories.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Tag size={20} color={COLORS.accent} />
                </View>
                <Text style={styles.sectionTitle}>Categories</Text>
              </View>
              <View style={styles.categoriesContainer}>
                {group.categories.map((category) => (
                  <View key={category.id} style={styles.categoryTag}>
                    <Text style={styles.categoryText}>{category.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Add Group Members Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <Users size={20} color={COLORS.accent} />
              </View>
              <Text style={styles.sectionTitle}>Members</Text>
              <TouchableOpacity
                style={styles.sectionActionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/group/${id}/members`);
                }}
              >
                <Text style={styles.sectionActionText}>View All</Text>
              </TouchableOpacity>
            </View>
            <GroupMembership
              groupId={id}
              isOwner={group.ownerId === apiClient.getCurrentUser()?.id}
              isAdmin={false}
              onMembershipChange={() => {
                loadGroupDetails();
              }}
            />
          </View>

          {/* Add Group Events Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <Calendar size={20} color={COLORS.accent} />
              </View>
              <Text style={styles.sectionTitle}>Events</Text>
              <TouchableOpacity
                style={styles.sectionActionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/group/${id}/events`);
                }}
              >
                <Text style={styles.sectionActionText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.eventsPreview}>
              <Text style={styles.eventsPreviewText}>
                View and manage group events, including meetups, workshops, and social gatherings.
              </Text>
            </View>
          </View>
        </Animated.View>
      </>
    );
  }, [
    group,
    handleBack,
    zoneBannerAnimatedStyle,
    animatedBannerEmojiStyle,
    animatedBannerNameStyle,
    animatedBannerDescriptionStyle,
    router,
  ]);

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
        <TouchableOpacity onPress={handleBack} style={styles.bannerBackButton}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
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
        {renderHeader()}
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
  // Banner Styles
  zoneBanner: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  bannerBackButton: {
    position: "absolute",
    top: 48,
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
  },
  zoneBannerEmoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "SpaceMono",
  },
  zoneBannerName: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  zoneBannerDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0.3,
    paddingHorizontal: 10,
  },
  // Details Section Styles
  detailsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  detailsContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    letterSpacing: 0.2,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoriesContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryTag: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  categoryText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    letterSpacing: 0.2,
  },
  sectionActionButton: {
    marginLeft: "auto",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sectionActionText: {
    color: COLORS.accent,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  eventsPreview: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 16,
    padding: 16,
  },
  eventsPreviewText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    lineHeight: 20,
  },
});
