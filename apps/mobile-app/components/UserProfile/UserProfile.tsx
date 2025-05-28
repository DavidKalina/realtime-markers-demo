import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useProfile } from "@/hooks/useProfile";
import { useFetchMyFriends } from "@/hooks/useFetchMyFriends";
import { useUserGroups } from "@/hooks/useUserGroups";
import { PlanType } from "@/services/ApiClient";
import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  User,
  Settings,
  Map,
  MapPin,
  Mail,
  Calendar,
  Edit,
  Crown,
  Zap,
  Users,
  UserPlus,
} from "lucide-react-native";
import Screen from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import List, { StyledSwitch } from "../Layout/List";
import Badge from "../Layout/Badge";
import { useRouter } from "expo-router";

type TabType = "profile" | "groups" | "friends";
type ButtonVariant =
  | "primary"
  | "outline"
  | "warning"
  | "error"
  | "secondary"
  | "ghost";

interface UserProfileProps {
  onBack?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { currentStyle, isPitched, togglePitch } = useMapStyle();
  const {
    loading,
    profileData,
    planDetails,
    memberSince,
    progressWidth,
    deleteError,
    isDeleting,
    showDeleteDialog,
    password,
    handleMapStyleChange,
    handleBack,
    handleLogout,
    handleDeleteAccount,
    handleCloseDeleteDialog,
    setShowDeleteDialog,
    setPassword,
  } = useProfile(onBack);
  const { friends, isLoading: isLoadingFriends } = useFetchMyFriends();
  const {
    groups,
    isLoading: isLoadingGroups,
    error: groupsError,
    hasMore,
    refresh: refreshGroups,
    loadMore: loadMoreGroups,
    retry: retryGroups,
  } = useUserGroups();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [mapSettings, setMapSettings] = useState({
    isPitched: isPitched,
    useLightStyle: currentStyle === "light",
    useDarkStyle: currentStyle === "dark",
    useStreetStyle: currentStyle === "street",
  });

  // Helper function to format last active time
  const formatLastActive = (date: string) => {
    const now = new Date();
    const lastActive = new Date(date);
    const diffInMinutes = Math.floor(
      (now.getTime() - lastActive.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleMapSettingChange =
    (key: keyof typeof mapSettings) => (value: boolean) => {
      setMapSettings((prev) => {
        const newSettings = { ...prev, [key]: value };

        // Handle map style changes
        if (key === "useLightStyle" && value) {
          handleMapStyleChange("light");
        } else if (key === "useDarkStyle" && value) {
          handleMapStyleChange("dark");
        } else if (key === "useStreetStyle" && value) {
          handleMapStyleChange("street");
        }

        // Handle pitch changes
        if (key === "isPitched") {
          togglePitch();
        }

        return newSettings;
      });
    };

  const tabs = [
    {
      icon: User,
      label: "Profile",
      value: "profile" as TabType,
    },
    {
      icon: Users,
      label: "Groups",
      value: "groups" as TabType,
    },
    {
      icon: UserPlus,
      label: "Friends",
      value: "friends" as TabType,
    },
  ];

  // Memoize sections based on active tab
  const sections = useMemo(() => {
    switch (activeTab) {
      case "profile":
        return [
          {
            title: "Plan Details",
            icon: User,
            content: (
              <View style={styles.planSection}>
                <View style={styles.planHeader}>
                  <Badge
                    label={
                      planDetails?.planType === PlanType.FREE
                        ? "Free Plan"
                        : "Pro Plan"
                    }
                    variant={
                      planDetails?.planType === PlanType.FREE
                        ? "default"
                        : "pro"
                    }
                    icon={
                      planDetails?.planType === PlanType.PRO ? (
                        <Crown size={16} color="#fbbf24" />
                      ) : (
                        <Zap size={16} color={COLORS.textSecondary} />
                      )
                    }
                    style={styles.planBadge}
                  />
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressWidth}%` },
                    ]}
                  />
                </View>
                <Text style={styles.planDescription}>
                  {planDetails?.remainingScans} scans remaining this week
                </Text>
              </View>
            ),
            actionButton: {
              label: "Upgrade",
              onPress: () => {}, // Add upgrade handler
              variant: "primary" as ButtonVariant,
            },
          },
          {
            title: "Account Settings",
            icon: Settings,
            content: (
              <List
                items={[
                  {
                    id: "email",
                    icon: Mail,
                    title: "Email",
                    description: user?.email || "No email set",
                    rightElement: (
                      <TouchableOpacity
                        onPress={() => console.log("Edit email")}
                      >
                        <Edit size={16} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    ),
                  },
                  {
                    id: "memberSince",
                    icon: Calendar,
                    title: "Member Since",
                    description: memberSince,
                  },
                  {
                    id: "bio",
                    icon: User,
                    title: "Bio",
                    description: profileData?.bio || "No bio set",
                    rightElement: (
                      <TouchableOpacity onPress={() => console.log("Edit bio")}>
                        <Edit size={16} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    ),
                  },
                ]}
                scrollable={false}
                onItemPress={(item) =>
                  console.log("Account item pressed:", item)
                }
              />
            ),
          },
          {
            title: "Map Settings",
            icon: Map,
            content: (
              <List
                items={[
                  {
                    id: "mapStyle",
                    icon: Map,
                    title: "Map Style",
                    description: "Choose your preferred map style",
                    rightElement: (
                      <View style={styles.mapStyleButtons}>
                        <TouchableOpacity
                          style={[
                            styles.mapStyleButton,
                            mapSettings.useLightStyle &&
                              styles.mapStyleButtonActive,
                          ]}
                          onPress={() =>
                            handleMapSettingChange("useLightStyle")(true)
                          }
                        >
                          <Text
                            style={[
                              styles.mapStyleButtonText,
                              mapSettings.useLightStyle &&
                                styles.mapStyleButtonTextActive,
                            ]}
                          >
                            Light
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.mapStyleButton,
                            mapSettings.useDarkStyle &&
                              styles.mapStyleButtonActive,
                          ]}
                          onPress={() =>
                            handleMapSettingChange("useDarkStyle")(true)
                          }
                        >
                          <Text
                            style={[
                              styles.mapStyleButtonText,
                              mapSettings.useDarkStyle &&
                                styles.mapStyleButtonTextActive,
                            ]}
                          >
                            Dark
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.mapStyleButton,
                            mapSettings.useStreetStyle &&
                              styles.mapStyleButtonActive,
                          ]}
                          onPress={() =>
                            handleMapSettingChange("useStreetStyle")(true)
                          }
                        >
                          <Text
                            style={[
                              styles.mapStyleButtonText,
                              mapSettings.useStreetStyle &&
                                styles.mapStyleButtonTextActive,
                            ]}
                          >
                            Colorful
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ),
                  },
                  {
                    id: "mapPitch",
                    icon: MapPin,
                    title: "Map Pitch",
                    description: "Enable 3D building view",
                    rightElement: (
                      <StyledSwitch
                        value={mapSettings.isPitched}
                        onValueChange={handleMapSettingChange("isPitched")}
                      />
                    ),
                    isActive: mapSettings.isPitched,
                  },
                ]}
                scrollable={false}
                onItemPress={(item) =>
                  console.log("Map setting pressed:", item)
                }
              />
            ),
          },
        ];
      case "groups":
        return [
          {
            title: "My Groups",
            icon: Users,
            content: (
              <List
                items={groups.slice(0, 10).map((group) => ({
                  id: group.id,
                  icon: Users,
                  title: group.name,
                  description: `${group.memberCount} members${
                    group.updatedAt
                      ? ` • Updated ${formatLastActive(group.updatedAt)}`
                      : ""
                  }`,
                  badge: group.visibility === "PUBLIC" ? "Public" : "Private",
                }))}
                scrollable={false}
                onItemPress={(item) => console.log("Group pressed:", item)}
                emptyState={{
                  icon: Users,
                  title: "No Groups Yet",
                  description: "Join or create a group to get started",
                }}
              />
            ),
            actionButton: {
              label: "Create Group",
              onPress: () => router.push("/create-group"),
              variant: "primary" as ButtonVariant,
            },
          },
        ];
      case "friends":
        return [
          {
            title: "Friends",
            icon: UserPlus,
            content: isLoadingFriends ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : (
              <List
                items={friends.slice(0, 5).map((friend) => ({
                  id: friend.id,
                  icon: User,
                  title: friend.displayName || friend.email || "Unknown User",
                  description: friend.lastSeen
                    ? `Last seen ${formatLastActive(friend.lastSeen)}`
                    : "Never seen",
                  badge: friend.isOnline ? "Online" : undefined,
                }))}
                scrollable={false}
                onItemPress={(item) => console.log("Friend pressed:", item)}
                onViewAllPress={() => console.log("View all friends")}
                emptyState={{
                  icon: UserPlus,
                  title: "No Friends Yet",
                  description: "Add friends to see them here",
                }}
              />
            ),
            actionButton: {
              label: "Add Friends",
              onPress: () => console.log("Add new friends"),
              variant: "primary" as ButtonVariant,
            },
          },
        ];
      default:
        return [];
    }
  }, [
    activeTab,
    planDetails,
    progressWidth,
    user,
    memberSince,
    profileData,
    mapSettings,
    friends,
    isLoadingFriends,
    groups,
    isLoadingGroups,
    groupsError,
    hasMore,
    loadMoreGroups,
    refreshGroups,
    retryGroups,
  ]);

  // Memoize footer buttons based on active tab
  const footerButtons = useMemo(() => {
    switch (activeTab) {
      case "profile":
        return [
          {
            label: "Log Out",
            onPress: handleLogout,
            variant: "outline" as const,
          },
          {
            label: "Delete Account",
            onPress: () => setShowDeleteDialog(true),
            variant: "error" as const,
          },
        ];
      case "groups":
        return [
          {
            label: "Join Group",
            onPress: () => console.log("Join group"),
            variant: "primary" as const,
          },
          {
            label: "Discover",
            onPress: () => console.log("Discover groups"),
            variant: "outline" as const,
          },
        ];
      case "friends":
        return [
          {
            label: "Find Friends",
            onPress: () => console.log("Find friends"),
            variant: "primary" as const,
          },
          {
            label: "Invite",
            onPress: () => console.log("Invite friends"),
            variant: "outline" as const,
          },
        ];
      default:
        return [];
    }
  }, [activeTab, handleLogout, setShowDeleteDialog]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loadingText}>Loading Profile...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Screen<TabType>
        bannerTitle={user?.displayName || user?.email || ""}
        bannerDescription={
          activeTab === "profile"
            ? profileData?.bio || "View and manage your profile settings"
            : activeTab === "groups"
              ? "Manage your groups and communities"
              : "Connect with friends and share experiences"
        }
        bannerEmoji={
          activeTab === "profile" ? "👤" : activeTab === "groups" ? "👥" : "👋"
        }
        showBackButton={true}
        onBack={handleBack}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sections={sections}
        footerButtons={footerButtons}
        isScrollable={activeTab !== "groups"}
      />

      <DeleteAccountModalComponent
        visible={showDeleteDialog}
        password={password}
        setPassword={setPassword}
        deleteError={deleteError}
        isDeleting={isDeleting}
        onClose={handleCloseDeleteDialog}
        onDelete={handleDeleteAccount}
      />
    </>
  );
};

const styles = StyleSheet.create({
  // Map style buttons
  mapStyleButtons: {
    flexDirection: "row",
    gap: 4,
  },
  mapStyleButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    minHeight: 28,
  },
  mapStyleButtonActive: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  mapStyleButtonText: {
    fontSize: 11,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  mapStyleButtonTextActive: {
    color: COLORS.accent,
  },

  // Plan section
  planSection: {
    padding: 4,
  },
  planHeader: {
    marginBottom: 12,
    alignItems: "flex-start",
  },
  planBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  planDescription: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    color: COLORS.textSecondary,
  },

  // Loading state
  loadingContainer: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
  },

  errorContainer: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 12,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 8,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },

  groupsList: {
    flex: 1,
    minHeight: 200,
  },
  groupsListContent: {
    paddingBottom: 16,
  },
});

export default UserProfile;
