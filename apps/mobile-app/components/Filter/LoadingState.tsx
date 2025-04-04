import React from "react";
import { ActivityIndicator, Text } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { styles } from "./styles";

export const LoadingState = React.memo(() => {
  return (
    <Animated.View
      style={styles.loadingContainer}
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition.springify()}
    >
      <ActivityIndicator size="large" color="#93c5fd" />
      <Text style={styles.loadingText}>Loading filters...</Text>
    </Animated.View>
  );
});
