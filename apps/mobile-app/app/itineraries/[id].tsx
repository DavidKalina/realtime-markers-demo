import ItineraryMapPreview from "@/components/Itinerary/ItineraryMapPreview";
import ItineraryTimeline from "@/components/Itinerary/ItineraryTimeline";
import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import Screen from "@/components/Layout/Screen";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  type DimensionValue,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { apiClient } from "@/services/ApiClient";
import {
  type BaseEvent,
  eventBroker,
  EventTypes,
} from "@/services/EventBroker";
import type {
  ItineraryItemResponse,
  ItineraryResponse,
} from "@/services/api/modules/itineraries";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

// --- Animated counter (reused for hero stats) ---

const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  color: string;
  style?: object;
}> = ({ value, prefix = "", suffix = "", delay = 0, color, style }) => {
  const animated = useSharedValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withDelay(
      delay,
      withTiming(value, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
  }, [value, delay]);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (current) => {
      scheduleOnRN(setDisplayed, current);
    },
  );

  return (
    <Text style={[{ color }, style]}>
      {prefix}
      {displayed}
      {suffix}
    </Text>
  );
};

// Compute temp range scoped to the itinerary's actual hours
function scopedForecast(
  forecast: ItineraryResponse["forecast"],
  items: ItineraryItemResponse[],
): { low: number; high: number; condition: string } | null {
  if (!forecast?.hourly?.length || !items.length) return null;
  const startHour = Math.min(
    ...items.map((i) => parseInt(i.startTime.split(":")[0], 10)),
  );
  const endHour = Math.max(
    ...items.map((i) => parseInt(i.endTime.split(":")[0], 10)),
  );
  const relevant = forecast.hourly.filter(
    (h) => h.hour >= startHour && h.hour <= endHour,
  );
  if (!relevant.length) return null;
  return {
    low: Math.round(Math.min(...relevant.map((h) => h.tempF))),
    high: Math.round(Math.max(...relevant.map((h) => h.tempF))),
    condition: forecast.dominantCondition,
  };
}

// --- Skeleton pulse bar ---

const SkeletonBar: React.FC<{
  width: DimensionValue;
  height: number;
  colors: Colors;
  rounded?: boolean;
}> = React.memo(({ width, height, colors, rounded }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      Math.random() * 400,
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
    );
    const interval = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      );
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: rounded ? height / 2 : radius.sm,
          backgroundColor: colors.bg.elevated,
        },
        animStyle,
      ]}
    />
  );
});

SkeletonBar.displayName = "SkeletonBar";

type ItineraryCheckinEvent = BaseEvent & {
  itineraryId: string;
  itemId: string;
  completed: boolean;
};

// --- Skeleton stop reel row ---

const STOP_TITLES = [
  "Finding a caf\u{E9}\u2026",
  "Scouting a park\u2026",
  "Checking galleries\u2026",
  "Mapping restaurants\u2026",
  "Locating a bar\u2026",
  "Searching trails\u2026",
  "Browsing markets\u2026",
  "Pinning a museum\u2026",
];

const SkeletonStopReel: React.FC<{
  index: number;
  isLast: boolean;
  colors: Colors;
}> = React.memo(({ index, isLast, colors }) => {
  const s = useMemo(() => createStyles(colors), [colors]);
  const reelTranslateY = useSharedValue(0);
  const [titleIdx, setTitleIdx] = useState(index % STOP_TITLES.length);
  const titleOpacity = useSharedValue(1);

  const reelEmojis = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < 3; i++) items.push(...GEN_EMOJIS);
    return items;
  }, []);

  // Spin emoji reel — staggered per row
  useEffect(() => {
    const interval = 2200 + index * 250;
    const delay = index * 300;
    const spin = () => {
      const landIdx =
        2 * GEN_EMOJIS.length + Math.floor(Math.random() * GEN_EMOJIS.length);
      reelTranslateY.value = 0;
      reelTranslateY.value = withTiming(-landIdx * 28, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });
    };
    const startTimer = setTimeout(() => {
      spin();
      const id = setInterval(spin, interval);
      return () => clearInterval(id);
    }, delay);
    const id = setInterval(
      () => {
        reelTranslateY.value = 0;
        const landIdx =
          2 * GEN_EMOJIS.length + Math.floor(Math.random() * GEN_EMOJIS.length);
        reelTranslateY.value = withTiming(-landIdx * 28, {
          duration: 1200,
          easing: Easing.out(Easing.cubic),
        });
      },
      2200 + index * 250,
    );
    return () => {
      clearTimeout(startTimer);
      clearInterval(id);
    };
  }, [index]);

  // Rotate title text — staggered
  useEffect(() => {
    const interval = 2600 + index * 200;
    const delay = index * 350;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      intervalId = setInterval(() => {
        titleOpacity.value = withSequence(
          withTiming(0, { duration: 250 }),
          withTiming(1, { duration: 250 }),
        );
        setTimeout(() => {
          setTitleIdx((i) => (i + 1) % STOP_TITLES.length);
        }, 250);
      }, interval);
    }, delay);
    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [index]);

  const reelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reelTranslateY.value }],
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  return (
    <View style={s.skeletonStop}>
      <View style={s.skeletonStopLeft}>
        <SkeletonBar width={36} height={12} colors={colors} />
        <View style={s.skeletonDot} />
        {!isLast && (
          <View
            style={[s.skeletonLine, { backgroundColor: colors.border.default }]}
          />
        )}
      </View>
      <View style={s.skeletonStopContent}>
        <View style={{ width: 28, height: 28, overflow: "hidden" }}>
          <Animated.View style={reelStyle}>
            {reelEmojis.map((emoji, i) => (
              <Text
                key={i}
                style={{
                  height: 28,
                  lineHeight: 28,
                  fontSize: 20,
                  textAlign: "center",
                }}
              >
                {emoji}
              </Text>
            ))}
          </Animated.View>
        </View>
        <View style={{ flex: 1, gap: 4, justifyContent: "center" }}>
          <Animated.Text
            style={[
              {
                fontSize: fontSize.sm,
                fontFamily: fontFamily.mono,
                color: colors.text.secondary,
              },
              titleAnimStyle,
            ]}
            numberOfLines={1}
          >
            {STOP_TITLES[titleIdx]}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
});

SkeletonStopReel.displayName = "SkeletonStopReel";

// --- Skeleton stops container (animates count) ---

const STOP_PATTERNS = [3, 4, 5, 4, 6, 5, 3, 5, 4];

const SkeletonStops: React.FC<{ colors: Colors }> = React.memo(({ colors }) => {
  const [stopCount, setStopCount] = useState(3);
  const patternIdx = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      patternIdx.current = (patternIdx.current + 1) % STOP_PATTERNS.length;
      setStopCount(STOP_PATTERNS[patternIdx.current]);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <View>
      {Array.from({ length: stopCount }, (_, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.duration(300).delay(i * 60)}
          exiting={FadeOut.duration(200)}
        >
          <SkeletonStopReel
            index={i}
            isLast={i === stopCount - 1}
            colors={colors}
          />
        </Animated.View>
      ))}
    </View>
  );
});

SkeletonStops.displayName = "SkeletonStops";

// --- Generating state constants ---

const GEN_EMOJIS = [
  "\u{1F5FA}\u{FE0F}",
  "\u{1F3AF}",
  "\u{1F3AA}",
  "\u{1F3AD}",
  "\u{1F3A8}",
  "\u{1F3B5}",
  "\u{1F37D}\u{FE0F}",
  "\u{2615}",
  "\u{1F3DE}\u{FE0F}",
  "\u{1F6B6}",
  "\u{1F3D5}\u{FE0F}",
  "\u{1F30A}",
  "\u{1F3DB}\u{FE0F}",
  "\u{1F3A4}",
  "\u{1F9D7}",
  "\u{1F366}",
  "\u{1F6B2}",
  "\u{1F3B6}",
];

const GEN_MESSAGES = [
  "Scanning local events\u2026",
  "Searching verified venues\u2026",
  "Scouting nearby trails\u2026",
  "Pulling weather forecast\u2026",
  "Building the route\u2026",
  "Optimizing stop order\u2026",
  "Finalizing your plan\u2026",
];

const SKELETON_TITLES = [
  "Sunset District Crawl",
  "Hidden Gem Day Trip",
  "Culture & Coffee Walk",
  "Neighborhood Explorer",
  "Urban Adventure Loop",
  "Local Flavor Tour",
];

const SKELETON_SUMMARIES = [
  "A mix of outdoor spots and cozy indoor finds",
  "Hitting the best-rated places near you",
  "Balancing chill vibes with hidden discoveries",
  "An afternoon of art, food, and fresh air",
  "From morning coffee to evening cocktails",
  "Exploring off-the-beaten-path favorites",
];

const REEL_H = 28;
const REEL_SPINS = 2;

const GeneratingEmojiReel: React.FC = React.memo(() => {
  const translateY = useSharedValue(0);

  const reelEmojis = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < REEL_SPINS + 1; i++) items.push(...GEN_EMOJIS);
    return items;
  }, []);

  const spin = useCallback(() => {
    const landIdx =
      REEL_SPINS * GEN_EMOJIS.length +
      Math.floor(Math.random() * GEN_EMOJIS.length);
    translateY.value = 0;
    translateY.value = withTiming(-landIdx * REEL_H, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  useEffect(() => {
    spin();
    const timer = setInterval(spin, 2800);
    return () => clearInterval(timer);
  }, [spin]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ height: REEL_H, overflow: "hidden" }}>
      <Animated.View style={animStyle}>
        {reelEmojis.map((emoji, i) => (
          <Text
            key={i}
            style={{
              height: REEL_H,
              lineHeight: REEL_H,
              fontSize: 22,
              textAlign: "center",
            }}
          >
            {emoji}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
});

GeneratingEmojiReel.displayName = "GeneratingEmojiReel";

// --- Hero stat pill ---

const STAT_COLORS = ["#93c5fd", "#86efac", "#fcd34d", "#c4b5fd", "#f9a8d4"];

const ItineraryDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active itinerary store
  const activeItinerary = useActiveItineraryStore((s) => s.itinerary);
  const activateItinerary = useActiveItineraryStore((s) => s.activate);
  const deactivateItinerary = useActiveItineraryStore((s) => s.deactivate);
  const markCheckedIn = useActiveItineraryStore((s) => s.markCheckedIn);
  const isActivating = useActiveItineraryStore((s) => s.isLoading);

  const isThisActive = activeItinerary?.id === id;

  // Use active store's items if this itinerary is active (has live checkin data)
  const displayItinerary =
    isThisActive && activeItinerary ? activeItinerary : itinerary;

  // Generating state
  const [genMsgIdx, setGenMsgIdx] = useState(0);
  const [skelTitleIdx, setSkelTitleIdx] = useState(0);
  const [skelSummaryIdx, setSkelSummaryIdx] = useState(0);
  const genTextOpacity = useSharedValue(1);
  const skelHeroOpacity = useSharedValue(1);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id || id === "undefined") return;
    apiClient.itineraries
      .getById(id)
      .then((data) => {
        setItinerary(data);
        // If still generating, start polling
        if (data.status === "GENERATING") {
          pollRef.current = setInterval(async () => {
            try {
              const updated = await apiClient.itineraries.getById(id);
              if (updated.status !== "GENERATING") {
                setItinerary(updated);
                if (pollRef.current) clearInterval(pollRef.current);
                // Clear the generating row in the itineraries list
                const jobStore = useItineraryJobStore.getState();
                if (jobStore.activeItineraryId === id) {
                  jobStore.completeJob();
                }
              }
            } catch {
              // ignore transient fetch errors during polling
            }
          }, 3000);
        }
      })
      .catch((err) => {
        console.error("[ItineraryDetail] Failed to fetch:", err);
        setError("Failed to load itinerary");
      })
      .finally(() => setIsLoading(false));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  // Rotate generating messages
  useEffect(() => {
    if (itinerary?.status !== "GENERATING") return;
    const timer = setInterval(() => {
      genTextOpacity.value = withSequence(
        withTiming(0, { duration: 250 }),
        withTiming(1, { duration: 250 }),
      );
      setTimeout(() => {
        setGenMsgIdx((i) => (i + 1) % GEN_MESSAGES.length);
      }, 250);
    }, 2800);
    return () => clearInterval(timer);
  }, [itinerary?.status]);

  const genTextAnimStyle = useAnimatedStyle(() => ({
    opacity: genTextOpacity.value,
  }));

  // Rotate skeleton hero title/summary
  useEffect(() => {
    if (itinerary?.status !== "GENERATING") return;
    const timer = setInterval(() => {
      skelHeroOpacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 300 }),
      );
      setTimeout(() => {
        setSkelTitleIdx((i) => (i + 1) % SKELETON_TITLES.length);
        setSkelSummaryIdx((i) => (i + 1) % SKELETON_SUMMARIES.length);
      }, 300);
    }, 3400);
    return () => clearInterval(timer);
  }, [itinerary?.status]);

  const skelHeroAnimStyle = useAnimatedStyle(() => ({
    opacity: skelHeroOpacity.value,
  }));

  // Listen for check-in events from push notifications
  useEffect(() => {
    const handler = (data: ItineraryCheckinEvent) => {
      if (data.itineraryId === id) {
        markCheckedIn(data.itemId, new Date().toISOString());
        Haptics.notificationAsync(
          data.completed
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }
    };

    const unsub = eventBroker.on<ItineraryCheckinEvent>(
      EventTypes.ITINERARY_CHECKIN,
      handler,
    );
    return unsub;
  }, [id, markCheckedIn]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
  }, [router]);

  const handleRefresh = useCallback(async () => {
    if (!id) return;
    const data = await apiClient.itineraries.getById(id);
    setItinerary(data);
  }, [id]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    Alert.alert("Delete itinerary?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await apiClient.itineraries.deleteById(id);
            router.back();
          } catch (err) {
            console.error("[ItineraryDetail] Failed to delete:", err);
          }
        },
      },
    ]);
  }, [id, router]);

  const handleShare = useCallback(async () => {
    if (!id || !itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { shareToken } = await apiClient.itineraries.share(id);
      const webUrl =
        process.env.EXPO_PUBLIC_WEB_URL || "https://dashboard.mapmoji.app";
      const shareUrl = `${webUrl}/i/${shareToken}`;

      await Share.share({
        message: shareUrl,
        url: shareUrl,
      });
    } catch (err) {
      console.error("[ItineraryDetail] Failed to share:", err);
    }
  }, [id, itinerary]);

  const handleActivate = useCallback(async () => {
    if (!itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await activateItinerary(itinerary);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [itinerary, activateItinerary]);

  const handleDeactivate = useCallback(() => {
    Alert.alert("End itinerary?", "You can restart it later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await deactivateItinerary();
        },
      },
    ]);
  }, [deactivateItinerary]);

  const handleManualCheckin = useCallback(
    async (itemId: string) => {
      if (!id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const result = await apiClient.itineraries.checkin(id, itemId);
        if (result.success && result.checkedInAt) {
          markCheckedIn(itemId, result.checkedInAt);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        console.error("[ItineraryDetail] Manual checkin failed:", err);
      }
    },
    [id, markCheckedIn],
  );

  const handleNavigate = useCallback(() => {
    if (!itinerary) return;

    const sortedItems = (itinerary.items ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((item) => item.venueAddress || item.venueName || item.title);

    if (sortedItems.length === 0) return;

    const stopLabel = (item: (typeof sortedItems)[0]) => {
      // Prefer entry point coords (trailhead/parking) for navigation
      if (item.entryLatitude && item.entryLongitude) {
        return `${item.entryLatitude},${item.entryLongitude}`;
      }
      if (item.latitude && item.longitude) {
        return `${item.latitude},${item.longitude}`;
      }
      return item.venueAddress || item.venueName || item.title;
    };

    const stopLabels = sortedItems.map((item) => stopLabel(item));

    const openGoogleMapsRoute = () => {
      const path = stopLabels.map(encodeURIComponent).join("/");
      Linking.openURL(`https://www.google.com/maps/dir/${path}`);
    };

    const openAppleMapsStop = (index: number) => {
      const label = stopLabels[index];
      Linking.openURL(
        `https://maps.apple.com/?daddr=${encodeURIComponent(label)}&dirflg=d`,
      );
    };

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            "Cancel",
            `Full Route (${stopLabels.length} stops)`,
            ...sortedItems.map(
              (item) =>
                `${item.emoji || "\u{1F4CD}"} ${item.title}${item.entryPointName ? ` → ${item.entryPointName}` : ""}`,
            ),
          ],
          cancelButtonIndex: 0,
          title: "Navigate",
          message:
            "Full route opens in Google Maps. Individual stops open in Apple Maps.",
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openGoogleMapsRoute();
          else if (buttonIndex > 1) openAppleMapsStop(buttonIndex - 2);
        },
      );
    } else {
      openGoogleMapsRoute();
    }
  }, [itinerary]);

  // Item detail modal
  const [selectedItem, setSelectedItem] =
    useState<ItineraryItemResponse | null>(null);

  const handleItemPress = useCallback((item: ItineraryItemResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
  }, []);
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  // --- Loading / Error states ---

  if (isLoading) {
    return (
      <Screen
        isScrollable={false}
        showBackButton
        onBack={handleBack}
        noAnimation
      >
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      </Screen>
    );
  }

  if (itinerary?.status === "GENERATING") {
    return (
      <Screen
        isScrollable={false}
        showBackButton
        onBack={handleBack}
        noAnimation
      >
        <ScrollView
          contentContainerStyle={styles.scrollPadding}
          showsVerticalScrollIndicator={false}
        >
          {/* Skeleton hero */}
          <View style={styles.hero}>
            {itinerary.title ? (
              <Text style={styles.heroTitle}>{itinerary.title}</Text>
            ) : (
              <Animated.Text
                style={[
                  styles.heroTitle,
                  { color: colors.text.secondary },
                  skelHeroAnimStyle,
                ]}
                numberOfLines={1}
              >
                {SKELETON_TITLES[skelTitleIdx]}
              </Animated.Text>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <SkeletonBar width={72} height={16} colors={colors} />
              <SkeletonBar width={90} height={16} colors={colors} />
            </View>
            <Animated.Text
              style={[
                styles.heroSummary,
                { color: colors.text.disabled },
                skelHeroAnimStyle,
              ]}
              numberOfLines={1}
            >
              {SKELETON_SUMMARIES[skelSummaryIdx]}
            </Animated.Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <SkeletonBar width={80} height={24} colors={colors} rounded />
              <SkeletonBar width={64} height={24} colors={colors} rounded />
              <SkeletonBar width={56} height={24} colors={colors} rounded />
            </View>
          </View>

          {/* Skeleton map */}
          <View style={{ marginTop: spacing.lg }}>
            <SkeletonBar width="100%" height={160} colors={colors} />
          </View>

          {/* Status row */}
          <View style={styles.skeletonStatusRow}>
            <GeneratingEmojiReel />
            <View style={{ flex: 1, gap: 2 }}>
              <Animated.Text
                style={[styles.skeletonStatusTitle, genTextAnimStyle]}
                numberOfLines={1}
              >
                {GEN_MESSAGES[genMsgIdx]}
              </Animated.Text>
              <Text style={styles.skeletonStatusSub}>
                {itinerary.city
                  ? `Crafting your ${itinerary.city} adventure`
                  : "Crafting your adventure"}
              </Text>
            </View>
          </View>

          {/* Skeleton timeline stops — roulette reels that shuffle in/out */}
          <SkeletonStops colors={colors} />
        </ScrollView>
      </Screen>
    );
  }

  if (error || !itinerary) {
    return (
      <Screen
        isScrollable={false}
        showBackButton
        onBack={handleBack}
        noAnimation
      >
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Not found"}</Text>
        </View>
      </Screen>
    );
  }

  // --- Computed values ---

  const items = displayItinerary?.items ?? [];
  const totalCost = items.reduce(
    (sum, i) => sum + (Number(i.estimatedCost) || 0),
    0,
  );
  const sortedForStats = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const firstTime =
    sortedForStats.length > 0 ? formatTime(sortedForStats[0].startTime) : null;
  const lastTime =
    sortedForStats.length > 0
      ? formatTime(sortedForStats[sortedForStats.length - 1].endTime)
      : null;

  // Check-in progress
  const checkedInCount = items.filter((i) => i.checkedInAt).length;
  const totalStops = items.length;
  const progressPct = totalStops > 0 ? checkedInCount / totalStops : 0;

  return (
    <Screen isScrollable={false} showBackButton onBack={handleBack} noAnimation>
      <PullToActionScrollView
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.scrollPadding}
      >
        {/* ── Hero Section ── */}
        <Animated.View
          entering={FadeIn.duration(500).easing(Easing.out(Easing.cubic))}
          style={styles.hero}
        >
          {/* Title block */}
          <Animated.View
            entering={FadeInDown.delay(100)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
          >
            <Text style={styles.heroTitle}>{itinerary.title}</Text>
            <View style={styles.heroLabelRow}>
              <View style={styles.heroLabelPill}>
                <Text style={styles.heroLabelText}>ITINERARY</Text>
              </View>
              <Text style={styles.heroDot}> · </Text>
              <Text style={styles.heroDate}>
                {formatDate(itinerary.plannedDate)}
              </Text>
            </View>
          </Animated.View>

          {/* Summary */}
          {itinerary.summary && (
            <Animated.View
              entering={FadeInDown.delay(200)
                .duration(450)
                .easing(Easing.out(Easing.cubic))}
            >
              <Text style={styles.heroSummary}>{itinerary.summary}</Text>
            </Animated.View>
          )}

          {/* Stat chips — compact horizontal row */}
          <Animated.View
            entering={FadeInDown.delay(300)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
            style={styles.chipRow}
          >
            {firstTime && lastTime && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: "rgba(147, 197, 253, 0.25)" },
                ]}
              >
                <Text style={[styles.statChipValue, { color: STAT_COLORS[0] }]}>
                  {firstTime} – {lastTime}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.statChip,
                { borderColor: "rgba(134, 239, 172, 0.25)" },
              ]}
            >
              <AnimatedNumber
                value={items.length}
                suffix=" stops"
                delay={400}
                color={STAT_COLORS[1]}
                style={styles.statChipValue}
              />
            </View>
            {totalCost > 0 && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: "rgba(196, 181, 253, 0.25)" },
                ]}
              >
                <AnimatedNumber
                  value={totalCost}
                  prefix="~$"
                  delay={500}
                  color={STAT_COLORS[3]}
                  style={styles.statChipValue}
                />
              </View>
            )}
            {displayItinerary?.forecast &&
              (() => {
                const scoped = scopedForecast(
                  displayItinerary.forecast,
                  displayItinerary.items,
                );
                const low = scoped?.low ?? displayItinerary.forecast.tempLowF;
                const high =
                  scoped?.high ?? displayItinerary.forecast.tempHighF;
                const condition =
                  scoped?.condition ??
                  displayItinerary.forecast.dominantCondition;
                return low === high ? (
                  <View
                    style={[
                      styles.statChip,
                      { borderColor: "rgba(253, 186, 116, 0.25)" },
                    ]}
                  >
                    <Text
                      style={[styles.statChipValue, { color: STAT_COLORS[4] }]}
                    >
                      {high}°F {condition}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View
                      style={[
                        styles.statChip,
                        { borderColor: "rgba(253, 186, 116, 0.25)" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statChipValue,
                          { color: STAT_COLORS[4] },
                        ]}
                      >
                        {low}–{high}°F
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statChip,
                        { borderColor: "rgba(253, 186, 116, 0.25)" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statChipValue,
                          { color: STAT_COLORS[4] },
                        ]}
                      >
                        {condition}
                      </Text>
                    </View>
                  </>
                );
              })()}
          </Animated.View>

          {/* Vibe tags */}
          <Animated.View
            entering={FadeInDown.delay(400)
              .duration(400)
              .easing(Easing.out(Easing.cubic))}
            style={styles.vibeRow}
          >
            {(itinerary.activityTypes ?? []).map((vibe, i) => (
              <Animated.View
                key={vibe}
                entering={FadeInRight.delay(450 + i * 60).duration(350)}
                style={styles.vibePill}
              >
                <Text style={styles.vibeText}>{vibe}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        </Animated.View>

        {/* ── Divider ── */}
        <Animated.View
          entering={FadeIn.delay(500).duration(400)}
          style={styles.divider}
        />

        {/* ── Check-in progress bar ── */}
        {isThisActive && totalStops > 0 && (
          <Animated.View
            entering={FadeInDown.delay(500)
              .duration(400)
              .easing(Easing.out(Easing.cubic))}
            style={styles.progressSection}
          >
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>PROGRESS</Text>
              <Text style={styles.progressCount}>
                {checkedInCount}/{totalStops} stops
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.round(progressPct * 100)}%` },
                ]}
              />
            </View>
          </Animated.View>
        )}

        {/* ── Timeline ── */}
        <ItineraryTimeline
          items={items}
          forecast={displayItinerary?.forecast}
          isActive={isThisActive}
          onCheckin={isThisActive ? handleManualCheckin : undefined}
          onItemPress={handleItemPress}
        />

        {/* ── Map Preview ── */}
        <Animated.View
          entering={FadeInDown.delay(700)
            .duration(450)
            .easing(Easing.out(Easing.cubic))}
          style={styles.mapPreviewSection}
        >
          <Text style={styles.mapPreviewLabel}>ROUTE MAP</Text>
          <ItineraryMapPreview items={items} city={itinerary.city} />
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View
          entering={FadeInDown.delay(600)
            .duration(400)
            .easing(Easing.out(Easing.cubic))}
          style={styles.actions}
        >
          {isThisActive ? (
            <>
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.navigateButton,
                    styles.rowButton,
                    pressed && styles.navigateButtonPressed,
                  ]}
                  onPress={handleNavigate}
                >
                  <Text style={styles.navigateButtonText}>Navigate</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.endButton,
                    styles.rowButton,
                    pressed && styles.endButtonPressed,
                  ]}
                  onPress={handleDeactivate}
                >
                  <Text style={styles.endButtonText}>End</Text>
                </Pressable>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.shareButtonPressed,
                ]}
                onPress={handleShare}
              >
                <Text style={styles.shareButtonText}>Share</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.startButton,
                    styles.rowButton,
                    pressed && styles.startButtonPressed,
                    isActivating && styles.startButtonDisabled,
                  ]}
                  onPress={handleActivate}
                  disabled={isActivating}
                >
                  <Text style={styles.startButtonText}>
                    {isActivating ? "Activating..." : "Start"}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.shareButton,
                    styles.rowButton,
                    pressed && styles.shareButtonPressed,
                  ]}
                  onPress={handleShare}
                >
                  <Text style={styles.shareButtonText}>Share</Text>
                </Pressable>
              </View>
              <Pressable style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </PullToActionScrollView>

      {/* Item detail modal */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedItem(null)}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.modalBackdropFill}
          />
          {selectedItem && (
            <Animated.View
              entering={FadeInDown.duration(250).easing(
                Easing.out(Easing.cubic),
              )}
              style={styles.itemDetailCard}
            >
              <Pressable>
                {/* Green accent bar */}
                <View style={styles.itemDetailAccent} />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: spacing.lg }}
                >
                  {/* Header */}
                  <View style={styles.itemDetailHeader}>
                    <View style={styles.itemDetailEmojiCircle}>
                      <Text style={styles.itemDetailEmoji}>
                        {selectedItem.emoji || "\u{1F4CD}"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemDetailTitle}>
                        {selectedItem.title}
                      </Text>
                      <Text style={styles.itemDetailTime}>
                        {formatTime(selectedItem.startTime)} –{" "}
                        {formatTime(selectedItem.endTime)}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  {selectedItem.description && (
                    <Text style={styles.itemDetailDesc}>
                      {selectedItem.description}
                    </Text>
                  )}

                  {/* Why this stop */}
                  {selectedItem.whyThisStop && (
                    <View style={styles.itemDetailSection}>
                      <Text style={styles.itemDetailSectionLabel}>
                        WHY THIS STOP
                      </Text>
                      <Text style={styles.itemDetailSectionText}>
                        {selectedItem.whyThisStop}
                      </Text>
                    </View>
                  )}

                  {/* Pro tip */}
                  {selectedItem.proTip && (
                    <View style={styles.itemDetailProTip}>
                      <Text style={styles.itemDetailProTipLabel}>PRO TIP</Text>
                      <Text style={styles.itemDetailProTipText}>
                        {selectedItem.proTip}
                      </Text>
                    </View>
                  )}

                  {/* Venue info */}
                  {(selectedItem.venueName || selectedItem.venueAddress) && (
                    <View style={styles.itemDetailSection}>
                      <Text style={styles.itemDetailSectionLabel}>VENUE</Text>
                      {selectedItem.venueName && (
                        <Text style={styles.itemDetailVenueName}>
                          {selectedItem.venueName}
                        </Text>
                      )}
                      {selectedItem.venueAddress && (
                        <Text style={styles.itemDetailSectionText}>
                          {selectedItem.venueAddress}
                        </Text>
                      )}
                      {selectedItem.venueCategory && (
                        <Text style={styles.itemDetailMeta}>
                          {selectedItem.venueCategory}
                        </Text>
                      )}
                      {selectedItem.googleRating != null && (
                        <Text style={styles.itemDetailMeta}>
                          {"\u2B50"} {selectedItem.googleRating} on Google
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Cost + travel chips */}
                  <View style={styles.itemDetailChipRow}>
                    {Number(selectedItem.estimatedCost) > 0 && (
                      <View style={styles.itemDetailChipGreen}>
                        <Text style={styles.itemDetailChipGreenText}>
                          ~${Number(selectedItem.estimatedCost)}
                        </Text>
                      </View>
                    )}
                    {selectedItem.travelNote && (
                      <View style={styles.itemDetailChip}>
                        <Text style={styles.itemDetailChipText}>
                          {selectedItem.travelNote}
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </Screen>
  );
};

export default ItineraryDetailScreen;

function formatTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    scrollPadding: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl * 3,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl * 3,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Skeleton generating state */
    skeletonStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing._10,
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.default,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    skeletonStatusTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    skeletonStatusSub: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    skeletonStop: {
      flexDirection: "row",
      paddingTop: spacing.md,
      minHeight: 64,
    },
    skeletonStopLeft: {
      width: 44,
      alignItems: "center",
      gap: spacing.xs,
    },
    skeletonDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border.default,
    },
    skeletonLine: {
      width: 1,
      flex: 1,
      minHeight: 24,
    },
    skeletonStopContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },

    errorText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.status.error.text,
    },

    // ── Hero ──
    hero: {
      gap: spacing.md,
      paddingTop: spacing.xs,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 28,
    },
    heroLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 2,
    },
    heroLabelPill: {
      backgroundColor: "rgba(134, 239, 172, 0.1)",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    heroLabelText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: "#86efac",
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    heroDot: {
      fontSize: 11,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
    },
    heroDate: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    heroSummary: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 20,
    },

    // ── Stat chips ──
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statChip: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statChipValue: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },

    // ── Vibe tags ──
    vibeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      flex: 1,
    },
    vibePill: {
      backgroundColor: "rgba(249, 168, 212, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(249, 168, 212, 0.2)",
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    vibeText: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: "#f9a8d4",
      textTransform: "lowercase",
      letterSpacing: 0.5,
    },

    // ── Divider ──
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.lg,
    },

    // ── Progress ──
    progressSection: {
      marginTop: spacing.md,
      gap: 6,
    },
    mapPreviewSection: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    mapPreviewLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      letterSpacing: 1,
    },
    progressLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      letterSpacing: 1,
    },
    progressCount: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#22c55e",
    },
    progressBarBg: {
      height: 4,
      backgroundColor: colors.bg.elevated,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: 4,
      backgroundColor: "#22c55e",
      borderRadius: 2,
    },

    // ── Actions ──
    actions: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    rowButton: {
      flex: 1,
    },
    startButton: {
      backgroundColor: "rgba(134, 239, 172, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    startButtonPressed: {
      backgroundColor: "rgba(134, 239, 172, 0.2)",
    },
    startButtonDisabled: {
      opacity: 0.5,
    },
    startButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#86efac",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    navigateButton: {
      backgroundColor: "rgba(134, 239, 172, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    navigateButtonPressed: {
      backgroundColor: "rgba(134, 239, 172, 0.2)",
    },
    navigateButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#86efac",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    endButton: {
      borderWidth: 1,
      borderColor: "rgba(252, 165, 165, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    endButtonPressed: {
      backgroundColor: "rgba(252, 165, 165, 0.08)",
    },
    endButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#fca5a5",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    shareButton: {
      backgroundColor: "rgba(147, 197, 253, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(147, 197, 253, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    shareButtonPressed: {
      backgroundColor: "rgba(147, 197, 253, 0.2)",
    },
    shareButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#93c5fd",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    deleteButton: {
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    deleteButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: "#fca5a5",
      fontWeight: fontWeight.semibold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },

    // ── Modal shared styles ──
    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    modalBackdropFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay.light,
    },

    // ── Item detail modal ──
    itemDetailCard: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      padding: spacing["2xl"],
      width: "90%",
      maxWidth: 380,
      maxHeight: "80%",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.2)",
      shadowColor: colors.fixed.black,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
    itemDetailAccent: {
      height: 3,
      borderRadius: 2,
      width: 32,
      marginBottom: spacing.md,
      backgroundColor: "#86efac",
    },
    itemDetailHeader: {
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "center",
      marginBottom: spacing.md,
    },
    itemDetailEmojiCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(134, 239, 172, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    itemDetailEmoji: {
      fontSize: 22,
    },
    itemDetailTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 22,
    },
    itemDetailTime: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: "#86efac",
      marginTop: 2,
    },
    itemDetailDesc: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    itemDetailSection: {
      marginBottom: spacing.md,
      gap: 4,
    },
    itemDetailSectionLabel: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "#86efac",
      letterSpacing: 1.5,
      marginBottom: 2,
    },
    itemDetailSectionText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.primary,
      lineHeight: 20,
    },
    itemDetailProTip: {
      marginBottom: spacing.md,
      gap: 4,
      backgroundColor: "rgba(134, 239, 172, 0.06)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.15)",
      borderRadius: radius.md,
      padding: spacing.md,
    },
    itemDetailProTipLabel: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "#86efac",
      letterSpacing: 1.5,
    },
    itemDetailProTipText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.primary,
      lineHeight: 20,
    },
    itemDetailVenueName: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    itemDetailMeta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.detail,
      marginTop: 2,
    },
    itemDetailChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: spacing.xs,
    },
    itemDetailChipGreen: {
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.3)",
      backgroundColor: "rgba(134, 239, 172, 0.08)",
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    itemDetailChipGreenText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#86efac",
    },
    itemDetailChip: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    itemDetailChipText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
  });
