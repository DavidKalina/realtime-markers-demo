import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { COLORS } from './ScreenLayout';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    animated?: boolean;
    delay?: number;
    noBorder?: boolean;
    noShadow?: boolean;
}

const Card: React.FC<CardProps> = ({
    children,
    style,
    animated = true,
    delay = 0,
    noBorder = false,
    noShadow = false,
}) => {
    const CardComponent = animated ? Animated.View : View;

    return (
        <CardComponent
            style={[
                styles.card,
                !noBorder && styles.border,
                !noShadow && styles.shadow,
                style,
            ]}
            entering={animated ? FadeInDown.duration(600).delay(delay).springify() : undefined}
            layout={animated ? LinearTransition.springify() : undefined}
        >
            {children}
        </CardComponent>
    );
};

const styles = StyleSheet.create({
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
        shadowColor: "rgba(0, 0, 0, 0.5)",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
});

export default Card; 