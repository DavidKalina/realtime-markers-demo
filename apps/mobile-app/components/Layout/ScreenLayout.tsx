import React, { useMemo } from "react";
import {
  SafeAreaView,
  StyleSheet,
  StatusBar,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

// Updated color scheme to match register/login screens
const newColors = {
  background: "#00697A",
  text: "#FFFFFF",
  accent: "#FDB813",
  cardBackground: "#FFFFFF",
  cardText: "#000000",
  cardTextSecondary: "#6c757d",
  buttonBackground: "#FFFFFF",
  buttonText: "#00697A",
  buttonBorder: "#DDDDDD",
  inputBackground: "#F5F5F5",
  errorBackground: "#FFCDD2",
  errorText: "#FFFFFF",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
  activityIndicator: "#00697A",
};

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
  errorBackground: "rgba(239, 68, 68, 1)", // Bright red error
  errorBorder: "rgba(239, 68, 68, 0.3)",
  errorText: "#FFFFFF", // Vibrant red error text
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
    backgroundColor: newColors.background, // Updated to teal background to match other components
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
          barStyle={extendBannerToStatusBar ? "light-content" : "light-content"} // Updated to light-content for teal background
          backgroundColor={
            extendBannerToStatusBar ? newColors.background : COLORS.background // Updated to use teal background
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
