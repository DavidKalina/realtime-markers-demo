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
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
} from "@/theme";
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
          <ActivityIndicator size="large" color={colors.accent.primary} />
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
              <User size={20} color={colors.accent.primary} />
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
              <User size={20} color={colors.accent.primary} />
              <Text style={styles.sectionTitle}>Account Information</Text>
            </View>
            <Text style={styles.sectionDescription}>Your account details</Text>
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
                <User size={20} color={colors.accent.primary} />
                <Text style={styles.sectionTitle}>Bio</Text>
              </View>
              <Text style={styles.bioText}>{profileData.bio}</Text>
            </Card>
          )}

          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color={colors.accent.primary} />
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
                  false: colors.border.default,
                  true: colors.accent.primary,
                }}
                thumbColor={
                  mapSettings.isPitched ? colors.accent.primary : colors.bg.card
                }
              />
            </View>
          </Card>

          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <User size={20} color={colors.accent.primary} />
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
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },
  profileContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    marginVertical: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    fontFamily: fontFamily.mono,
  },
  sectionDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
  },
  detailRow: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontFamily: fontFamily.mono,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
  },
  bioText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.loose,
  },
  buttonContainer: {
    gap: spacing.md,
  },
  actionButton: {
    padding: spacing.lg,
    marginVertical: 0,
    backgroundColor: colors.border.subtle,
    borderColor: colors.border.medium,
  },
  deleteActionButton: {
    padding: spacing.lg,
    marginVertical: 0,
    backgroundColor: colors.status.error.bg,
    borderColor: colors.status.error.border,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    textAlign: "center",
    fontWeight: fontWeight.medium,
  },
  deleteButtonText: {
    color: colors.status.error.text,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    textAlign: "center",
    fontWeight: fontWeight.medium,
  },
  styleOptions: {
    marginBottom: spacing.lg,
  },
  styleOption: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  styleOptionActive: {
    backgroundColor: colors.bg.primary,
    borderWidth: 2,
    borderColor: colors.accent.primary,
  },
  styleOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  styleOptionText: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  radioButton: {
    width: spacing["2xl"],
    height: spacing["2xl"],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonActive: {
    borderColor: colors.accent.primary,
  },
  radioButtonInner: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: 6,
    backgroundColor: colors.accent.primary,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  lastSettingRow: {
    marginTop: spacing.sm,
  },
  settingLabel: {
    flex: 1,
    marginRight: spacing.lg,
  },
  settingText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  settingDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
  },
  statsDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});

export default UserProfile;
