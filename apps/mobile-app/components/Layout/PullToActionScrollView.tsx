import React from "react";
import { StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from "react-native";
import Animated, { type SharedValue } from "react-native-reanimated";
import { usePullToAction } from "@/hooks/usePullToAction";

interface PullToActionScrollViewProps {
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
  children: React.ReactNode;
  showsVerticalScrollIndicator?: boolean;
  contentContainerStyle?: ViewStyle;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Optional shared value to receive scroll offset for parallax effects */
  scrollY?: SharedValue<number>;
}

const PullToActionScrollView: React.FC<PullToActionScrollViewProps> = ({
  onRefresh,
  isRefreshing = false,
  children,
  showsVerticalScrollIndicator = false,
  contentContainerStyle,
  scrollY: externalScrollY,
}) => {
  const { pullIndicator, scrollProps } = usePullToAction({
    onRefresh,
    isRefreshing,
    externalScrollY,
  });

  return (
    <Animated.ScrollView
      {...scrollProps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      style={styles.flex}
      contentContainerStyle={contentContainerStyle}
    >
      {pullIndicator}
      {children}
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

export default PullToActionScrollView;
