import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useUserLocation } from "@/contexts/LocationContext";
import { useProfile } from "@/hooks/useProfile";
import useUserStats from "@/hooks/useUserStats";
import { useJobProgress } from "@/hooks/useJobProgress";
import {
  useColors,
  useTheme,
  type Colors,
  type ThemeMode,
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  useItineraryJobStore,
  clearStaleJobIfNeeded,
} from "@/stores/useItineraryJobStore";
import { useProfileInsights } from "@/hooks/useProfileInsights";
import Screen from "../Layout/Screen";
import PullToActionScrollView from "../Layout/PullToActionScrollView";
import QuestDialogBox from "../Quest/QuestDialogBox";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import UserStatsCard from "./UserStatsCard";
import ActiveQuestBanner from "./ActiveQuestBanner";
import RecentCompletions from "./RecentCompletions";
import ActivityHeatmap from "./ActivityHeatmap";
import VenueDnaChart from "./VenueDnaChart";
import AdventureDnaChart from "./AdventureDnaChart";
import StreakCalendar from "./StreakCalendar";
import AdventureFootprint from "./AdventureFootprint";
import PersonalScoreHero from "./PersonalScoreHero";
import AdventurePreferences from "./AdventurePreferences";

/* ─── Types ─── */

type ProfileTab = "adventures" | "insights" | "settings";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "adventures", label: "Adventures" },
  { key: "insights", label: "Insights" },
  { key: "settings", label: "Settings" },
];

interface UserProfileProps {
  onBack?: () => void;
}

const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
];

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { isPitched, togglePitch } = useMapStyle();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { userLocation } = useUserLocation();
  const { trackJob } = useJobProgress();
  const startJob = useItineraryJobStore((s) => s.startJob);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGetAwayLoading, setIsGetAwayLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("adventures");
  const {
    loading,
    profileData,
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

  const {
    stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useUserStats();

  const { data: insights, refetch: refetchInsights } = useProfileInsights();

  const completionsRefetchRef = useRef<(() => Promise<void>) | null>(null);
  const scoreRefetchRef = useRef<(() => Promise<void>) | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchStats(),
        refetchInsights(),
        useActiveItineraryStore.getState().refresh(),
        completionsRefetchRef.current?.(),
        scoreRefetchRef.current?.(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, refetchStats, refetchInsights]);

  const handleThemeChange = (mode: ThemeMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setThemeMode(mode);
  };

  const handlePitchChange = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    togglePitch();
  };

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
  }, [router]);

  const handleGetAway = useCallback(async () => {
    if (!userLocation || isGetAwayLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearStaleJobIfNeeded();
    setIsGetAwayLoading(true);

    try {
      const result = await apiClient.sidequests.createSidequest({
        prompt: "",
        radiusMiles: 30,
        budgetMax: 50,
        latitude: userLocation[1],
        longitude: userLocation[0],
        timezone: getUserTimezone(),
        surpriseMe: true,
      });

      trackJob(result.jobId);
      startJob(result.jobId, result.sidequestId);
      router.push({
        pathname: "/itineraries/[id]" as const,
        params: { id: result.sidequestId },
      });
    } catch (err) {
      console.error("[UserProfile] Get Away failed:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGetAwayLoading(false);
    }
  }, [userLocation, isGetAwayLoading, trackJob, startJob, router]);

  const handleTabPress = useCallback((tab: ProfileTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  /* ─── Tab renderers ─── */

  const renderAdventuresTab = () => (
    <>
      {/* Recent Completions (rate unrated) */}
      <View style={styles.tabSection}>
        <RecentCompletions onRefetchRef={completionsRefetchRef} />
      </View>
    </>
  );

  const renderInsightsTab = () => (
    <>
      {/* Adventure Streak (visual calendar) */}
      {(profileData?.currentStreak ||
        profileData?.longestStreak ||
        (insights?.streakCalendar && insights.streakCalendar.length > 0)) && (
        <Animated.View
          entering={FadeIn.duration(duration.normal)}
          style={styles.tabSection}
        >
          <StreakCalendar
            data={insights?.streakCalendar ?? []}
            currentStreak={profileData?.currentStreak ?? 0}
            longestStreak={profileData?.longestStreak ?? 0}
          />
        </Animated.View>
      )}

      {/* Activity Heatmap */}
      <Animated.View
        entering={FadeIn.duration(duration.normal).delay(80)}
        style={styles.tabSection}
      >
        <ActivityHeatmap data={insights?.activityHeatmap ?? []} />
      </Animated.View>

      {/* Venue DNA */}
      <Animated.View
        entering={FadeIn.duration(duration.normal).delay(160)}
        style={styles.tabSection}
      >
        <VenueDnaChart data={insights?.venueDna ?? []} />
      </Animated.View>

      {/* Adventure DNA (Vibes & Intentions) */}
      <Animated.View
        entering={FadeIn.duration(duration.normal).delay(200)}
        style={styles.tabSection}
      >
        <AdventureDnaChart
          vibes={insights?.vibeDna ?? []}
          intentions={insights?.intentionDna ?? []}
        />
      </Animated.View>

      {/* Adventure Footprint */}
      <Animated.View
        entering={FadeIn.duration(duration.normal).delay(240)}
        style={styles.tabSection}
      >
        <AdventureFootprint
          footprint={
            insights?.footprint ?? {
              totalDistanceMiles: 0,
              totalCheckins: 0,
              totalCompletedItineraries: 0,
              totalUniqueVenues: 0,
              totalStopsVisited: 0,
              avgStopsPerItinerary: 0,
              cities: [],
            }
          }
        />
      </Animated.View>
      {/* Stats */}
      <Animated.View
        entering={FadeIn.duration(duration.normal).delay(320)}
        style={styles.tabSection}
      >
        <UserStatsCard stats={stats} isLoading={statsLoading} />
      </Animated.View>
    </>
  );

  const renderSettingsTab = () => (
    <>
      {/* Account */}
      <View style={styles.tabSection}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.inlineRow}>
          <Text style={styles.inlineRowLabel}>Email</Text>
          <Text style={styles.inlineRowValue} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        {profileData?.bio ? (
          <View style={styles.inlineRow}>
            <Text style={styles.inlineRowLabel}>Bio</Text>
            <Text style={styles.inlineRowValue} numberOfLines={2}>
              {profileData.bio}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Appearance */}
      <View style={styles.tabSection}>
        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.inlineRow}>
          <Text style={styles.inlineRowLabel}>Theme</Text>
          <View style={styles.pillGroup}>
            {THEME_OPTIONS.map(({ key, label }) => (
              <Pressable
                key={key}
                style={[styles.pill, themeMode === key && styles.pillActive]}
                onPress={() => handleThemeChange(key)}
              >
                <Text
                  style={[
                    styles.pillText,
                    themeMode === key && styles.pillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.inlineRow}>
          <Text style={styles.inlineRowLabel}>3D Buildings</Text>
          <Switch
            value={isPitched}
            onValueChange={handlePitchChange}
            trackColor={{
              false: colors.border.medium,
              true: colors.accent.primary,
            }}
            thumbColor={colors.bg.elevated}
          />
        </View>
      </View>

      {/* Adventure Preferences */}
      <View style={styles.tabSection}>
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <AdventurePreferences />
      </View>

      {/* Actions */}
      <View style={styles.tabSection}>
        <Pressable
          style={styles.inlineAction}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleLogout();
          }}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
          <ChevronRight size={14} color={colors.text.secondary} />
        </Pressable>
        <Pressable
          style={[
            styles.inlineAction,
            __DEV__ ? undefined : styles.inlineActionLast,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowDeleteDialog(true);
          }}
        >
          <Text style={styles.deleteText}>Delete Account</Text>
          <ChevronRight size={14} color={colors.status.error.text} />
        </Pressable>
      </View>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "adventures":
        return renderAdventuresTab();
      case "insights":
        return renderInsightsTab();
      case "settings":
        return renderSettingsTab();
    }
  };

  return (
    <>
      <Screen
        isScrollable={false}
        bannerDescription="Your account and preferences"
        showBackButton
        onBack={handleBack}
        noAnimation
        bottomContent={<QuestDialogBox style={{ marginBottom: 0 }} />}
      >
        <PullToActionScrollView
          onSearch={handleSearch}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        >
          {loading && (
            <Animated.View
              exiting={FadeOut.duration(duration.fast)}
              style={styles.loadingContainer}
            >
              <ActivityIndicator size="large" color={colors.accent.primary} />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </Animated.View>
          )}

          {!loading && (
            <>
              {/* Hero: Personal Score */}
              <Animated.View
                entering={FadeIn.duration(duration.normal)}
                style={styles.heroSection}
              >
                <PersonalScoreHero
                  totalXp={profileData?.totalXp || 0}
                  currentStreak={profileData?.currentStreak || 0}
                  longestStreak={profileData?.longestStreak || 0}
                  onRefetchRef={scoreRefetchRef}
                />
              </Animated.View>

              {/* Hero: Active Quest Banner */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(100)}
                style={styles.heroSection}
              >
                <ActiveQuestBanner />
              </Animated.View>

              {/* Get Away button */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(130)}
                style={styles.heroSection}
              >
                <Pressable
                  style={[
                    styles.getAwayButton,
                    isGetAwayLoading && { opacity: 0.6 },
                  ]}
                  disabled={isGetAwayLoading}
                  onPress={handleGetAway}
                >
                  {isGetAwayLoading ? (
                    <ActivityIndicator size="small" color={colors.text.inverse} />
                  ) : (
                    <Text style={styles.getAwayEmoji}>{"\u{1F3B2}"}</Text>
                  )}
                  <View style={styles.getAwayInfo}>
                    <Text style={styles.getAwayTitle}>Get Away</Text>
                    <Text style={styles.getAwaySub}>
                      {isGetAwayLoading
                        ? "Generating adventure..."
                        : "Instant adventure near you"}
                    </Text>
                  </View>
                  <ChevronRight size={14} color={colors.text.inverse} />
                </Pressable>
              </Animated.View>

              {/* Tab bar */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(160)}
              >
                <View style={styles.tabBar}>
                  {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        style={[
                          styles.tabButton,
                          isActive && styles.tabButtonActive,
                        ]}
                        onPress={() => handleTabPress(tab.key)}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            isActive && styles.tabTextActive,
                          ]}
                        >
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Tab content */}
                <Animated.View
                  key={activeTab}
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(120)}
                  layout={LinearTransition.duration(250)}
                >
                  {renderTabContent()}
                </Animated.View>
              </Animated.View>
            </>
          )}

          <View style={{ height: 120 }} />
        </PullToActionScrollView>
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
    // Hero sections (above tabs)
    heroSection: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    getAwayButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accent.primary,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    getAwayEmoji: {
      fontSize: 22,
    },
    getAwayInfo: {
      flex: 1,
    },
    getAwayTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.inverse,
    },
    getAwaySub: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.inverse,
      opacity: 0.8,
    },
    // Tab bar (pill-shaped, matches CityDetailContent)
    tabBar: {
      flexDirection: "row",
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      padding: 2,
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: spacing.sm,
      borderRadius: radius.lg - 2,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    tabButtonActive: {
      backgroundColor: colors.bg.elevated,
    },
    tabText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    tabTextActive: {
      color: colors.text.primary,
    },
    // Tab content sections
    tabSection: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing["2xl"],
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginBottom: spacing.md,
    },
    inlineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    inlineRowLabel: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      marginRight: spacing.lg,
    },
    inlineRowValue: {
      flex: 1,
      fontSize: fontSize.sm,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      textAlign: "right",
    },
    // Theme pills (compact)
    pillGroup: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    pill: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    pillActive: {
      backgroundColor: colors.accent.muted,
      borderColor: colors.accent.border,
    },
    pillText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    pillTextActive: {
      color: colors.accent.primary,
    },
    // Inline actions
    inlineAction: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    inlineActionLast: {
      borderBottomWidth: 0,
    },
    signOutText: {
      color: colors.text.primary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      fontFamily: fontFamily.mono,
    },
    deleteText: {
      color: colors.status.error.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      fontFamily: fontFamily.mono,
    },
    // Surprise Me CTA
    surpriseCta: {
      borderWidth: 1.5,
      borderColor: colors.accent.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      alignItems: "center",
      justifyContent: "center",
    },
    surpriseCtaPressed: {
      opacity: 0.6,
    },
    surpriseCtaText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.accent.primary,
      letterSpacing: 0.5,
    },
  });

export default UserProfile;
