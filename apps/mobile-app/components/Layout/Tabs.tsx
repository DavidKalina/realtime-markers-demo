import React, { memo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";
import { COLORS } from "./ScreenLayout";

export interface TabItem<T extends string> {
  icon: React.ElementType;
  label: string;
  value: T;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  activeTab: T;
  onTabPress: (tab: T) => void;
  style?: ViewStyle;
  animated?: boolean;
  delay?: number;
}

const TabButton = memo<{
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onPress: () => void;
}>(({ icon: Icon, label, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, isActive && styles.activeTab]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Icon
      size={16}
      color={isActive ? COLORS.accent : COLORS.textSecondary}
      style={styles.tabIcon}
    />
    <Text style={[styles.tabText, isActive && styles.activeTabText]}>
      {label}
    </Text>
  </TouchableOpacity>
));

function Tabs<T extends string>({
  items,
  activeTab,
  onTabPress,
  style,
  animated = true,
  delay = 0,
}: TabsProps<T>) {
  const TabsComponent = animated ? Animated.View : View;

  return (
    <TabsComponent
      style={[styles.tabsContainer, style]}
      entering={
        animated ? FadeInDown.duration(600).delay(delay).springify() : undefined
      }
      layout={animated ? LinearTransition.springify() : undefined}
    >
      {items.map((item) => (
        <TabButton
          key={item.value}
          icon={item.icon}
          label={item.label}
          isActive={activeTab === item.value}
          onPress={() => onTabPress(item.value)}
        />
      ))}
    </TabsComponent>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginVertical: 20,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowColor: "rgba(0, 0, 0, 0.05)",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 2,
    flexDirection: "row",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: "700",
  },
});

export default Tabs;
