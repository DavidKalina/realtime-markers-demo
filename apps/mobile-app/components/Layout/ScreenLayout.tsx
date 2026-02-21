import React, { useMemo } from "react";
import {
  SafeAreaView,
  StyleSheet,
  StatusBar,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors } from "@/theme";

// Backward-compatible bridge to new theme tokens.
// All 55+ files import COLORS from here; this mapping keeps them working
// while we migrate each file to import from @/theme directly.
export const COLORS = {
  background: colors.bg.primary,
  cardBackground: colors.bg.card,
  cardBackgroundAlt: colors.bg.cardAlt,
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  accent: colors.accent.primary,
  accentDark: colors.accent.dark,
  divider: colors.border.default,
  buttonBackground: colors.border.subtle,
  buttonBorder: colors.border.medium,
  shadow: colors.shadow.default,
  // Warning colors
  warningBackground: colors.status.warning.bg,
  warningBorder: colors.status.warning.border,
  warningText: colors.status.warning.text,
  // Error colors
  errorBackground: colors.status.error.bg,
  errorBorder: colors.status.error.border,
  errorText: colors.status.error.text,
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
