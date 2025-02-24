import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface ProcessingViewProps {
  text?: string;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ text = "Processing..." }) => {
  return (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color="#000000" />
      <Text style={styles.processingText}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  processingContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    marginTop: 16,
    fontSize: 18,
    color: "#000000",
    fontWeight: "500",
  },
});
