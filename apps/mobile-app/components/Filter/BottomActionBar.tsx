import React from "react";
import { Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { X } from "lucide-react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { styles } from "./styles";

interface BottomActionBarProps {
  onClearFilters: () => void;
  isClearing?: boolean;
}

export const BottomActionBar = React.memo<BottomActionBarProps>(({ onClearFilters, isClearing = false }) => {
  return (
    <Animated.View
      style={styles.bottomButtonContainer}
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition.springify()}
    >
      <TouchableOpacity
        style={styles.clearButton}
        onPress={onClearFilters}
        activeOpacity={0.7}
        disabled={isClearing}
      >
        {isClearing ? (
          <ActivityIndicator color="#f97583" size="small" />
        ) : (
          <X size={18} color="#f97583" />
        )}
        <Text style={styles.clearButtonText}>
          {isClearing ? "Clearing..." : "Clear All Filters"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});
