import React, { useEffect, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useColors, type Colors, spacing } from "@/theme";

export const COLLAPSED_HEIGHT = 70;
export const EXPANDED_HEIGHT = 420;
export const GREEN_ACCENT = "#86efac";

export const STOP_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
  "#f9a8d4",
  "#fdba74",
  "#67e8f9",
];

interface ExpandableCardProps {
  expanded: boolean;
  onToggleExpand: () => void;
  collapsedContent: React.ReactNode;
  expandedContent: React.ReactNode;
  /** Rendered between collapsed content and expanded area (e.g. dot indicators) */
  afterCollapsed?: React.ReactNode;
  /** Rendered as an overlay at the bottom of the card (e.g. progress bar) */
  bottomOverlay?: React.ReactNode;
  style?: ViewStyle;
  onLayout?: (e: LayoutChangeEvent) => void;
}

const ExpandableCard: React.FC<ExpandableCardProps> = ({
  expanded,
  onToggleExpand,
  collapsedContent,
  expandedContent,
  afterCollapsed,
  bottomOverlay,
  style,
  onLayout,
}) => {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const animHeight = useSharedValue(COLLAPSED_HEIGHT);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (expanded) {
      animHeight.value = withTiming(EXPANDED_HEIGHT, { duration: 300 });
      contentOpacity.value = withTiming(1, { duration: 200 });
    } else {
      contentOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(COLLAPSED_HEIGHT, { duration: 250 });
    }
  }, [expanded]);

  const containerAnim = useAnimatedStyle(() => ({
    height: animHeight.value,
  }));

  const expandedAnim = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleExpand();
  };

  return (
    <Animated.View
      style={[s.bubble, containerAnim, style]}
      onLayout={onLayout}
    >
      <View style={s.handleRow}>
        <View style={s.handle} />
      </View>

      <Pressable style={s.contentRow} onPress={handleToggle}>
        {collapsedContent}
      </Pressable>

      {afterCollapsed}

      <Animated.View style={[s.expandedContent, expandedAnim]}>
        {expandedContent}
      </Animated.View>

      {bottomOverlay}
    </Animated.View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bubble: {
      backgroundColor: colors.bg.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 1,
      borderColor: colors.border.subtle,
      paddingTop: 4,
      marginBottom: -spacing.lg,
      overflow: "hidden",
    },
    handleRow: {
      alignItems: "center",
      paddingBottom: 6,
    },
    handle: {
      width: 32,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border.medium,
    },
    contentRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingBottom: 10,
      gap: spacing.sm,
    },
    expandedContent: {
      flex: 1,
      paddingHorizontal: spacing.md,
    },
  });

export default ExpandableCard;
