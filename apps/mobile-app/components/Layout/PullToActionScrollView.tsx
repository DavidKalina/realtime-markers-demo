import React, { useCallback } from "react";
import { StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { usePullToAction } from "@/hooks/usePullToAction";

interface PullToActionScrollViewProps {
  onSearch: () => void;
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
  children: React.ReactNode;
  showsVerticalScrollIndicator?: boolean;
  contentContainerStyle?: ViewStyle;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const PullToActionScrollView: React.FC<PullToActionScrollViewProps> = ({
  onSearch,
  onRefresh,
  isRefreshing = false,
  children,
  showsVerticalScrollIndicator = false,
  contentContainerStyle,
}) => {
  const { pullIndicator, scrollProps } = usePullToAction({
    onSearch,
    onRefresh,
    isRefreshing,
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
