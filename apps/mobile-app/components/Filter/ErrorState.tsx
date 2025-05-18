import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AlertCircle } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { styles } from "./styles";

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <Animated.View
      style={styles.errorContainer}
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition.springify()}
    >
      <View style={styles.errorIconContainer}>
        <AlertCircle size={40} color="#f97583" />
      </View>
      <Text style={styles.errorTitle}>Error Loading Filters</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={onRetry}
        activeOpacity={0.7}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};
