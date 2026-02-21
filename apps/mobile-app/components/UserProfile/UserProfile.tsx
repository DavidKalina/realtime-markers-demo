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
import { MapPin, User } from "lucide-react-native";
import Card from "../Layout/Card";
import Screen from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import UserStats from "../Layout/UserStats";
import DeleteAccountModalComponent from "./DeleteAccountModal";

interface UserProfileProps {
  onBack?: () => void;
}

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
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        bannerTitle="Profile"
        bannerDescription="Your account and preferences"
        showBackButton={true}
        onBack={handleBack}
        isScrollable
      >
        <View style={styles.profileContainer}>
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <User size={20} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Your Stats</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Your scanning and saving activity
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
              Keep scanning to discover more events around you.
            </Text>
          </Card>

          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <User size={20} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Account Information</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Your account details
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
              <Text style={styles.label}>Member Since</Text>
              <Text style={styles.value}>{memberSince}</Text>
            </View>
          </Card>

          {profileData?.bio && (
            <Card style={styles.card}>
              <View style={styles.sectionHeader}>
                <User size={20} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>Bio</Text>
              </View>
              <Text style={styles.bioText}>{profileData.bio}</Text>
            </Card>
          )}

          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Map Style</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Choose your preferred map appearance
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
                      Detailed street-level view
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
                  true: COLORS.accent,
                }}
                thumbColor={
                  mapSettings.isPitched
                    ? COLORS.accent
                    : COLORS.cardBackground
                }
              />
            </View>
          </Card>

          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <User size={20} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Manage your account settings
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
    fontFamily: "SpaceMono",
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
    fontFamily: "SpaceMono",
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    fontFamily: "SpaceMono",
    lineHeight: 20,
  },
  detailRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontFamily: "SpaceMono",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  bioText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
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
    fontFamily: "SpaceMono",
    textAlign: "center",
    fontWeight: "500",
  },
  deleteButtonText: {
    color: COLORS.errorText,
    fontSize: 16,
    fontFamily: "SpaceMono",
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
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.accent,
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
    borderColor: COLORS.accent,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
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
    fontFamily: "SpaceMono",
    marginBottom: 4,
    fontWeight: "500",
  },
  settingDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    lineHeight: 20,
  },
  statsDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
});

export default UserProfile;
