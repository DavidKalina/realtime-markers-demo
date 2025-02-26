import React, { useEffect } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

const SearchSkeleton = () => {
  // Animation value for the shimmer effect
  const shimmerAnim = new Animated.Value(0);

  useEffect(() => {
    // Create the shimmer animation
    const startAnimation = () => {
      shimmerAnim.setValue(0);
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => startAnimation());
    };

    startAnimation();
  }, []);

  // Calculate the interpolated position for the shimmer gradient
  const shimmerPosition = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  // Create a single skeleton card
  const SkeletonCard = () => (
    <View style={styles.card}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.shimmer,
          {
            transform: [{ translateX: shimmerPosition }],
          },
        ]}
      />

      <View style={styles.cardRow}>
        <View style={styles.emojiPlaceholder} />
        <View style={styles.datePlaceholder} />
      </View>

      <View style={styles.titlePlaceholder} />
      <View style={styles.titlePlaceholderShort} />

      <View style={styles.bottomRow}>
        <View style={styles.categoryPlaceholder} />
        <View style={styles.categoryPlaceholder} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Create multiple skeleton cards */}
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#333",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },
  shimmer: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    opacity: 0.3,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  emojiPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#444",
  },
  datePlaceholder: {
    width: 100,
    height: 16,
    borderRadius: 4,
    backgroundColor: "#444",
  },
  titlePlaceholder: {
    width: "90%",
    height: 20,
    borderRadius: 4,
    backgroundColor: "#444",
    marginBottom: 8,
  },
  titlePlaceholderShort: {
    width: "65%",
    height: 20,
    borderRadius: 4,
    backgroundColor: "#444",
    marginBottom: 16,
  },
  bottomRow: {
    flexDirection: "row",
    gap: 8,
  },
  categoryPlaceholder: {
    width: 80,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#444",
  },
});

export default SearchSkeleton;
