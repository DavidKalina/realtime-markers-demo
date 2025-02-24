import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export const usePopupAnimation = () => {
  const popupOpacity = useSharedValue(1);
  const popupTranslateY = useSharedValue(10);

  const bobbingAnimation = useSharedValue(0);

  useEffect(() => {
    bobbingAnimation.value = withRepeat(
      withSequence(withTiming(-5, { duration: 2000 }), withTiming(5, { duration: 2000 })),
      -1,
      true
    );
  }, []);

  const bobbingStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: bobbingAnimation.value }],
    };
  });

  const popupStyle = useAnimatedStyle(() => {
    return {
      opacity: popupOpacity.value,
      transform: [{ translateY: popupTranslateY.value }],
    };
  });

  const showPopup = () => {
    popupOpacity.value = withTiming(1, { duration: 300 });
    popupTranslateY.value = withTiming(0, { duration: 300 });
  };

  const hidePopup = () => {
    popupOpacity.value = withTiming(0, { duration: 300 });
    popupTranslateY.value = withTiming(10, { duration: 300 });
  };

  return { bobbingStyle, popupStyle, showPopup, hidePopup };
};
