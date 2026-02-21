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
    backgroundColor: colors.bg.primary,
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
    backgroundColor: colors.bg.card,
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
          backgroundColor={colors.bg.primary}
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
