import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useProfile } from "@/hooks/useProfile";
import { useFetchMyFriends } from "@/hooks/useFetchMyFriends";
import { useUserGroups } from "@/hooks/useUserGroups";
import React, { useState, useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { User, Users, UserPlus, LucideIcon } from "lucide-react-native";
import Screen, { Section as ScreenSection } from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import ProfileSection from "./ProfileSection";
import GroupsSection from "./GroupsSection";
import FriendsSection from "./FriendsSection";

type TabType = "profile" | "groups" | "friends";

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
    retry: retryGroups,
  } = useUserGroups();

  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [mapSettings, setMapSettings] = useState({
    isPitched: isPitched,
    useLightStyle: currentStyle === "light",
    useDarkStyle: currentStyle === "dark",
    useStreetStyle: currentStyle === "street",
  });

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
  const sections = useMemo<ScreenSection[]>(() => {
    switch (activeTab) {
      case "profile":
        return ProfileSection({
          planDetails: planDetails
            ? {
                planType: planDetails.planType,
                remainingScans: planDetails.remainingScans,
              }
            : undefined,
          progressWidth,
          user: user ? { email: user.email } : undefined,
          memberSince: memberSince as string,
          profileData: profileData ? { bio: profileData.bio } : undefined,
          mapSettings,
          onMapSettingChange:
            (key: keyof typeof mapSettings) => (value: boolean) =>
              handleMapSettingChange(key)(value),
          onUpgradePress: () => console.log("Upgrade pressed"),
        });
      case "groups":
        return [
          {
            title: "My Groups",
            icon: Users as LucideIcon,
            content: GroupsSection({
              groups,
              isLoading: isLoadingGroups,
              error: groupsError || undefined,
              onRetry: retryGroups,
            }),
            actionButton: {
              label: "Create Group",
              onPress: () => console.log("Create group"),
              variant: "primary" as const,
            },
          },
        ];
      case "friends":
        return [
          {
            title: "Friends",
            icon: UserPlus as LucideIcon,
            content: FriendsSection({
              friends,
              isLoading: isLoadingFriends,
            }),
            actionButton: {
              label: "Add Friends",
              onPress: () => console.log("Add friends"),
              variant: "primary" as const,
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
});

export default UserProfile;
