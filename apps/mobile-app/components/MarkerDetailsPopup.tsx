import { useFloatingAnimation } from "@/hooks/useFloatingAnimation";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

interface MarkerDetailsPopupProps {
  marker: any;
}

const MarkerDetailsPopup: React.FC<MarkerDetailsPopupProps> = ({ marker }) => {
  const { floatingStyle } = useFloatingAnimation();

  console.log(marker);

  return (
    <Animated.View
      style={styles.container}
      entering={ZoomIn.duration(500)}
      exiting={ZoomOut.duration(500)}
    >
      <Animated.View style={[floatingStyle]}>
        <View style={styles.questDetails}>
          <View style={styles.titleAndClose}>
            <Text numberOfLines={1} style={styles.title}>
              {marker?.title}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  questDetails: {
    borderRadius: 10,
    padding: 20,
    backgroundColor: "#333",
    justifyContent: "space-between",
  },
  titleAndClose: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    maxWidth: "80%",
    fontSize: 18,
    fontFamily: "BungeeInline",
    fontWeight: "bold",
    color: "#FFF",
  },
  description: {
    fontSize: 14,
    fontFamily: "SpaceMono",
    color: "#CCC",
    marginBottom: 15,
  },
  rewardsContainer: {
    marginBottom: 15,
  },
  buttonContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  acceptButton: {
    flex: 2,
    backgroundColor: "#69db7c",
    padding: 10,
    borderRadius: 5,
    marginRight: 10, // Add gap between buttons
  },
  noticesButton: {
    flex: 2,
    backgroundColor: "#69db7c",
    padding: 10,
    borderRadius: 5,
    marginRight: 10, // Add gap between buttons
  },
  editButton: {
    flex: 1,
    backgroundColor: "#FFA500",
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    textAlign: "center",
    color: "#FFF",
    fontFamily: "BungeeInline",
    fontSize: 14,
  },
});

export default MarkerDetailsPopup;
