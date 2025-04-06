import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

const MapMojiHeader = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>MapMoji</Text>
      <Text style={styles.subtext}>Scan. Discover. Attend.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
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
  subtext: {
    fontSize: 16,
    fontFamily: "SpaceMono",
    color: "#fff",
    zIndex: 10,
  },
});

export default MapMojiHeader;
