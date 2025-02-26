import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

export const HapticTab = (props: BottomTabBarButtonProps) => {
  const { accessibilityLabel, accessibilityState, children, href, onPress, style } = props;

  const focused = accessibilityState?.selected;

  // Use animated styles for smooth transitions
  const animatedTabStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withTiming(focused ? 1.08 : 1, {
            duration: 200,
          }),
        },
      ],
      opacity: withTiming(focused ? 1 : 0.9, {
        duration: 200,
      }),
    };
  });

  const handlePress = (event: any) => {
    // Trigger haptic feedback when tab is pressed
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Call the original onPress handler
    if (onPress) {
      onPress(event);
    }
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onPress={handlePress}
      style={({ pressed }) => [
        {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.tabContainer, animatedTabStyle]}>
        {children}

        {/* Active indicator dot */}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingVertical: 4,
  },
  activeDot: {
    position: "absolute",
    bottom: -6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#37D05C",
  },
});
