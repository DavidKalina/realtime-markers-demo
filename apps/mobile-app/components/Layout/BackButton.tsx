import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface BackButtonProps {
  onPress: () => void;
}

export default function BackButton({ onPress }: BackButtonProps) {
  const backButtonScale = useSharedValue(1);
  const backButtonRotation = useSharedValue(0);

  const handlePress = () => {
    backButtonScale.value = withSequence(
      withSpring(0.9, { damping: 10 }),
      withSpring(1, { damping: 10 }),
    );
    backButtonRotation.value = withSequence(
      withTiming(-0.1, { duration: 100, easing: Easing.ease }),
      withTiming(0.1, { duration: 100, easing: Easing.ease }),
      withTiming(0, { duration: 100, easing: Easing.ease }),
    );
    onPress();
  };

  const backButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: backButtonScale.value },
      { rotate: `${backButtonRotation.value}rad` },
    ],
  }));

  return (
    <Animated.View style={[styles.bannerBackButton, backButtonAnimatedStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        style={styles.backButtonTouchable}
        activeOpacity={0.7}
      >
        <ArrowLeft size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerBackButton: {
    position: "absolute",
    left: 16,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonTouchable: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});
