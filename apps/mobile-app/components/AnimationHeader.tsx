import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

const MapMojiHeader = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>MapMoji</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    width: width,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    alignSelf: "center",
  },
  text: {
    fontSize: 42,
    fontFamily: "SpaceMono",
    letterSpacing: 1,
    color: "#fff",
    zIndex: 10,
    textAlign: "center",
    textShadowColor: "rgba(77, 171, 247, 0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    fontWeight: "bold",
  },
});

export default MapMojiHeader;
