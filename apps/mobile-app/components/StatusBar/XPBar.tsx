import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/ApiClient";
import {
  eventBroker,
  EventTypes,
  LevelUpdateEvent,
  XPAwardedEvent,
} from "@/services/EventBroker";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useXPGainAnimation } from "./useXPGainAnimation";
import { COLORS } from "../Layout/ScreenLayout";

interface XPBarProps {
  backgroundColor?: string;
}

interface LevelInfo {
  currentLevel: number;
  currentTitle: string;
  totalXp: number;
  nextLevelXp: number;
  progress: number;
}

const XPBar: React.FC<XPBarProps> = React.memo(
  ({ backgroundColor = COLORS.textPrimary }) => {
    const { user } = useAuth();
    const [levelInfo, setLevelInfo] = React.useState<LevelInfo>({
      currentLevel: 1,
      currentTitle: "Explorer",
      totalXp: 0,
      nextLevelXp: 100,
      progress: 0,
    });

    // Shared values for animations
    const progressValue = useSharedValue(0);
    const totalXpValue = useSharedValue(0);
    const nextLevelXpValue = useSharedValue(100);

    // Use the XP gain animation hook
    const { xpGainOpacity, xpGainTranslateY, xpGainAmount, showXPGain } =
      useXPGainAnimation();

    // Add a ref to track the debounce timeout
    const debounceTimeoutRef = useRef<NodeJS.Timeout>();

    // Memoize the progress bar style
    const progressStyle = useAnimatedStyle(() => {
      const progress = Math.min(Math.max(progressValue.value, 0), 100);
      return {
        width: `${progress}%`,
        height: "100%",
        backgroundColor: COLORS.accent,
        borderRadius: 1.5,
      };
    }, []);

    // Memoize the XP gain style
    const xpGainStyle = useAnimatedStyle(
      () => ({
        opacity: xpGainOpacity.value,
        transform: [{ translateY: xpGainTranslateY.value }],
      }),
      [],
    );

    const AnimatedXPGainText = useMemo(
      () => Animated.createAnimatedComponent(Text),
      [],
    );

    // Memoize the fetch function
    const fetchLatestXPData = useCallback(async () => {
      try {
        const user = await apiClient.auth.getUserProfile();

        const newLevelInfo = {
          currentLevel: user.level || 1,
          currentTitle: user.currentTitle || "Explorer",
          totalXp: user.totalXp || 0,
          nextLevelXp: user.nextLevelXp || 100,
          progress: user.xpProgress || 0,
        };

        // Update state and animation values
        setLevelInfo(newLevelInfo);

        // Ensure progress is between 0 and 100
        const clampedProgress = Math.min(
          Math.max(newLevelInfo.progress, 0),
          100,
        );

        // Animate the progress change
        progressValue.value = withTiming(clampedProgress, {
          duration: 500,
        });

        totalXpValue.value = newLevelInfo.totalXp;
        nextLevelXpValue.value = newLevelInfo.nextLevelXp;
      } catch (error) {
        console.error("Error fetching level info:", error);
      }
    }, []);

    // Create a debounced version of fetchLatestXPData
    const debouncedFetchLatestXPData = useCallback(() => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        fetchLatestXPData();
      }, 1000); // Wait 1 second before making the API call
    }, [fetchLatestXPData]);

    // Fetch initial level info
    useEffect(() => {
      fetchLatestXPData();
    }, [fetchLatestXPData]);

    // Memoize event handlers
    const handleLevelUpdate = useCallback(
      async (event: LevelUpdateEvent) => {
        if (event.data.userId === user?.id) {
          await fetchLatestXPData();
        }
      },
      [user?.id, fetchLatestXPData],
    );

    const handleXPAwarded = useCallback(
      async (event: XPAwardedEvent) => {
        if (event.data.userId === user?.id) {
          showXPGain(event.data.amount);
          debouncedFetchLatestXPData();
        }
      },
      [user?.id, debouncedFetchLatestXPData, showXPGain],
    );

    // Subscribe to level updates and XP awards
    useEffect(() => {
      const levelUnsubscribe = eventBroker.on<LevelUpdateEvent>(
        EventTypes.LEVEL_UPDATE,
        handleLevelUpdate,
      );
      const xpUnsubscribe = eventBroker.on<XPAwardedEvent>(
        EventTypes.XP_AWARDED,
        handleXPAwarded,
      );

      return () => {
        levelUnsubscribe();
        xpUnsubscribe();
      };
    }, [handleLevelUpdate, handleXPAwarded]);

    // Clean up the timeout on unmount
    useEffect(() => {
      return () => {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
      };
    }, []);

    // Memoize the container style
    const containerStyle = useMemo(
      () => [styles.container, { backgroundColor }],
      [backgroundColor],
    );

    return (
      <View style={containerStyle}>
        <View style={styles.levelInfo}>
          <View style={styles.levelTitleContainer}>
            <Text style={styles.levelText}>Lv. {levelInfo.currentLevel}</Text>
            <Text style={styles.titleText}>{levelInfo.currentTitle}</Text>
          </View>
          <AnimatedXPGainText style={[styles.xpGainText, xpGainStyle]}>
            +{xpGainAmount} XP
          </AnimatedXPGainText>
        </View>
        <View style={styles.progressContainer}>
          <Animated.View style={progressStyle} />
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.backgroundColor === nextProps.backgroundColor;
  },
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingVertical: 4,
  },

  levelInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    justifyContent: "space-between",
  },
  levelTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  levelText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "SpaceMono",
    marginRight: 6,
    fontWeight: "600",
  },
  titleText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "SpaceMono",
  },
  xpGainText: {
    color: "#22c55e",
    fontSize: 11,
    fontFamily: "SpaceMono",
    fontWeight: "bold",
  },
  progressContainer: {
    height: 3,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 1.5,
    overflow: "hidden",
    marginBottom: 2,
  },
  progressBar: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 1.5,
  },
  xpInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  xpText: {
    color: "#64748b",
    fontSize: 10,
    fontFamily: "SpaceMono",
  },
  nextLevelText: {
    color: "#94a3b8",
    fontSize: 10,
    fontFamily: "SpaceMono",
  },
});

export default XPBar;
