// hooks/useAssistantAnimations.ts
import { useCallback, useRef } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  SharedValue,
} from "react-native-reanimated";
import { Animated as RNAnimated } from "react-native";

interface AnimationStyles {
  cardContainer: ReturnType<typeof useAnimatedStyle>;
  cardContent: ReturnType<typeof useAnimatedStyle>;
  actionBar: ReturnType<typeof useAnimatedStyle>;
  visibility: ReturnType<typeof useAnimatedStyle>;
  legacy: {
    transform: { translateY: SharedValue<number> }[];
    opacity: SharedValue<number>;
  };
}

interface AnimationControls {
  showAssistant: (duration?: number) => void;
  hideAssistant: (duration?: number) => void;
  showAndHideWithDelay: (delay?: number) => void;
  // Removed isVisible boolean that was causing issues
}

/**
 * Custom hook to manage all animations for the assistant
 * @returns Animation styles and control functions
 */
export const useAssistantAnimations = (): {
  styles: AnimationStyles;
  controls: AnimationControls;
} => {
  // Shared values for Reanimated animations
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(50);
  const cardHeight = useSharedValue(8);
  const isCardHidden = useSharedValue(true);

  // Legacy React Native Animated value for backward compatibility
  const legacyAnimation = useRef(new RNAnimated.Value(0)).current;

  // Animated styles for the card container
  const cardContainerStyle = useAnimatedStyle(() => {
    return {
      height: cardHeight.value,
      overflow: "hidden",
      // Ensure no border appears when height is animating
      borderTopWidth: 0,
      borderBottomWidth: 0,
      marginBottom: 0,
    };
  });

  // Animated styles for card contents
  const cardContentStyle = useAnimatedStyle(() => {
    return {
      opacity: cardOpacity.value,
      transform: [{ translateY: cardTranslateY.value }],
    };
  });

  // Animated styles for the action bar
  const actionBarStyle = useAnimatedStyle(() => {
    // This is fine because it's inside useAnimatedStyle
    return {
      borderTopLeftRadius: isCardHidden.value ? 16 : 0,
      borderTopRightRadius: isCardHidden.value ? 16 : 0,
      marginTop: isCardHidden.value ? 8 : 0,
      marginBottom: 0,
      borderTopWidth: isCardHidden.value ? 1 : 0,
    };
  });

  // Show the assistant with animations
  const showAssistant = useCallback(
    (duration: number = 300) => {
      // Mark card as visible for styling
      isCardHidden.value = false;

      // First animate height to create space
      cardHeight.value = withTiming(
        80,
        {
          duration,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
        () => {
          // Then animate content opacity and position
          cardOpacity.value = withSpring(1, {
            damping: 20,
            stiffness: 90,
          });
          cardTranslateY.value = withSpring(0, {
            damping: 20,
            stiffness: 90,
          });
        }
      );

      // Legacy animation for backward compatibility
      RNAnimated.spring(legacyAnimation, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }).start();
    },
    [cardHeight, cardOpacity, cardTranslateY, isCardHidden, legacyAnimation]
  );

  // Hide the assistant with animations
  const hideAssistant = useCallback(
    (duration: number = 300) => {
      // First fade out content
      cardOpacity.value = withTiming(0, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
      cardTranslateY.value = withTiming(
        20,
        {
          duration: 150,
          easing: Easing.out(Easing.ease),
        },
        () => {
          // Then collapse the height
          cardHeight.value = withTiming(
            8,
            {
              duration: 200,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            },
            () => {
              // Only mark as hidden after animation completes
              isCardHidden.value = true;
            }
          );
        }
      );

      // Legacy animation for backward compatibility
      RNAnimated.timing(legacyAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    },
    [cardHeight, cardOpacity, cardTranslateY, isCardHidden, legacyAnimation]
  );

  // Show and then hide the assistant after a delay
  const showAndHideWithDelay = useCallback(
    (delay: number = 5000) => {
      showAssistant();

      setTimeout(() => {
        hideAssistant();
      }, delay);
    },
    [hideAssistant, showAssistant]
  );

  // Create a derived value for visibility without accessing .value directly
  const visibilityStyle = useAnimatedStyle(() => {
    return {
      display: isCardHidden.value ? "none" : "flex",
    };
  });

  return {
    styles: {
      cardContainer: cardContainerStyle,
      cardContent: cardContentStyle,
      actionBar: actionBarStyle,
      visibility: visibilityStyle,
      legacy: {
        transform: [{ translateY: cardTranslateY }],
        opacity: cardOpacity,
      },
    },
    controls: {
      showAssistant,
      hideAssistant,
      showAndHideWithDelay,
      // Remove direct access to .value here
    },
  };
};
