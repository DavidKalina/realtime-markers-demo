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
    <View style={styles.tabContent}>
      <Icon
        size={20}
        color={isActive ? COLORS.accent : COLORS.textSecondary}
        style={styles.tabIcon}
      />
      <Text style={[styles.tabText, isActive && styles.activeTabText]}>
        {label}
      </Text>
    </View>
    {isActive && <View style={styles.underline} />}
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
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    // No background color needed for underlined style
  },
  underline: {
    position: "absolute",
    bottom: -1, // Align with the bottom border
    left: "15%",
    right: "15%",
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Poppins-Regular",
    fontWeight: "500",
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: "600",
  },
});

export default Tabs;
