import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useFetchMyFriends } from "@/hooks/useFetchMyFriends";
import { useProfile } from "@/hooks/useProfile";
import { LucideIcon, User, UserPlus } from "lucide-react-native";
import React, { useMemo, useState, useCallback } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen, { Section as ScreenSection } from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import FriendsSection from "./FriendsSection";
import ProfileSection from "./ProfileSection";
import * as Haptics from "expo-haptics";

type TabType = "profile" | "groups" | "friends";

interface UserProfileProps {
  onBack?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { currentStyle, isPitched, togglePitch } = useMapStyle();
  const {
    loading,
    profileData,
    memberSince,
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

  const handleNavigateToFriends = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/friends");
  }, [router]);

  const tabs = [
    {
      icon: User,
      label: "Profile",
      value: "profile" as TabType,
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
          user: user ? { email: user.email } : undefined,
          memberSince: memberSince as string,
          profileData: profileData ? { bio: profileData.bio } : undefined,
          mapSettings,
          onMapSettingChange:
            (key: keyof typeof mapSettings) => (value: boolean) =>
              handleMapSettingChange(key)(value),
        });
      case "friends":
        return [
          {
            title: "Friends",
            icon: UserPlus as LucideIcon,
            content: FriendsSection({
              friends,
              isLoading: isLoadingFriends,
            }),
          },
        ];
      default:
        return [];
    }
  }, [
    activeTab,
    user,
    memberSince,
    profileData,
    mapSettings,
    friends,
    isLoadingFriends,
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
      case "friends":
        return [
          {
            label: "View All Friends",
            onPress: handleNavigateToFriends,
            variant: "primary" as const,
          },
          {
            label: "Add Friends",
            onPress: handleNavigateToFriends,
            variant: "outline" as const,
          },
        ];
      default:
        return [];
    }
  }, [activeTab, handleLogout, setShowDeleteDialog, handleNavigateToFriends]);

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
        isScrollable
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
