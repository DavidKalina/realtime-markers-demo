import React from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

const ANIMATION_CONFIG = {
  damping: 10,
  stiffness: 200,
};

const FilterIndicator: React.FC = () => {
  const router = useRouter();
  const scale = useSharedValue(1);

  const handlePress = () => {
    cancelAnimation(scale);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(withSpring(0.95, ANIMATION_CONFIG), withSpring(1, ANIMATION_CONFIG));
    router.push("/filter");
  };

  React.useEffect(() => {
    return () => {
      cancelAnimation(scale);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔍</Text>
        </View>
        <Text style={styles.text}>Filter</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(236, 72, 153, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 11,
  },
  text: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: "#EC4899",
    letterSpacing: 0.2,
  },
});

export default React.memo(FilterIndicator);
