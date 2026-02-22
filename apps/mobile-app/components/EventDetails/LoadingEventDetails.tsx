import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "@/theme";

const LoadingEventDetails = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.fixed.white} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
});

export default LoadingEventDetails;
