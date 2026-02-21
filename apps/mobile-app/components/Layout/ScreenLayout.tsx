import React, { useMemo } from "react";
import {
  SafeAreaView,
  StyleSheet,
  StatusBar,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

// Peak dark theme colors
export const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  cardBackgroundAlt: "#232323",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  accentDark: "#3b82f6",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
  shadow: "rgba(0, 0, 0, 0.5)",
  // Warning colors
  warningBackground: "rgba(251, 191, 36, 0.1)",
  warningBorder: "rgba(251, 191, 36, 0.3)",
  warningText: "#d97706",
  // Error colors
  errorBackground: "rgba(248, 113, 113, 0.1)",
  errorBorder: "rgba(248, 113, 113, 0.3)",
  errorText: "#f87171",
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
    backgroundColor: "#333",
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
          barStyle="light-content"
          backgroundColor={COLORS.background}
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
