// QuestMarker.tsx
import useBreathing from "@/hooks/usBreathing";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

interface AnimatedMapMarkerProps {
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
}

const AnimatedMapMarker: React.FC<AnimatedMapMarkerProps> = ({ emoji, isSelected, onPress }) => {
  const { animatedStyle } = useBreathing();

  return (
    <View>
      <Animated.View entering={ZoomIn.duration(300)} exiting={ZoomOut.duration(300)}>
        <Animated.View style={[styles.container, isSelected ? animatedStyle : undefined]}>
          <Pressable style={[styles.marker, { backgroundColor: "#333" }]} onPress={onPress}>
            <Text style={styles.markerIcon}>{emoji}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  popupMenuWrapper: {
    position: "absolute",
    bottom: 100,
    width: 300,
    alignSelf: "center",
  },
  marker: {
    position: "absolute",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 100,
    backgroundColor: "#333",
    width: 40,
    height: 40,
    padding: 8,
  },
  markerIcon: {
    fontSize: 16,
    color: "#fff",
  },
});

export default AnimatedMapMarker;
