import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle, MapStyleType } from "@/contexts/MapStyleContext";
import { useProfile } from "@/hooks/useProfile";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
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
import DeleteAccountModalComponent from "./DeleteAccountModal";
import TierBadge from "../Gamification/TierBadge";
import XPProgressBar from "../Gamification/XPProgressBar";
import { useXPStore } from "@/stores/useXPStore";
import { getTierForXP } from "@/utils/gamification";

interface UserProfileProps {
  onBack?: () => void;
}

const MAP_STYLES: { key: MapStyleType; label: string }[] = [
  { key: "dark", label: "Night" },
  { key: "light", label: "Classic" },
  { key: "street", label: "Street" },
];

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const { user } = useAuth();
  const router = useRouter();
  const { currentStyle, isPitched, togglePitch, setMapStyle } = useMapStyle();
  const {
    loading,
    profileData,
    memberSince,
    deleteError,
    isDeleting,
    showDeleteDialog,
    password,
    refetch,
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

  // Consume pending XP on each focus, but only animate AFTER fresh data arrives
  const consume = useXPStore((s) => s.consume);
  const liveHasPending = useXPStore((s) => s.hasPending);
  const [pendingXP, setPendingXP] = useState(0);
  const isHandlingLive = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setPendingXP(0);
      let cancelled = false;

      const store = useXPStore.getState();
      if (store.hasPending) {
        const result = consume();
        const gained = result.totalXP;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Wait for fresh totalXp from server before triggering animation
        refetch().then(() => {
          if (!cancelled) {
            setPendingXP(gained);
          }
        });
      }

      return () => {
        cancelled = true;
      };
    }, [consume, refetch]),
  );

  // Live XP: handle new events arriving while already on this screen
  useEffect(() => {
    if (liveHasPending && !isHandlingLive.current) {
      isHandlingLive.current = true;
      const result = consume();
      if (result.totalXP > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        refetch().then(() => {
          setPendingXP((prev) => prev + result.totalXP);
          isHandlingLive.current = false;
        });
      } else {
        isHandlingLive.current = false;
      }
    }
  }, [liveHasPending, consume, refetch]);

  const handleMapStyleChange = (style: MapStyleType) => {
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

  const displayName = [profileData?.firstName, profileData?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Screen
        bannerTitle="Profile"
        bannerDescription="Your account and preferences"
        showBackButton={true}
        onBack={handleBack}
        isScrollable
      >
        <View style={styles.container}>
          {/* Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Progress</Text>
            <View style={styles.tierRow}>
              <TierBadge
                tier={getTierForXP(profileData?.totalXp || 0).name}
                size="md"
              />
            </View>
            <XPProgressBar
              totalXp={profileData?.totalXp || 0}
              currentTier={getTierForXP(profileData?.totalXp || 0).name}
              pendingXP={pendingXP}
            />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {profileData?.scanCount || 0}
                </Text>
                <Text style={styles.statLabel}>Events Found</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {profileData?.saveCount || 0}
                </Text>
                <Text style={styles.statLabel}>Events Saved</Text>
              </View>
              <View style={styles.statDivider} />
              <Pressable
                style={styles.statItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/following");
                }}
              >
                <Text style={styles.statValue}>
                  {profileData?.followingCount || 0}
                </Text>
                <Text style={styles.statLabel}>Following</Text>
              </Pressable>
            </View>
          </View>

          {/* Account Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            {displayName ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{displayName}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            <View style={[styles.infoRow, styles.lastRow]}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>{memberSince}</Text>
            </View>
            {profileData?.bio ? (
              <View style={styles.bioRow}>
                <Text style={styles.infoLabel}>Bio</Text>
                <Text style={styles.bioText}>{profileData.bio}</Text>
              </View>
            ) : null}
          </View>

          {/* Map Style */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Map Style</Text>
            <View style={styles.stylePills}>
              {MAP_STYLES.map(({ key, label }) => (
                <Pressable
                  key={key}
                  style={[
                    styles.stylePill,
                    mapSettings.mapStyle === key && styles.stylePillActive,
                  ]}
                  onPress={() => handleMapStyleChange(key)}
                >
                  <Text
                    style={[
                      styles.stylePillText,
                      mapSettings.mapStyle === key &&
                        styles.stylePillTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.switchTitle}>3D Buildings</Text>
                <Text style={styles.switchDescription}>
                  Tilted view with 3D buildings
                </Text>
              </View>
              <Switch
                value={mapSettings.isPitched}
                onValueChange={handlePitchChange}
                trackColor={{
                  false: colors.border.medium,
                  true: colors.accent.primary,
                }}
                thumbColor={colors.bg.elevated}
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={styles.signOutButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleLogout();
              }}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowDeleteDialog(true);
              }}
            >
              <Text style={styles.deleteText}>Delete Account</Text>
            </Pressable>
          </View>

          <View style={{ height: 100 }} />
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Tier
  tierRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Stats
  statsRow: {
    flexDirection: "row",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.default,
  },
  // Account Info
  infoRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
  },
  bioRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  bioText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.loose,
  },
  // Map Style
  stylePills: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  stylePill: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  stylePillActive: {
    backgroundColor: colors.accent.muted,
    borderColor: colors.accent.border,
  },
  stylePillText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  stylePillTextActive: {
    color: colors.accent.primary,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  switchLabel: {
    flex: 1,
    marginRight: spacing.lg,
  },
  switchTitle: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  switchDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
  },
  // Actions
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  signOutButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "center",
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  signOutText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "center",
    backgroundColor: colors.status.error.bg,
    borderWidth: 1,
    borderColor: colors.status.error.border,
  },
  deleteText: {
    color: colors.status.error.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
});

export default UserProfile;
