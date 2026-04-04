import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RefreshCw } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  type Colors,
} from "@/theme";

const REFRESH_THRESHOLD = 120;

interface UsePullToActionOptions {
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
}

export function usePullToAction({
  onRefresh,
  isRefreshing = false,
}: UsePullToActionOptions) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const refreshIndicatorStyle = useAnimatedStyle(() => {
    const pull = -scrollY.value;
    return {
      opacity: interpolate(
        pull,
        [REFRESH_THRESHOLD - 10, REFRESH_THRESHOLD],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      if (offsetY <= -REFRESH_THRESHOLD) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onRefresh();
      }
    },
    [onRefresh],
  );

  const pullIndicator = (
    <>
      <View style={styles.pullArea}>
        <Animated.View style={[styles.pullIconRow, refreshIndicatorStyle]}>
          <RefreshCw size={18} color={colors.accent.primary} />
          <Text style={styles.pullRefreshText}>Refresh</Text>
        </Animated.View>
      </View>
      {isRefreshing && (
        <View style={styles.refreshingRow}>
          <ActivityIndicator size="small" color={colors.accent.primary} />
        </View>
      )}
    </>
  );

  return {
    pullIndicator,
    scrollProps: {
      onScroll: scrollHandler,
      scrollEventThrottle: 16 as const,
      onScrollEndDrag: handleScrollEndDrag,
    },
  };
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    pullArea: {
      height: REFRESH_THRESHOLD,
      marginTop: -REFRESH_THRESHOLD,
      justifyContent: "flex-end",
      alignItems: "center",
      paddingBottom: spacing.lg,
    },
    pullIconRow: {
      position: "absolute",
      bottom: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    pullRefreshText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.accent.primary,
    },
    refreshingRow: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },
  });
