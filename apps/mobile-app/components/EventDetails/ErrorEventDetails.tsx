import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { styles } from "./styles";

export const ErrorEventDetails = ({
  error,
  handleRetry,
}: {
  error: string;
  handleRetry: () => void;
}) => {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
};
