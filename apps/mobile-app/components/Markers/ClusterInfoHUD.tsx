import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  BounceIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useRouter } from "expo-router";
import { useLocationStore } from "@/stores/useLocationStore";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  shadows,
  spacing,
  type Colors,
} from "@/theme";

interface ClusterInfoHUDProps {
  safeAreaBottom: number;
}

export const ClusterInfoHUD: React.FC<ClusterInfoHUDProps> = React.memo(
  ({ safeAreaBottom }) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const selectedItem = useLocationStore((s) => s.selectedItem);

    const isCluster = selectedItem?.type === "cluster";
    const count = isCluster ? selectedItem.count : 0;
    const coordinates = isCluster ? selectedItem.coordinates : null;
    const childrenIds = isCluster ? selectedItem.childrenIds : undefined;

    const pressScale = useSharedValue(1);

    const navigate = useCallback(() => {
      if (!coordinates) return;
      const zoomLevel = useLocationStore.getState().zoomLevel;
      const ids = childrenIds?.join(",") || "";
      router.push(
        `cluster?lat=${coordinates[1]}&lng=${coordinates[0]}&zoom=${zoomLevel}&childrenIds=${ids}` as never,
      );
    }, [router, coordinates, childrenIds]);

    const handlePress = useCallback(() => {
      pressScale.value = withSequence(
        withTiming(0.96, { duration: 80 }),
        withTiming(1, { duration: 100 }, () => {
          scheduleOnRN(navigate);
        }),
      );
    }, [navigate]);

    const cardAnimStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pressScale.value }],
    }));

    if (!isCluster) return null;

    return (
      <Animated.View
        entering={BounceIn.duration(400)}
        exiting={FadeOut.duration(200)}
        style={[styles.wrapper, { bottom: safeAreaBottom + spacing.xs }]}
        key={selectedItem.id}
      >
        <Pressable onPress={handlePress}>
          <Animated.View style={[styles.card, cardAnimStyle]}>
            <View style={styles.headerRow}>
              <Text style={styles.emoji}>📍</Text>
              <View style={styles.titleClip}>
                <Text style={styles.title} numberOfLines={1}>
                  {count} events in this area
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Tap to scan</Text>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  },
);

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrapper: {
      position: "absolute",
      left: spacing.md,
      right: spacing.md,
      zIndex: 100,
    },
    card: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      ...shadows.lg,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    emoji: {
      fontSize: fontSize["2xl"],
      lineHeight: lineHeight.relaxed,
    },
    chevron: {
      color: colors.text.secondary,
      fontSize: fontSize.xl,
      lineHeight: lineHeight.relaxed,
      marginLeft: spacing.xs,
    },
    titleClip: {
      flex: 1,
      overflow: "hidden",
    },
    title: {
      color: colors.text.primary,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.snug,
    },
    badge: {
      backgroundColor: colors.bg.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.accent.border,
    },
    badgeText: {
      color: colors.accent.primary,
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
    },
  });
