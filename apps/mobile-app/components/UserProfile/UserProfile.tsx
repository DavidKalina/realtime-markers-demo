import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useProfile } from "@/hooks/useProfile";
import { PlanType } from "@/services/ApiClient";
import React, { useState } from "react";
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
} from "lucide-react-native";
import Screen, { Section } from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import List, { StyledSwitch } from "../Layout/List";

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

  const sections: Section[] = [
    {
      title: "Plan Details",
      icon: User,
      content: (
        <View style={styles.planSection}>
          <Text style={styles.planTitle}>
            {planDetails?.planType === PlanType.FREE ? "Free Plan" : "Pro Plan"}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressWidth}%` }]}
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
        variant: "primary",
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
                <TouchableOpacity onPress={() => console.log("Edit email")}>
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
          onItemPress={(item) => console.log("Account item pressed:", item)}
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
                      mapSettings.useLightStyle && styles.mapStyleButtonActive,
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
                      mapSettings.useDarkStyle && styles.mapStyleButtonActive,
                    ]}
                    onPress={() => handleMapSettingChange("useDarkStyle")(true)}
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
                      mapSettings.useStreetStyle && styles.mapStyleButtonActive,
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
          onItemPress={(item) => console.log("Map setting pressed:", item)}
        />
      ),
    },
  ];

  const footerButtons = [
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

  return (
    <>
      <Screen
        bannerTitle={user?.displayName || user?.email || ""}
        bannerDescription={
          profileData?.bio || "View and manage your profile settings"
        }
        bannerEmoji="👤"
        showBackButton={true}
        onBack={handleBack}
        sections={sections}
        footerButtons={footerButtons}
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
  planTitle: {
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 8,
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  loadingText: {
    marginTop: 12,
    color: "#a0a0a0",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
});

export default UserProfile;
