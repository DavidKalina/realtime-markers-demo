import React from "react";
import { styles } from "./styles";
import { ActivityIndicator, View, Text } from "react-native";

const LoadingEventDetails = () => {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#93c5fd" />
      <Text style={styles.loadingText}>Loading event details...</Text>
    </View>
  );
};

export default LoadingEventDetails;
