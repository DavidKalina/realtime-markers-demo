import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { COLORS } from "./ScreenLayout";
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

const StatItem = React.memo<{
  item: StatItem;
  index: number;
  animated: boolean;
  delay: number;
}>(({ item, index, animated, delay }) => {
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
  return (
    <View style={[styles.container, style]}>
      {items.map((item, index) => (
        <StatItem
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

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 12,
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    opacity: 0.9,
    letterSpacing: 0.2,
  },
  badgeContainer: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
});

export default UserStats;
