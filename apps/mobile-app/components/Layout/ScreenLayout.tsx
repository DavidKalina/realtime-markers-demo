import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, View, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

// Unified color theme
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
    warningBackground: "rgba(253, 186, 116, 0.1)",
    warningBorder: "rgba(253, 186, 116, 0.3)",
    warningText: "#fdba74",
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
});

const ScreenLayout: React.FC<ScreenLayoutProps> = React.memo(({
    children,
    style,
    contentStyle,
    noSafeArea = false,
    noAnimation = false,
}) => {
    const Container = noSafeArea ? View : SafeAreaView;
    const Content = noAnimation ? View : Animated.View;

    // Memoize the container and content styles
    const containerStyle = useMemo(() => [
        screenLayoutStyles.container,
        style,
    ], [style]);

    const contentStyleMemo = useMemo(() => [
        screenLayoutStyles.content,
        contentStyle,
    ], [contentStyle]);

    return (
        <Container style={containerStyle}>
            <StatusBar barStyle="light-content" backgroundColor="#333" />
            <Content
                style={contentStyleMemo}
                entering={noAnimation ? undefined : FadeIn.duration(300)}
            >
                {children}
            </Content>
        </Container>
    );
});

export default ScreenLayout; 