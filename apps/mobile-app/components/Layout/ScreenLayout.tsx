import React from 'react';
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
};

interface ScreenLayoutProps {
    children: React.ReactNode;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
    noSafeArea?: boolean;
    noAnimation?: boolean;
}

const ScreenLayout: React.FC<ScreenLayoutProps> = ({
    children,
    style,
    contentStyle,
    noSafeArea = false,
    noAnimation = false,
}) => {
    const Container = noSafeArea ? View : SafeAreaView;
    const Content = noAnimation ? View : Animated.View;

    return (
        <Container style={[styles.container, style]}>
            <StatusBar barStyle="light-content" backgroundColor="#333" />
            <Content
                style={[styles.content, contentStyle]}
                entering={noAnimation ? undefined : FadeIn.duration(300)}
            >
                {children}
            </Content>
        </Container>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
    },
});

export default ScreenLayout; 