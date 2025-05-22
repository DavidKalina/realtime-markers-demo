import GroupMembership from "@/components/GroupMembership/GroupMembership";
import ScreenLayout, { COLORS } from "@/components/Layout/ScreenLayout";
import GroupBanner from "@/components/Layout/GroupBanner";
import SectionHeader from "@/components/Layout/SectionHeader";
import ActionButton from "@/components/Buttons/ActionButton";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Globe,
  MapPin,
  Tag,
  Users,
  LogOut,
  Trash2,
} from "lucide-react-native";
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
  FadeInDown,
  LinearTransition,
  useSharedValue,
} from "react-native-reanimated";

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [],
  );

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
      const groupData = await apiClient.groups.getGroupById(id);
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

  const isAdmin = group?.ownerId === apiClient.auth.getCurrentUser()?.id;

  const handleLeaveGroup = useCallback(async () => {
    if (!group || isLeaving) return;

    try {
      setIsLeaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiClient.groups.leaveGroup(group.id);
      router.back();
    } catch (err) {
      console.error("Error leaving group:", err);
      // You might want to show an error message to the user here
    } finally {
      setIsLeaving(false);
    }
  }, [group, isLeaving, router]);

  const handleDeleteGroup = useCallback(async () => {
    if (!group || isDeleting) return;

    try {
      setIsDeleting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiClient.groups.deleteGroup(group.id);
      router.back();
    } catch (err) {
      console.error("Error deleting group:", err);
      // You might want to show an error message to the user here
    } finally {
      setIsDeleting(false);
    }
  }, [group, isDeleting, router]);

  const renderHeader = useCallback(() => {
    if (!group) return null;

    return (
      <>
        <GroupBanner
          emoji={group.emoji}
          name={group.name}
          description={group.description}
          onBack={handleBack}
          scrollY={scrollY}
        />

        {/* Group Details Section */}
        <Animated.View
          style={styles.detailsSection}
          entering={FadeInDown.duration(600).delay(200)}
          layout={LinearTransition.springify()}
        >
          <View style={styles.section}>
            <SectionHeader icon={Globe} title="Group Info" />
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
              <SectionHeader icon={Tag} title="Categories" />
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
            <SectionHeader
              icon={Users}
              title="Members"
              actionText="View All"
              onActionPress={() => router.push(`/group/${id}/members`)}
            />
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
            <SectionHeader
              icon={Calendar}
              title="Events"
              actionText="View All"
              onActionPress={() => router.push(`/group/${id}/events`)}
            />
            <View style={styles.eventsPreview}>
              <Text style={styles.eventsPreviewText}>
                View and manage group events, including meetups, workshops, and
                social gatherings.
              </Text>
            </View>
          </View>
        </Animated.View>
      </>
    );
  }, [group, handleBack, scrollY, router]);

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
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
        <View style={styles.actionButtonContainer}>
          {isAdmin ? (
            <ActionButton
              variant="danger"
              label="Delete Group"
              icon={Trash2}
              onPress={handleDeleteGroup}
              isLoading={isDeleting}
            />
          ) : (
            <ActionButton
              variant="danger"
              label="Leave Group"
              icon={LogOut}
              onPress={handleLeaveGroup}
              isLoading={isLeaving}
            />
          )}
        </View>
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
  // Details Section Styles
  detailsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  section: {
    marginBottom: 24,
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
  actionButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  backButton: {
    position: "absolute",
    top: 48,
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
  },
});
