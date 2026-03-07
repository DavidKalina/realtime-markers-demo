import React from "react";
import { ViewStyle, StyleProp } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/theme";
import { duration } from "@/theme/tokens/animation";

interface ShimmerViewProps {
  style?: StyleProp<ViewStyle>;
}

const ShimmerView: React.FC<ShimmerViewProps> = React.memo(({ style }) => {
  const colors = useColors();
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: duration.slower }),
        withTiming(0.3, { duration: duration.slower }),
      ),
      -1,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: colors.bg.elevated,
  }));

  return <Animated.View style={[style, animatedStyle]} />;
});

ShimmerView.displayName = "ShimmerView";

export default ShimmerView;
