import React, { useMemo } from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { createStyles } from "./styles";
import { useColors } from "@/theme";

export const ErrorEventDetails = ({
  error,
  handleRetry,
}: {
  error: string;
  handleRetry: () => void;
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
};
