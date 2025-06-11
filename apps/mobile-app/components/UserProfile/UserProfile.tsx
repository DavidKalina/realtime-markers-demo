import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useProfile } from "@/hooks/useProfile";
import { useFetchMyFriends } from "@/hooks/useFetchMyFriends";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Switch,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import Screen from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import * as Haptics from "expo-haptics";
import Card from "../Layout/Card";
import { UserPlus, ChevronRight } from "lucide-react-native";
import UserStats from "../Layout/UserStats";

interface UserProfileProps {
  onBack?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { currentStyle, isPitched, togglePitch, setMapStyle } = useMapStyle();
  const { friends, isLoading: isLoadingFriends } = useFetchMyFriends();
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

  const handleNavigateToFriends = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/friends");
  }, [router]);

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
      <Screen
        bannerTitle={profileData?.displayName || user?.email || ""}
        bannerDescription={profileData?.bio || "View your profile details"}
        bannerEmoji="👤"
        showBackButton={true}
        onBack={handleBack}
        isScrollable
      >
        <View style={styles.profileContainer}>
          {/* Account Info Card */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Member Since</Text>
              <Text style={styles.value}>{memberSince}</Text>
            </View>
          </Card>

          {/* User Stats Card */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <UserStats
              items={[
                {
                  value: profileData?.scanCount || 0,
                  label: "Scans",
                },
                {
                  value: profileData?.saveCount || 0,
                  label: "Saves",
                },
                {
                  value: profileData?.totalXp || 0,
                  label: "XP",
                },
                {
                  value: profileData?.level || 1,
                  label: "Level",
                  badge: profileData?.currentTitle || "Explorer",
                },
              ]}
              animated={true}
              delay={200}
            />
          </Card>

          {/* Bio Card - Only show if bio exists */}
          {profileData?.bio && (
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{profileData.bio}</Text>
            </Card>
          )}

          {/* Map Settings Card */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Map Settings</Text>

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
                    <Text style={styles.settingText}>Light Style</Text>
                    <Text style={styles.settingDescription}>
                      Use light map theme
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
                    <Text style={styles.settingText}>Dark Style</Text>
                    <Text style={styles.settingDescription}>
                      Use dark map theme
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
                    <Text style={styles.settingText}>Street Style</Text>
                    <Text style={styles.settingDescription}>
                      Use street map theme
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
                  Show buildings in 3D
                </Text>
              </View>
              <Switch
                value={mapSettings.isPitched}
                onValueChange={handlePitchChange}
                trackColor={{ false: COLORS.divider, true: COLORS.accent }}
                thumbColor={
                  mapSettings.isPitched
                    ? COLORS.accentDark
                    : COLORS.cardBackground
                }
              />
            </View>
          </Card>

          {/* Friends Card */}
          <Card style={styles.card} onPress={handleNavigateToFriends}>
            <View style={styles.friendsCardContent}>
              <View style={styles.friendsCardLeft}>
                <UserPlus
                  size={24}
                  color={COLORS.textPrimary}
                  style={styles.friendsIcon}
                />
                <View>
                  <Text style={styles.friendsTitle}>Friends</Text>
                  <Text style={styles.friendsSubtitle}>
                    {isLoadingFriends
                      ? "Loading friends..."
                      : friends.length === 0
                        ? "No friends yet"
                        : `${friends.length} friend${friends.length === 1 ? "" : "s"}`}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={COLORS.textSecondary} />
            </View>
          </Card>

          {/* Actions Card */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            <View style={styles.buttonContainer}>
              <Card
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleLogout();
                }}
              >
                <Text style={styles.buttonText}>Log Out</Text>
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
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  profileContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    marginVertical: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 16,
    fontFamily: "SpaceMono",
  },
  detailRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontFamily: "SpaceMono",
  },
  value: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
  bioText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  actionButton: {
    padding: 12,
    marginVertical: 0,
    backgroundColor: COLORS.buttonBackground,
    borderColor: COLORS.buttonBorder,
  },
  deleteActionButton: {
    padding: 12,
    marginVertical: 0,
    backgroundColor: COLORS.errorBackground,
    borderColor: COLORS.errorBorder,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  deleteButtonText: {
    color: COLORS.errorText,
    fontSize: 14,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  styleOptions: {
    marginBottom: 16,
  },
  styleOption: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  styleOptionActive: {
    backgroundColor: COLORS.buttonBackground,
  },
  styleOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  styleOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonActive: {
    borderColor: COLORS.accent,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
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
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  friendsCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  friendsCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendsIcon: {
    marginRight: 12,
  },
  friendsTitle: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  friendsSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
});

export default UserProfile;
