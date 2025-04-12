import React from 'react';
import { StyleSheet, View, ViewStyle, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { COLORS } from './ScreenLayout';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    animated?: boolean;
    delay?: number;
    noBorder?: boolean;
    noShadow?: boolean;
    onPress?: () => void;
}

// Memoize the card styles
const cardStyles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: 20,
        padding: 16,
        marginVertical: 8,
    },
    border: {
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    shadow: {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
});

const Card: React.FC<CardProps> = React.memo(({
    children,
    style,
    animated = true,
    delay = 0,
    noBorder = false,
    noShadow = false,
    onPress,
}) => {
    const CardComponent = animated ? Animated.View : View;
    const Container = onPress ? TouchableOpacity : View;

    // Memoize the card style
    const cardStyle = React.useMemo(() => [
        cardStyles.card,
        !noBorder && cardStyles.border,
        !noShadow && cardStyles.shadow,
        style,
    ], [noBorder, noShadow, style]);

    return (
        <Container onPress={onPress} activeOpacity={0.8}>
            <CardComponent
                style={cardStyle}
                entering={animated ? FadeInDown.duration(600).delay(delay).springify() : undefined}
                layout={animated ? LinearTransition.springify() : undefined}
            >
                {children}
            </CardComponent>
        </Container>
    );
});

export default Card; 