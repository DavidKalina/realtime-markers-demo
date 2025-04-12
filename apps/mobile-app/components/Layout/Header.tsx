import React, { useMemo } from 'react';
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

// Memoize the header styles
const headerStyles = StyleSheet.create({
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

// Memoize the back button component
const BackButton = React.memo(({ onBack }: { onBack: () => void }) => (
    <TouchableOpacity style={headerStyles.backButton} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={22} color={COLORS.textPrimary} />
    </TouchableOpacity>
));

// Memoize the right icon component
const RightIcon = React.memo(({ icon }: { icon?: React.ReactNode }) => (
    icon ? (
        <View style={headerStyles.rightIconContainer}>
            {icon}
        </View>
    ) : (
        <View style={headerStyles.placeholderIcon} />
    )
));

const Header: React.FC<HeaderProps> = React.memo(({
    title,
    onBack,
    rightIcon,
    style,
    animated = true,
}) => {
    const HeaderComponent = animated ? Animated.View : View;

    // Memoize the header style
    const headerStyle = useMemo(() => [
        headerStyles.header,
        style,
    ], [style]);

    return (
        <HeaderComponent
            style={headerStyle}
            entering={animated ? FadeIn.duration(300) : undefined}
        >
            {onBack && <BackButton onBack={onBack} />}
            <Text style={headerStyles.headerTitle} numberOfLines={1}>
                {title}
            </Text>
            <RightIcon icon={rightIcon} />
        </HeaderComponent>
    );
});

export default Header; 