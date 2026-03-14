import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import {
  useColors,
  fontSize,
  fontFamily,
  fontWeight,
  type Colors,
} from "@/theme";

const { width } = Dimensions.get("window");

const AppHeader = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Sidequests</Text>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      width: width,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      position: "relative",
      alignSelf: "center",
    },
    text: {
      fontSize: 42,
      fontFamily: fontFamily.display,
      letterSpacing: 1,
      color: colors.fixed.white,
      zIndex: 10,
      textAlign: "center",
      textShadowColor: "rgba(77, 171, 247, 0.6)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    subtext: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      color: colors.fixed.white,
      zIndex: 10,
    },
  });

export default AppHeader;
