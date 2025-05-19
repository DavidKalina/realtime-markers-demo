import ScreenLayout, { COLORS } from "@/components/Layout/ScreenLayout";
import {
  apiClient,
  ClientGroup,
  ClientGroupMembership,
} from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MoreVertical, Search } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<ClientGroupMembership[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<
    ClientGroupMembership[]
  >([]);
  const [selectedMember, setSelectedMember] =
    useState<ClientGroupMembership | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const currentUser = apiClient.getCurrentUser();

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
      const [groupData, membersData] = await Promise.all([
        apiClient.groups.getGroupById(id),
        apiClient.groups.getGroupMembers(id),
      ]);
      if (isMounted.current) {
        setGroup(groupData);
        setMembers(membersData.members);
        setFilteredMembers(membersData.members);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError("Failed to load group members");
        console.error("Error fetching group:", err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  useEffect(() => {
    if (members.length > 0) {
      const filtered = members.filter((member) =>
        member.user.displayName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      );
      setFilteredMembers(filtered);
    }
  }, [searchQuery, members]);

  const isAdmin = useCallback(() => {
    if (!group || !currentUser) return false;
    const currentMembership = members.find((m) => m.userId === currentUser.id);
    return (
      currentMembership?.role === "ADMIN" || group.ownerId === currentUser.id
    );
  }, [group, currentUser, members]);

  const handleMemberAction = async (
    action: string,
    member: ClientGroupMembership,
  ) => {
    if (!id || !group) return;

    try {
      switch (action) {
        case "make_admin":
          await apiClient.groups.updateMemberRole(id, member.userId, {
            role: "ADMIN",
          });
          break;
        case "make_member":
          await apiClient.groups.updateMemberRole(id, member.userId, {
            role: "MEMBER",
          });
          break;
        case "approve":
          await apiClient.groups.manageMembershipStatus(id, member.userId, {
            status: "APPROVED",
          });
          break;
        case "reject":
          await apiClient.groups.manageMembershipStatus(id, member.userId, {
            status: "REJECTED",
          });
          break;
        case "ban":
          await apiClient.groups.manageMembershipStatus(id, member.userId, {
            status: "BANNED",
          });
          break;
        case "remove":
          await apiClient.groups.removeMember(id, member.userId);
          break;
      }

      // Refresh member list
      await loadGroupDetails();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Error managing member:", err);
      Alert.alert("Error", "Failed to update member status");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsMenuVisible(false);
      setSelectedMember(null);
    }
  };

  const showMemberMenu = (member: ClientGroupMembership) => {
    console.log("Show menu called for member:", member.user.displayName);
    console.log("Is admin:", isAdmin());
    if (!isAdmin()) return;
    setSelectedMember(member);
    setIsMenuVisible(true);
    console.log("Menu state updated:", {
      isVisible: true,
      member: member.user.displayName,
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <ArrowLeft size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Group Members</Text>
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Search
        size={20}
        color={COLORS.textSecondary}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.searchInput}
        placeholder="Search members..."
        placeholderTextColor={COLORS.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
    </View>
  );

  const renderMemberActions = () => {
    console.log("Rendering member actions:", {
      isVisible: isMenuVisible,
      selectedMember: selectedMember?.user.displayName,
    });
    if (!selectedMember) return null;

    const isCurrentUser = selectedMember.userId === currentUser?.id;
    const isOwner = group?.ownerId === selectedMember.userId;
    const canManageRole = isAdmin() && !isOwner && !isCurrentUser;
    const canManageStatus = isAdmin() && !isOwner && !isCurrentUser;

    return (
      <View style={styles.modalContainer}>
        <Modal
          visible={isMenuVisible}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={() => {
            console.log("Modal close requested");
            setIsMenuVisible(false);
            setSelectedMember(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View
              style={styles.menuContainer}
              onStartShouldSetResponder={() => true}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {canManageRole && (
                <>
                  {selectedMember.role === "MEMBER" && (
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        console.log("Make admin pressed");
                        handleMemberAction("make_admin", selectedMember);
                      }}
                    >
                      <Text style={styles.menuItemText}>Make Admin</Text>
                    </TouchableOpacity>
                  )}
                  {selectedMember.role === "ADMIN" && (
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        console.log("Make member pressed");
                        handleMemberAction("make_member", selectedMember);
                      }}
                    >
                      <Text style={styles.menuItemText}>Make Member</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {canManageStatus && (
                <>
                  {selectedMember.status === "PENDING" && (
                    <>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                          console.log("Approve pressed");
                          handleMemberAction("approve", selectedMember);
                        }}
                      >
                        <Text style={styles.menuItemText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                          console.log("Reject pressed");
                          handleMemberAction("reject", selectedMember);
                        }}
                      >
                        <Text style={styles.menuItemText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {selectedMember.status !== "BANNED" && (
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        console.log("Ban pressed");
                        handleMemberAction("ban", selectedMember);
                      }}
                    >
                      <Text style={[styles.menuItemText, styles.dangerText]}>
                        Ban
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {canManageRole && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    console.log("Remove pressed");
                    Alert.alert(
                      "Remove Member",
                      "Are you sure you want to remove this member?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () =>
                            handleMemberAction("remove", selectedMember),
                        },
                      ],
                    );
                  }}
                >
                  <Text style={[styles.menuItemText, styles.dangerText]}>
                    Remove Member
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  const renderMemberItem = ({ item }: { item: ClientGroupMembership }) => {
    const isCurrentUser = item.userId === currentUser?.id;
    return (
      <View style={styles.memberItem}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {item.user.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {item.user.displayName}{" "}
            {isCurrentUser && <Text style={styles.youBadge}>(You)</Text>}
          </Text>
          <View style={styles.memberDetails}>
            <Text style={styles.memberRole}>{item.role}</Text>
            {item.status !== "APPROVED" && (
              <Text style={styles.memberStatus}>• {item.status}</Text>
            )}
          </View>
        </View>
        {!isCurrentUser && isAdmin() && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              console.log("Menu button pressed for:", item.user.displayName);
              showMemberMenu(item);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        {isCurrentUser && <View style={styles.youIndicator} />}
      </View>
    );
  };

  if (loading) {
    return (
      <ScreenLayout>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading Members...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (error || !group) {
    return (
      <ScreenLayout>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || "Group not found"}</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {renderHeader()}
      <Animated.View
        style={styles.container}
        entering={FadeInDown.duration(600)}
        layout={LinearTransition.springify()}
      >
        {renderSearchBar()}
        <FlatList
          data={filteredMembers}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.membersList}
          showsVerticalScrollIndicator={false}
        />
        {renderMemberActions()}
      </Animated.View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backButton: {
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginVertical: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontSize: 15,
  },
  membersList: {
    paddingBottom: 32,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 2,
  },
  memberDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberRole: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  memberStatus: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
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
  menuButton: {
    padding: 8,
    marginLeft: 8,
    zIndex: 1,
  },
  modalContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 8,
    width: "80%",
    maxWidth: 300,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    position: "relative",
    zIndex: 10000,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  menuItemText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  dangerText: {
    color: COLORS.errorText,
  },
  youBadge: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  youIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "transparent", // visually subtle, can add icon if desired
  },
});
