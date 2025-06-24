import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useProfile } from "@/hooks/useProfile";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Building, MapPin, Shield, User, Heart } from "lucide-react-native";
import Card from "../Layout/Card";
import Screen from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import UserStats from "../Layout/UserStats";
import DeleteAccountModalComponent from "./DeleteAccountModal";

interface UserProfileProps {
  onBack?: () => void;
}

// Warm, community-focused color scheme
const COMMUNITY_COLORS = {
  primary: "#3b82f6", // Friendly blue
  secondary: "#10b981", // Community green
  accent: "#f59e0b", // Warm amber
  background: "#f8fafc", // Soft background
  card: "#ffffff", // Clean white
  text: "#1e293b", // Readable dark
  textSecondary: "#64748b", // Gentle gray
  border: "#e2e8f0", // Soft border
  success: "#10b981", // Success green
  warning: "#f59e0b", // Warm warning
  error: "#ef4444", // Clear error
};

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { currentStyle, isPitched, togglePitch, setMapStyle } = useMapStyle();
  const {
    loading,
    profileData,
    memberSince,
    deleteError,
    isDeleting,
    showDeleteDialog,
    password,
    handleBack,
    handleLogout,
    handleDeleteAccount,
    handleCloseDeleteDialog,
    setShowDeleteDialog,
    setPassword,
  } = useProfile(onBack);

  const [mapSettings, setMapSettings] = useState({
    isPitched: isPitched,
    mapStyle: currentStyle,
  });

  const handleMapStyleChange = (style: "light" | "dark" | "street") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMapSettings((prev) => ({ ...prev, mapStyle: style }));
    setMapStyle(style);
  };

  const handlePitchChange = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMapSettings((prev) => ({ ...prev, isPitched: value }));
    togglePitch();
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COMMUNITY_COLORS.primary} />
          <Text style={styles.loadingText}>
            Loading your community profile...
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        bannerTitle="My Community"
        bannerDescription="Your local engagement journey"
        bannerEmoji="🏘️"
        showBackButton={true}
        onBack={handleBack}
        isScrollable
      >
        <View style={styles.profileContainer}>
          {/* Community Activity - Show what you've discovered */}
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Heart size={20} color={COMMUNITY_COLORS.primary} />
              <Text style={styles.sectionTitle}>My Local Adventures</Text>
            </View>
            <Text style={styles.sectionDescription}>
              See how you're exploring and connecting with your community
            </Text>
            <UserStats
              items={[
                {
                  value: profileData?.scanCount || 0,
                  label: "Events Found",
                },
                {
                  value: profileData?.saveCount || 0,
                  label: "Events Saved",
                },
              ]}
              animated={true}
              delay={200}
            />
            <Text style={styles.statsDescription}>
              Every event you discover helps build a stronger, more connected
              community! 🎉
            </Text>
          </Card>

          {/* About You - More personal and friendly */}
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <User size={20} color={COMMUNITY_COLORS.primary} />
              <Text style={styles.sectionTitle}>About You</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Help us get to know you better as a community member
            </Text>
            {profileData?.firstName && (
              <View style={styles.detailRow}>
                <Text style={styles.label}>First Name</Text>
                <Text style={styles.value}>{profileData.firstName}</Text>
              </View>
            )}
            {profileData?.lastName && (
              <View style={styles.detailRow}>
                <Text style={styles.label}>Last Name</Text>
                <Text style={styles.value}>{profileData.lastName}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Community Member Since</Text>
              <Text style={styles.value}>{memberSince}</Text>
            </View>
          </Card>

          {/* Bio Section - More engaging */}
          {profileData?.bio && (
            <Card style={styles.card}>
              <View style={styles.sectionHeader}>
                <Building size={20} color={COMMUNITY_COLORS.primary} />
                <Text style={styles.sectionTitle}>Your Story</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Share what makes you excited about your community
              </Text>
              <Text style={styles.bioText}>{profileData.bio}</Text>
            </Card>
          )}

          {/* Map Preferences - More user-friendly */}
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color={COMMUNITY_COLORS.primary} />
              <Text style={styles.sectionTitle}>Map Style</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Choose how you'd like to explore your neighborhood
            </Text>

            {/* Map Style Settings */}
            <View style={styles.styleOptions}>
              <Pressable
                style={[
                  styles.styleOption,
                  mapSettings.mapStyle === "light" && styles.styleOptionActive,
                ]}
                onPress={() => handleMapStyleChange("light")}
              >
                <View style={styles.styleOptionContent}>
                  <View
                    style={[
                      styles.radioButton,
                      mapSettings.mapStyle === "light" &&
                        styles.radioButtonActive,
                    ]}
                  >
                    {mapSettings.mapStyle === "light" && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <View style={styles.styleOptionText}>
                    <Text style={styles.settingText}>Classic</Text>
                    <Text style={styles.settingDescription}>
                      Clean and easy to read
                    </Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.styleOption,
                  mapSettings.mapStyle === "dark" && styles.styleOptionActive,
                ]}
                onPress={() => handleMapStyleChange("dark")}
              >
                <View style={styles.styleOptionContent}>
                  <View
                    style={[
                      styles.radioButton,
                      mapSettings.mapStyle === "dark" &&
                        styles.radioButtonActive,
                    ]}
                  >
                    {mapSettings.mapStyle === "dark" && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <View style={styles.styleOptionText}>
                    <Text style={styles.settingText}>Night Mode</Text>
                    <Text style={styles.settingDescription}>
                      Easy on the eyes after dark
                    </Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.styleOption,
                  mapSettings.mapStyle === "street" && styles.styleOptionActive,
                ]}
                onPress={() => handleMapStyleChange("street")}
              >
                <View style={styles.styleOptionContent}>
                  <View
                    style={[
                      styles.radioButton,
                      mapSettings.mapStyle === "street" &&
                        styles.radioButtonActive,
                    ]}
                  >
                    {mapSettings.mapStyle === "street" && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <View style={styles.styleOptionText}>
                    <Text style={styles.settingText}>Street View</Text>
                    <Text style={styles.settingDescription}>
                      See all the neighborhood details
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>

            {/* 3D Buildings Toggle */}
            <View style={[styles.settingRow, styles.lastSettingRow]}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingText}>3D Buildings</Text>
                <Text style={styles.settingDescription}>
                  Make the map feel more real and immersive
                </Text>
              </View>
              <Switch
                value={mapSettings.isPitched}
                onValueChange={handlePitchChange}
                trackColor={{
                  false: COLORS.divider,
                  true: COMMUNITY_COLORS.primary,
                }}
                thumbColor={
                  mapSettings.isPitched
                    ? COMMUNITY_COLORS.primary
                    : COLORS.cardBackground
                }
              />
            </View>
          </Card>

          {/* Account Settings - Friendly but clear */}
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Shield size={20} color={COMMUNITY_COLORS.primary} />
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Manage your community profile settings
            </Text>
            <View style={styles.buttonContainer}>
              <Card
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleLogout();
                }}
              >
                <Text style={styles.buttonText}>Sign Out</Text>
              </Card>
              <Card
                style={styles.deleteActionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDeleteDialog(true);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete Account</Text>
              </Card>
            </View>
          </Card>
        </View>
      </Screen>

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
    backgroundColor: COLORS.cardBackgroundAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
  },
  profileContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    marginVertical: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginLeft: 8,
    fontFamily: "Poppins-Regular",
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    fontFamily: "Poppins-Regular",
    lineHeight: 20,
  },
  detailRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontFamily: "Poppins-Regular",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
    fontWeight: "500",
  },
  bioText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  actionButton: {
    padding: 16,
    marginVertical: 0,
    backgroundColor: COLORS.buttonBackground,
    borderColor: COLORS.buttonBorder,
  },
  deleteActionButton: {
    padding: 16,
    marginVertical: 0,
    backgroundColor: COLORS.errorBackground,
    borderColor: COLORS.errorBorder,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    fontWeight: "500",
  },
  deleteButtonText: {
    color: COLORS.errorText,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    fontWeight: "500",
  },
  styleOptions: {
    marginBottom: 16,
  },
  styleOption: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  styleOptionActive: {
    backgroundColor: COMMUNITY_COLORS.background,
    borderWidth: 2,
    borderColor: COMMUNITY_COLORS.primary,
  },
  styleOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  styleOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonActive: {
    borderColor: COMMUNITY_COLORS.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COMMUNITY_COLORS.primary,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  lastSettingRow: {
    marginTop: 8,
  },
  settingLabel: {
    flex: 1,
    marginRight: 16,
  },
  settingText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "Poppins-Regular",
    marginBottom: 4,
    fontWeight: "500",
  },
  settingDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Poppins-Regular",
    lineHeight: 20,
  },
  statsDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Poppins-Regular",
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
});

export default UserProfile;
