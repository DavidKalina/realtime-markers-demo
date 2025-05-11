import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import { apiClient, ClientGroupMembership } from "@/services/ApiClient";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { User, Users, UserPlus, UserMinus, Shield } from "lucide-react-native";
import * as Haptics from "expo-haptics";

// Define the types to match the API client
type GroupMembershipStatus = "PENDING" | "APPROVED" | "REJECTED" | "BANNED";
type GroupMemberRole = "MEMBER" | "ADMIN";
type MemberStatusFilter = "active" | "pending" | "all";

interface GroupMembershipProps {
  groupId: string;
  isOwner: boolean;
  isAdmin: boolean;
  onMembershipChange?: () => void;
}

export default function GroupMembership({
  groupId,
  isOwner,
  isAdmin,
  onMembershipChange,
}: GroupMembershipProps) {
  const [members, setMembers] = useState<ClientGroupMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<MemberStatusFilter>("active");

  const fetchMembers = useCallback(
    async (refresh = false) => {
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
          limit: 20,
          cursor: refresh ? undefined : cursorRef.current,
        });

        if (refresh) {
          setMembers(result.members);
        } else {
          setMembers((prev) => [...prev, ...result.members]);
        }
        setHasMore(!!result.nextCursor);
        cursorRef.current = result.nextCursor;
        setError(null);
      } catch (err) {
        setError("Failed to load group members");
        console.error("Error fetching members:", err);
      } finally {
        setLoading(false);
      }
    },
    [groupId, selectedStatus]
  );

  useEffect(() => {
    cursorRef.current = undefined;
    fetchMembers(true);
  }, [selectedStatus]);

  const handleJoinGroup = useCallback(async () => {
    try {
      setIsJoining(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await apiClient.joinGroup(groupId);

      if (result.membershipStatus === "APPROVED") {
        // If immediately approved, refresh the members list
        fetchMembers(true);
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

  const handleLeaveGroup = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiClient.leaveGroup(groupId);
      if (onMembershipChange) {
        onMembershipChange();
      }
    } catch (err) {
      setError("Failed to leave group");
      console.error("Error leaving group:", err);
    }
  }, [groupId, onMembershipChange]);

  const handleManageMember = useCallback(
    async (memberId: string, newStatus: "APPROVED" | "REJECTED" | "BANNED") => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await apiClient.manageMembershipStatus(groupId, memberId, {
          status: newStatus,
          role: "MEMBER",
        });
        fetchMembers(true);
      } catch (err) {
        setError("Failed to update member status");
        console.error("Error managing member:", err);
      }
    },
    [groupId, fetchMembers]
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
        { cancelable: true }
      );
    },
    [handleManageMember]
  );

  const renderMember = useCallback(
    ({ item: member }: { item: ClientGroupMembership }) => (
      <View style={styles.memberRow}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.user.displayName}</Text>
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

        {(isOwner || isAdmin) && member.userId !== apiClient.getCurrentUser()?.id && (
          <View style={styles.memberActions}>
            {member.status === "PENDING" && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleManageMember(member.userId, "APPROVED")}
                >
                  <UserPlus size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleManageMember(member.userId, "REJECTED")}
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
    ),
    [isOwner, isAdmin, handleManageMember, handleRemoveMember]
  );

  const renderStatusFilter = useCallback(
    () => (
      <View style={styles.statusFilter}>
        <TouchableOpacity
          style={[styles.filterButton, selectedStatus === "active" && styles.filterButtonActive]}
          onPress={() => setSelectedStatus("active")}
        >
          <Text
            style={[
              styles.filterButtonText,
              selectedStatus === "active" && styles.filterButtonTextActive,
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>
        {(isOwner || isAdmin) && (
          <TouchableOpacity
            style={[styles.filterButton, selectedStatus === "pending" && styles.filterButtonActive]}
            onPress={() => setSelectedStatus("pending")}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedStatus === "pending" && styles.filterButtonTextActive,
              ]}
            >
              Pending
            </Text>
          </TouchableOpacity>
        )}
        {(isOwner || isAdmin) && (
          <TouchableOpacity
            style={[styles.filterButton, selectedStatus === "all" && styles.filterButtonActive]}
            onPress={() => setSelectedStatus("all")}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedStatus === "all" && styles.filterButtonTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
        )}
      </View>
    ),
    [isOwner, isAdmin, selectedStatus]
  );

  if (loading && (!members || members.length === 0)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {renderStatusFilter()}

      <FlatList
        data={members}
        renderItem={renderMember}
        keyExtractor={(item) => item.id}
        onEndReached={() => hasMore && !loading && fetchMembers()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() =>
          loading && members.length > 0 ? (
            <ActivityIndicator style={styles.loadingMore} color={COLORS.accent} />
          ) : null
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Users size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateText}>No members found</Text>
          </View>
        )}
      />

      {!isOwner && !isAdmin && (
        <TouchableOpacity style={styles.joinButton} onPress={handleJoinGroup} disabled={isJoining}>
          {isJoining ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.joinButtonText}>Join Group</Text>
          )}
        </TouchableOpacity>
      )}

      {(isOwner || isAdmin) && (
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
          <Text style={styles.leaveButtonText}>Leave Group</Text>
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
  statusFilter: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  filterButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  filterButtonTextActive: {
    color: COLORS.textPrimary,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
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
  leaveButton: {
    margin: 16,
    padding: 16,
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    borderRadius: 12,
    alignItems: "center",
  },
  leaveButtonText: {
    color: COLORS.errorText,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  loadingMore: {
    padding: 16,
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
});
