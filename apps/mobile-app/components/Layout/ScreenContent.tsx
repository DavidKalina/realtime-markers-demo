import React, { PropsWithChildren } from "react";
import { View, StyleSheet } from "react-native";

const ScreenContent: React.FC<PropsWithChildren> = ({ children }) => {
  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
});

export default ScreenContent;
