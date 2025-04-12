import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from './ScreenLayout';

interface HeaderProps {
    title: string;
    onBack?: () => void;
    rightIcon?: React.ReactNode;
    style?: ViewStyle;
    animated?: boolean;
}

const Header: React.FC<HeaderProps> = ({
    title,
    onBack,
    rightIcon,
    style,
    animated = true,
}) => {
    const HeaderComponent = animated ? Animated.View : View;

    return (
        <HeaderComponent
            style={[styles.header, style]}
            entering={animated ? FadeIn.duration(300) : undefined}
        >
            {onBack && (
                <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
                    <ArrowLeft size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
            )}

            <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
            </Text>

            {rightIcon ? (
                <View style={styles.rightIconContainer}>
                    {rightIcon}
                </View>
            ) : (
                <View style={styles.placeholderIcon} />
            )}
        </HeaderComponent>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        backgroundColor: COLORS.background,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.buttonBackground,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.buttonBorder,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: COLORS.textPrimary,
        fontFamily: "SpaceMono",
        flex: 1,
        letterSpacing: 0.5,
    },
    rightIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.buttonBackground,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.buttonBorder,
    },
    placeholderIcon: {
        width: 40,
        marginLeft: 12,
    },
});

export default Header; 