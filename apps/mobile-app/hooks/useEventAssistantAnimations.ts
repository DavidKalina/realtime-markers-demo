// hooks/useAssistantAnimations.ts
import { useCallback, useRef, useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  SharedValue,
  cancelAnimation,
} from "react-native-reanimated";

interface AnimationStyles {
  cardContainer: ReturnType<typeof useAnimatedStyle>;
  cardContent: ReturnType<typeof useAnimatedStyle>;
  actionBar: ReturnType<typeof useAnimatedStyle>;
  visibility: ReturnType<typeof useAnimatedStyle>;
}

interface AnimationControls {
  showAssistant: (duration?: number) => void;
  hideAssistant: (duration?: number) => void;
  showAndHideWithDelay: (delay?: number) => void;
  quickTransition: () => void;
}

/**
 * Custom hook to manage all animations for the assistant
 * @returns Animation styles and control functions
 */
export const useAssistantAnimations = (): {
  styles: AnimationStyles;
  controls: AnimationControls;
} => {
  // Track mounted state
  const isMounted = useRef(true);

  // Shared values for Reanimated animations
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(50);
  const cardHeight = useSharedValue(8);
  const isCardHidden = useSharedValue(true);

  // Cleanup function for all animations
  const cleanupAnimations = useCallback(() => {
    if (!isMounted.current) return;

    // Cancel all Reanimated animations
    cancelAnimation(cardOpacity);
    cancelAnimation(cardTranslateY);
    cancelAnimation(cardHeight);
    cancelAnimation(isCardHidden);
  }, [cardOpacity, cardTranslateY, cardHeight, isCardHidden]);

  // Quick transition with cleanup
  const quickTransition = useCallback(() => {
    if (!isMounted.current) return;

    // Cancel any ongoing animations first
    cleanupAnimations();

    // Immediate hide/cleanup without animations
    isCardHidden.value = true;
    cardHeight.value = 8;
    cardOpacity.value = 0;
    cardTranslateY.value = 50;
  }, [
    cardHeight,
    cardOpacity,
    cardTranslateY,
    isCardHidden,
    cleanupAnimations,
  ]);

  // Show the assistant with animations and cleanup
  const showAssistant = useCallback(
    (duration: number = 200) => {
      if (!isMounted.current) return;

      // Cancel any ongoing animations first
      cleanupAnimations();

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
          if (!isMounted.current) return;

          // Then animate content opacity and position
          cardOpacity.value = withSpring(1, {
            damping: 20,
            stiffness: 90,
          });
          cardTranslateY.value = withSpring(0, {
            damping: 20,
            stiffness: 90,
          });
        },
      );
    },
    [cardHeight, cardOpacity, cardTranslateY, isCardHidden, cleanupAnimations],
  );

  // Hide the assistant with animations and cleanup
  const hideAssistant = useCallback(
    (duration: number = 150) => {
      if (!isMounted.current) return;

      // Cancel any ongoing animations first
      cleanupAnimations();

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
          if (!isMounted.current) return;

          // Then collapse the height
          cardHeight.value = withTiming(
            8,
            {
              duration: 200,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            },
            () => {
              if (!isMounted.current) return;
              // Only mark as hidden after animation completes
              isCardHidden.value = true;
            },
          );
        },
      );
    },
    [cardHeight, cardOpacity, cardTranslateY, isCardHidden, cleanupAnimations],
  );

  // Show and then hide the assistant after a delay with cleanup
  const showAndHideWithDelay = useCallback(
    (delay: number = 5000) => {
      if (!isMounted.current) return;

      showAssistant();

      const timer = setTimeout(() => {
        if (isMounted.current) {
          hideAssistant();
        }
      }, delay);

      return () => clearTimeout(timer);
    },
    [hideAssistant, showAssistant],
  );

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      cleanupAnimations();
    };
  }, [cleanupAnimations]);

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
    return {
      borderTopLeftRadius: isCardHidden.value ? 16 : 0,
      borderTopRightRadius: isCardHidden.value ? 16 : 0,
      marginTop: isCardHidden.value ? 8 : 0,
      marginBottom: 0,
      borderTopWidth: isCardHidden.value ? 1 : 0,
    };
  });

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
    },
    controls: {
      showAssistant,
      hideAssistant,
      showAndHideWithDelay,
      quickTransition,
    },
  };
};
