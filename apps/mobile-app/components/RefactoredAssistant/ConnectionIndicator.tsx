import React, { useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Wifi, WifiOff } from "lucide-react-native";

interface ConnectionIndicatorProps {
  isConnected: boolean;
  eventsCount: number;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ isConnected, eventsCount }) => {
  // Animation for pulsing effect when disconnected
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isConnected) {
      // Create pulsing animation for disconnected state
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Stop animation when connected
      pulseAnim.setValue(1);
    }

    return () => {
      // Cleanup animation
      pulseAnim.stopAnimation();
    };
  }, [isConnected, pulseAnim]);

  // Animation style
  const animatedStyle = {
    transform: [{ scale: pulseAnim }],
    opacity: pulseAnim.interpolate({
      inputRange: [1, 1.2],
      outputRange: [1, 0.7],
    }),
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.indicator,
          isConnected ? styles.connected : styles.disconnected,
          !isConnected && animatedStyle,
        ]}
      >
        {isConnected ? <Wifi size={16} color="#fff" /> : <WifiOff size={16} color="#fff" />}
      </Animated.View>

      <View style={styles.textContainer}>
        <Text style={styles.statusText}>{isConnected ? "Connected" : "Connecting..."}</Text>
        {isConnected && eventsCount > 0 && (
          <Text style={styles.countText}>
            {eventsCount} event{eventsCount !== 1 ? "s" : ""} available
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    padding: 8,
    zIndex: 1000,
  },
  indicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  connected: {
    backgroundColor: "#4caf50",
  },
  disconnected: {
    backgroundColor: "#f44336",
  },
  textContainer: {
    flexDirection: "column",
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  countText: {
    color: "#e0e0e0",
    fontSize: 10,
    fontFamily: "SpaceMono",
  },
});

export default ConnectionIndicator;
