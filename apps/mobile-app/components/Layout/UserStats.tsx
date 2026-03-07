import React, { useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useColors, spacing, fontSize, fontWeight, fontFamily, type Colors } from "@/theme";
import Animated, { FadeInDown } from "react-native-reanimated";

export interface StatItem {
  value: string | number;
  label: string;
  badge?: string | number;
}

export interface UserStatsProps {
  items: StatItem[];
  style?: ViewStyle;
  animated?: boolean;
  delay?: number;
}

const StatItemComponent = React.memo<{
  item: StatItem;
  index: number;
  animated: boolean;
  delay: number;
}>(({ item, index, animated, delay }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const StatComponent = animated ? Animated.View : View;

  return (
    <StatComponent
      style={styles.statItem}
      entering={
        animated
          ? FadeInDown.duration(400)
              .delay(delay + index * 100)
              .springify()
          : undefined
      }
    >
      <View style={styles.statValueContainer}>
        <Text style={styles.statValue}>{item.value}</Text>
        {item.badge && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.statLabel}>{item.label}</Text>
    </StatComponent>
  );
});

const UserStats: React.FC<UserStatsProps> = ({
  items,
  style,
  animated = true,
  delay = 0,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, style]}>
      {items.map((item, index) => (
        <StatItemComponent
          key={item.label}
          item={item}
          index={index}
          animated={animated}
          delay={delay}
        />
      ))}
    </View>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    opacity: 0.9,
    letterSpacing: 0.2,
  },
  badgeContainer: {
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.sm,
    minWidth: spacing.lg,
    height: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    marginLeft: spacing._6,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  badgeText: {
    color: colors.bg.primary,
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
  },
});

export default UserStats;
