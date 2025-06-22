import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { COLORS } from "../Layout/ScreenLayout";
import { useUserLocation } from "@/contexts/LocationContext";

const ANIMATION_CONFIG = {
  damping: 15,
  stiffness: 300,
};

const PlusButton: React.FC = () => {
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    // Cancel any ongoing animations before starting new ones
    cancelAnimation(scale);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.92, ANIMATION_CONFIG);

    // Navigate to create civic engagement with user's current coordinates
    if (userLocation) {
      const [longitude, latitude] = userLocation;
      router.push({
        pathname: "/create-civic-engagement",
        params: {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        },
      });
    } else {
      // If no user location, navigate without coordinates
      router.push("/create-civic-engagement");
    }
  }, [router, userLocation]);

  // Reset scale after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      scale.value = withSpring(1, ANIMATION_CONFIG);
    }, 100);

    return () => clearTimeout(timer);
  }, [scale]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(scale);
    };
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <Plus size={20} color={COLORS.accent} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 44,
    minHeight: 44,
  },
});

export default React.memo(PlusButton);
