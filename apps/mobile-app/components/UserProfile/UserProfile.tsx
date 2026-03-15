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
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useProfile } from "@/hooks/useProfile";
import useUserStats from "@/hooks/useUserStats";
import { useXPStore } from "@/stores/useXPStore";
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
import { getTierForXP } from "@/utils/gamification";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useProfileInsights } from "@/hooks/useProfileInsights";
import DiscovererCard from "../EventDetails/DiscovererCard";
import Screen from "../Layout/Screen";
import PullToActionScrollView from "../Layout/PullToActionScrollView";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import UserStatsCard from "./UserStatsCard";
import ActiveQuestBanner from "./ActiveQuestBanner";
import RecentCompletions from "./RecentCompletions";
import BadgeGrid from "./BadgeGrid";
import AdventureScoreCard from "./AdventureScoreCard";
import ActivityHeatmap from "./ActivityHeatmap";
import VenueDnaChart from "./VenueDnaChart";
import StreakCalendar from "./StreakCalendar";
import AdventureFootprint from "./AdventureFootprint";
import PendingItineraries from "./PendingItineraries";

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
  const { resetOnboarding } = useOnboarding();
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const {
    stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useUserStats();

  const { data: insights, refetch: refetchInsights } = useProfileInsights();

  const completionsRefetchRef = useRef<(() => Promise<void>) | null>(null);
  const pendingRefetchRef = useRef<(() => Promise<void>) | null>(null);
  const badgesRefetchRef = useRef<(() => Promise<void>) | null>(null);
  const scoreRefetchRef = useRef<(() => Promise<void>) | null>(null);

  // Consume pending XP on each focus, but only animate AFTER fresh data arrives
  const consume = useXPStore((s) => s.consume);
  const liveHasPending = useXPStore((s) => s.hasPending);
  const isHandlingLive = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const store = useXPStore.getState();
      if (store.hasPending) {
        consume();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        refetch();
      }
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
          isHandlingLive.current = false;
        });
      } else {
        isHandlingLive.current = false;
      }
    }
  }, [liveHasPending, consume, refetch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchStats(),
        refetchInsights(),
        useActiveItineraryStore.getState().refresh(),
        completionsRefetchRef.current?.(),
        pendingRefetchRef.current?.(),
        badgesRefetchRef.current?.(),
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

  const handleSavedPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/saved" as const);
  }, [router]);

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
  }, [router]);

  return (
    <>
      <Screen
        isScrollable={false}
        bannerDescription="Your account and preferences"
        showBackButton
        onBack={handleBack}
        noAnimation
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
              {/* Discoverer Card */}
              <Animated.View
                entering={FadeIn.duration(duration.normal)}
                style={styles.section}
              >
                <DiscovererCard
                  userId={user?.id}
                  firstName={profileData?.firstName}
                  lastName={profileData?.lastName}
                  currentTier={getTierForXP(profileData?.totalXp || 0).name}
                  totalXp={profileData?.totalXp || 0}
                  currentStreak={profileData?.currentStreak || 0}
                  longestStreak={profileData?.longestStreak || 0}
                  memberSince={memberSince}
                />
              </Animated.View>

              {/* Adventure Score */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(80)}
                style={styles.inlineSection}
              >
                <AdventureScoreCard onRefetchRef={scoreRefetchRef} />
              </Animated.View>

              {/* Adventure Streak (visual calendar) */}
              {(profileData?.currentStreak ||
                profileData?.longestStreak ||
                (insights?.streakCalendar &&
                  insights.streakCalendar.length > 0)) && (
                <Animated.View
                  entering={FadeIn.duration(duration.normal).delay(160)}
                  style={styles.inlineSection}
                >
                  <StreakCalendar
                    data={insights?.streakCalendar ?? []}
                    currentStreak={profileData?.currentStreak ?? 0}
                    longestStreak={profileData?.longestStreak ?? 0}
                  />
                </Animated.View>
              )}

              {/* Badges */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(240)}
                style={styles.inlineSection}
              >
                <BadgeGrid onRefetchRef={badgesRefetchRef} />
              </Animated.View>

              {/* Activity Heatmap */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(320)}
                style={styles.inlineSection}
              >
                <ActivityHeatmap data={insights?.activityHeatmap ?? []} />
              </Animated.View>

              {/* Venue DNA */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(400)}
                style={styles.inlineSection}
              >
                <VenueDnaChart data={insights?.venueDna ?? []} />
              </Animated.View>

              {/* Adventure Footprint */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(480)}
                style={styles.inlineSection}
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

              {/* Active Quest Banner */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(560)}
                style={styles.inlineSection}
              >
                <ActiveQuestBanner />
              </Animated.View>

              {/* Pending Itineraries */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(600)}
                style={styles.inlineSection}
              >
                <PendingItineraries onRefetchRef={pendingRefetchRef} />
              </Animated.View>

              {/* Recent Completions (rate unrated) */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(680)}
                style={styles.inlineSection}
              >
                <RecentCompletions onRefetchRef={completionsRefetchRef} />
              </Animated.View>

              {/* Saved */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(720)}
                style={styles.inlineSection}
              >
                <Pressable
                  style={[styles.inlineAction, styles.inlineActionLast]}
                  onPress={handleSavedPress}
                >
                  <Text style={styles.inlineRowLabel}>Saved Events</Text>
                  <ChevronRight size={14} color={colors.text.secondary} />
                </Pressable>
              </Animated.View>

              {/* Stats */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(720)}
                style={styles.inlineSection}
              >
                <UserStatsCard stats={stats} isLoading={statsLoading} />
              </Animated.View>

              {/* Account */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(800)}
                style={styles.inlineSection}
              >
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
              </Animated.View>

              {/* Appearance */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(880)}
                style={styles.inlineSection}
              >
                <Text style={styles.sectionLabel}>APPEARANCE</Text>
                <View style={styles.inlineRow}>
                  <Text style={styles.inlineRowLabel}>Theme</Text>
                  <View style={styles.pillGroup}>
                    {THEME_OPTIONS.map(({ key, label }) => (
                      <Pressable
                        key={key}
                        style={[
                          styles.pill,
                          themeMode === key && styles.pillActive,
                        ]}
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
              </Animated.View>

              {/* Actions */}
              <Animated.View
                entering={FadeIn.duration(duration.normal).delay(960)}
                style={styles.inlineSection}
              >
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
                {__DEV__ && (
                  <Pressable
                    style={[styles.inlineAction, styles.inlineActionLast]}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      await resetOnboarding();
                      router.replace("/onboarding" as const);
                    }}
                  >
                    <Text style={styles.inlineRowLabel}>Replay Onboarding</Text>
                    <ChevronRight size={14} color={colors.text.secondary} />
                  </Pressable>
                )}
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
    section: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    // Inline sections
    inlineSection: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
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
  });

export default UserProfile;
