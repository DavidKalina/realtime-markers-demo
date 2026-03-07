import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useColors, type Colors } from "@/theme";

const LoadingEventDetails = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.fixed.white} />
    </View>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
});

export default LoadingEventDetails;
