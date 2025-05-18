import { COLORS } from "@/components/Layout/ScreenLayout";
import Tabs from "@/components/Layout/Tabs";
import { apiClient, ClientGroupMembership } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  CheckCircle,
  ChevronRight,
  Clock,
  ListFilter,
  Shield,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Define the types to match the API client
type GroupMembershipStatus = "PENDING" | "APPROVED" | "REJECTED" | "BANNED";
type MemberStatusFilter = "active" | "pending" | "all";

interface GroupMembershipProps {
  groupId: string;
  isOwner: boolean;
  isAdmin: boolean;
  onMembershipChange?: () => void;
}

const createTabItems = (isAdminOrOwner: boolean) => [
  {
    icon: CheckCircle,
    label: "Active",
    value: "active" as const,
  },
  ...(isAdminOrOwner
    ? [
        {
          icon: Clock,
          label: "Pending",
          value: "pending" as const,
        },
        {
          icon: ListFilter,
          label: "All",
          value: "all" as const,
        },
      ]
    : []),
];

export default function GroupMembership({
  groupId,
  isOwner,
  isAdmin,
  onMembershipChange,
}: GroupMembershipProps) {
  const router = useRouter();
  const [members, setMembers] = useState<ClientGroupMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<MemberStatusFilter>("active");

  const tabItems = React.useMemo(
    () => createTabItems(isOwner || isAdmin),
    [isOwner, isAdmin],
  );

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      // Map frontend filter values to backend enum values
      let status: GroupMembershipStatus | undefined;
      switch (selectedStatus) {
        case "active":
          status = "APPROVED";
          break;
        case "pending":
          status = "PENDING";
          break;
        case "all":
          status = undefined;
          break;
      }

      const result = await apiClient.getGroupMembers(groupId, {
        status,
        limit: 10, // Limit to 10 members
      });

      setMembers(result.members);
      setError(null);
    } catch (err) {
      setError("Failed to load group members");
      console.error("Error fetching members:", err);
    } finally {
      setLoading(false);
    }
  }, [groupId, selectedStatus]);

  useEffect(() => {
    fetchMembers();
  }, [selectedStatus]);

  const handleJoinGroup = useCallback(async () => {
    try {
      setIsJoining(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await apiClient.joinGroup(groupId);

      if (result.membershipStatus === "APPROVED") {
        // If immediately approved, refresh the members list
        fetchMembers();
      }

      if (onMembershipChange) {
        onMembershipChange();
      }
    } catch (err) {
      setError("Failed to join group");
      console.error("Error joining group:", err);
    } finally {
      setIsJoining(false);
    }
  }, [groupId, fetchMembers, onMembershipChange]);

  const handleManageMember = useCallback(
    async (memberId: string, newStatus: "APPROVED" | "REJECTED" | "BANNED") => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await apiClient.manageMembershipStatus(groupId, memberId, {
          status: newStatus,
          role: "MEMBER",
        });
        fetchMembers();
      } catch (err) {
        setError("Failed to update member status");
        console.error("Error managing member:", err);
      }
    },
    [groupId, fetchMembers],
  );

  const handleRemoveMember = useCallback(
    (member: ClientGroupMembership) => {
      Alert.alert(
        "Remove Member",
        `Are you sure you want to remove ${member.user.displayName} from the group?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => handleManageMember(member.userId, "BANNED"),
          },
        ],
        { cancelable: true },
      );
    },
    [handleManageMember],
  );

  const handleViewAllMembers = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/group/${groupId}/members`);
  }, [groupId, router]);

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Tabs
        items={tabItems}
        activeTab={selectedStatus}
        onTabPress={setSelectedStatus}
        style={styles.tabsContainer}
      />
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : (
          <View>
            {members.length === 0 ? (
              <View style={styles.emptyState}>
                <Users size={40} color={COLORS.textSecondary} />
                <Text style={styles.emptyStateText}>No members found</Text>
              </View>
            ) : (
              members.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.user.displayName}
                    </Text>
                    <View style={styles.memberRoleContainer}>
                      {member.role === "ADMIN" && (
                        <View style={styles.adminBadge}>
                          <Shield size={12} color={COLORS.accent} />
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                      <Text style={styles.memberRole}>
                        {member.status === "PENDING" ? "Pending" : "Member"}
                      </Text>
                    </View>
                  </View>

                  {(isOwner || isAdmin) &&
                    member.userId !== apiClient.getCurrentUser()?.id && (
                      <View style={styles.memberActions}>
                        {member.status === "PENDING" && (
                          <>
                            <TouchableOpacity
                              style={[
                                styles.actionButton,
                                styles.approveButton,
                              ]}
                              onPress={() =>
                                handleManageMember(member.userId, "APPROVED")
                              }
                            >
                              <UserPlus size={16} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.rejectButton]}
                              onPress={() =>
                                handleManageMember(member.userId, "REJECTED")
                              }
                            >
                              <UserMinus size={16} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                          </>
                        )}
                        {member.status === "APPROVED" && (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.removeButton]}
                            onPress={() => handleRemoveMember(member)}
                          >
                            <UserMinus size={16} color={COLORS.errorText} />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                </View>
              ))
            )}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={handleViewAllMembers}
      >
        <Text style={styles.viewAllButtonText}>View All Members</Text>
        <ChevronRight size={16} color={COLORS.accent} />
      </TouchableOpacity>

      {!isOwner && !isAdmin && (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={handleJoinGroup}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.joinButtonText}>Join Group</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabsContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  listContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    overflow: "hidden",
    maxHeight: 500, // Add a max height to ensure it doesn't grow too large
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  memberRoleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 255, 0, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  adminBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  memberRole: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  memberActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
  },
  approveButton: {
    backgroundColor: "rgba(0, 255, 0, 0.1)",
  },
  rejectButton: {
    backgroundColor: "rgba(255, 0, 0, 0.1)",
  },
  removeButton: {
    backgroundColor: "rgba(255, 0, 0, 0.1)",
  },
  joinButton: {
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: "center",
  },
  joinButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    marginTop: 8,
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 14,
    fontFamily: "SpaceMono",
    textAlign: "center",
    padding: 16,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    gap: 8,
  },
  viewAllButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});
