import React, { useMemo } from "react";
import {
  SafeAreaView,
  StyleSheet,
  StatusBar,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

// Unified color theme
export const COLORS = {
  background: "#f8fafc", // Light, clean background
  cardBackground: "#ffffff", // Pure white for cards
  cardBackgroundAlt: "#f1f5f9", // Slightly off-white for alternate cards
  textPrimary: "#0f172a", // Deep blue-gray for primary text
  textSecondary: "#64748b", // Medium gray for secondary text
  accent: "#f59e0b", // Vibrant amber/orange
  accentDark: "#d97706", // Darker amber for hover states
  divider: "rgba(0, 0, 0, 0.08)", // Subtle divider
  buttonBackground: "rgba(0, 0, 0, 0.05)", // Light button background
  buttonBorder: "rgba(0, 0, 0, 0.1)", // Subtle button border
  shadow: "rgba(0, 0, 0, 0.1)", // Lighter shadow
  // Warning colors
  warningBackground: "rgba(251, 191, 36, 0.1)", // Bright yellow warning
  warningBorder: "rgba(251, 191, 36, 0.3)",
  warningText: "#d97706", // Warm orange warning text
  // Error colors
  errorBackground: "rgba(239, 68, 68, 0.1)", // Bright red error
  errorBorder: "rgba(239, 68, 68, 0.3)",
  errorText: "#dc2626", // Vibrant red error text
};

interface ScreenLayoutProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  noSafeArea?: boolean;
  noAnimation?: boolean;
  extendBannerToStatusBar?: boolean;
}

// Memoize the screen layout styles
const screenLayoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  statusBarBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44, // Approximate status bar height
    backgroundColor: "#e0f2fe", // Light blue municipal background to match StatusBar and Banner
    zIndex: 1,
  },
});

const ScreenLayout: React.FC<ScreenLayoutProps> = React.memo(
  ({
    children,
    style,
    contentStyle,
    noSafeArea = false,
    noAnimation = false,
    extendBannerToStatusBar = false,
  }) => {
    const Container = noSafeArea ? View : SafeAreaView;
    const Content = noAnimation ? View : Animated.View;

    // Memoize the container and content styles
    const containerStyle = useMemo(
      () => [screenLayoutStyles.container, style],
      [style],
    );

    const contentStyleMemo = useMemo(
      () => [screenLayoutStyles.content, contentStyle],
      [contentStyle],
    );

    return (
      <Container style={containerStyle}>
        <StatusBar
          barStyle={extendBannerToStatusBar ? "dark-content" : "light-content"}
          backgroundColor={
            extendBannerToStatusBar ? "#e0f2fe" : COLORS.background
          }
          translucent={extendBannerToStatusBar}
        />
        {extendBannerToStatusBar && (
          <View style={screenLayoutStyles.statusBarBackground} />
        )}
        <Content
          style={contentStyleMemo}
          entering={noAnimation ? undefined : FadeIn.duration(300)}
        >
          {children}
        </Content>
      </Container>
    );
  },
);

export default ScreenLayout;
