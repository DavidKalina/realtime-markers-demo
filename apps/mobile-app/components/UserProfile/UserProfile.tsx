import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useProfileInsights } from "@/hooks/useProfileInsights";
import useUserStats from "@/hooks/useUserStats";
import { apiClient } from "@/services/ApiClient";
import type { DeckStatsResponse } from "@/services/api/modules/deckStats";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import PullToActionScrollView from "../Layout/PullToActionScrollView";
import Screen from "../Layout/Screen";
import QuestDialogBox from "../Quest/QuestDialogBox";
import ActiveQuestBanner from "./ActiveQuestBanner";
import ActivityHeatmap from "./ActivityHeatmap";
import AdventureDnaChart from "./AdventureDnaChart";
import AdventureFootprint from "./AdventureFootprint";
import AdventurePreferences from "./AdventurePreferences";
import DeckComposition from "./DeckComposition";
import DeckHero from "./DeckHero";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import RecentCompletions from "./RecentCompletions";
import StreakCalendar from "./StreakCalendar";
import UserStatsCard from "./UserStatsCard";
import VenueDnaChart from "./VenueDnaChart";

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


const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const [deckStats, setDeckStats] = useState<DeckStatsResponse | null>(null);

  const fetchDeckStats = useCallback(async () => {
    try {
      const stats = await apiClient.deckStats.getStats();
      setDeckStats(stats);
    } catch (err) {
      console.error("[UserProfile] Failed to fetch deck stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchDeckStats();
  }, [fetchDeckStats]);

  const completionsRefetchRef = useRef<(() => Promise<void>) | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchStats(),
        refetchInsights(),
        fetchDeckStats(),
        useActiveItineraryStore.getState().refresh(),
        completionsRefetchRef.current?.(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, refetchStats, refetchInsights, fetchDeckStats]);


  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
  }, [router]);

  const handleTabPress = useCallback((tab: ProfileTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  /* ─── Tab renderers ─── */

  const renderAdventuresTab = () => (
    <>
      {/* Deck Composition */}
      <View style={styles.tabSection}>
        <DeckComposition data={deckStats} />
      </View>

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
              {/* Hero: Deck Summary */}
              <Animated.View
                entering={FadeIn.duration(duration.normal)}
                style={styles.heroSection}
              >
                <DeckHero
                  data={deckStats}
                  totalXp={profileData?.totalXp || 0}
                  currentStreak={profileData?.currentStreak || 0}
                  longestStreak={profileData?.longestStreak || 0}
                />
              </Animated.View>

              {/* Hero: Active Quest Banner */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(100)}
                style={styles.heroSection}
              >
                <ActiveQuestBanner />
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
  });

export default UserProfile;
