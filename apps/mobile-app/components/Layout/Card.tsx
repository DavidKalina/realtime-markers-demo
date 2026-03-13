import React from "react";
import { StyleSheet, View, ViewStyle, TouchableOpacity } from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";
import { useColors, spacing, radius, type Colors } from "@/theme";

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
const createCardStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg.card,
      borderRadius: radius["2xl"],
      padding: spacing.lg,
      marginVertical: spacing.sm,
    },
    border: {
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    shadow: {
      shadowColor: colors.shadow.default,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
  });

const Card: React.FC<CardProps> = React.memo(
  ({
    children,
    style,
    animated = true,
    delay = 0,
    noBorder = false,
    noShadow = false,
    onPress,
  }) => {
    const colors = useColors();
    const cardStyles = React.useMemo(() => createCardStyles(colors), [colors]);
    const CardComponent = animated ? Animated.View : View;
    const Container = onPress ? TouchableOpacity : View;

    // Memoize the card style
    const cardStyle = React.useMemo(
      () => [
        cardStyles.card,
        !noBorder && cardStyles.border,
        !noShadow && cardStyles.shadow,
        style,
      ],
      [noBorder, noShadow, style],
    );

    return (
      <Container onPress={onPress} activeOpacity={0.8}>
        <CardComponent
          style={cardStyle}
          entering={
            animated
              ? FadeInDown.duration(600).delay(delay).springify()
              : undefined
          }
          layout={animated ? LinearTransition.springify() : undefined}
        >
          {children}
        </CardComponent>
      </Container>
    );
  },
);

export default Card;
