import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { X } from "lucide-react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { styles } from "./styles";

interface BottomActionBarProps {
  onClearFilters: () => void;
}

export const BottomActionBar = React.memo<BottomActionBarProps>(({ onClearFilters }) => {
  return (
    <Animated.View
      style={styles.bottomButtonContainer}
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition.springify()}
    >
      <TouchableOpacity style={styles.clearButton} onPress={onClearFilters} activeOpacity={0.7}>
        <X size={18} color="#f97583" />
        <Text style={styles.clearButtonText}>Clear All Filters</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});
