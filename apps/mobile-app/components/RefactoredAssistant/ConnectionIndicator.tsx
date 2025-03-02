import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Wifi, WifiOff } from "lucide-react-native";
import { EventTypes } from "@/services/EventBroker";
import { useEventBroker } from "@/hooks/useEventBroker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  Layout,
} from "react-native-reanimated";

interface ConnectionIndicatorProps {
  eventsCount?: number;
  initialConnectionState?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  showAnimation?: boolean;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  eventsCount = 0,
  initialConnectionState = false,
  position = "top-right",
  showAnimation = true,
}) => {
  // Track connection status from WebSocket events
  const [isConnected, setIsConnected] = useState(initialConnectionState);
  const [hasConnectionEverBeenEstablished, setHasConnectionEverBeenEstablished] =
    useState(initialConnectionState);

  // Reanimated shared values for animations
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Use the event broker hook
  const { subscribe } = useEventBroker();

  // Listen to WebSocket connection events
  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setHasConnectionEverBeenEstablished(true);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    // Check initial connection status by subscribing to any marker updates
    const handleMarkersUpdated = () => {
      setIsConnected(true);
      setHasConnectionEverBeenEstablished(true);
    };

    const handleError = (event: any) => {
      if (
        event.error &&
        (event.error.message?.includes("WebSocket") ||
          event.source?.includes("WebSocket") ||
          event.source?.includes("useMapWebSocket"))
      ) {
        setIsConnected(false);
      }
    };

    // Subscribe to events using the hook (cleanup is handled automatically)
    subscribe(EventTypes.WEBSOCKET_CONNECTED, handleConnected);
    subscribe(EventTypes.WEBSOCKET_DISCONNECTED, handleDisconnected);
    subscribe(EventTypes.MARKERS_UPDATED, handleMarkersUpdated);
    subscribe(EventTypes.ERROR_OCCURRED, handleError);

    // No need for manual cleanup as the hook handles it
  }, [subscribe]);

  // Handle animation based on connection status
  useEffect(() => {
    if (!isConnected && showAnimation) {
      // Create smoother pulsing animation for disconnected state
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, {
            duration: 800,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(1, {
            duration: 800,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1, // infinite repetitions
        false // not reverse
      );

      opacity.value = withRepeat(
        withSequence(
          withTiming(0.7, {
            duration: 800,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(1, {
            duration: 800,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1, // infinite repetitions
        false // not reverse
      );
    } else {
      // Reset animation when connected with a smooth transition
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, {
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      opacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    }

    return () => {
      // Cleanup animations
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [isConnected, scale, opacity, showAnimation]);

  // Create animated styles using Reanimated
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  // Get the right status text based on connection history
  const getStatusText = () => {
    if (isConnected) return "Connected";
    if (hasConnectionEverBeenEstablished) return "Reconnecting...";
    return "Connecting...";
  };

  // Get position styles based on position prop
  const getPositionStyle = () => {
    switch (position) {
      case "top-left":
        return { top: 50, left: 16 };
      case "bottom-right":
        return { bottom: 50, right: 16 };
      case "bottom-left":
        return { bottom: 50, left: 16 };
      case "top-right":
      default:
        return { top: 50, right: 16 };
    }
  };

  return (
    <Animated.View style={[styles.container, getPositionStyle()]} layout={Layout.springify()}>
      <Animated.View
        style={[
          styles.indicator,
          isConnected ? styles.connected : styles.disconnected,
          !isConnected && showAnimation && animatedStyles,
        ]}
        layout={Layout.springify()}
      >
        {isConnected ? <Wifi size={16} color="#fff" /> : <WifiOff size={16} color="#fff" />}
      </Animated.View>

      <View style={styles.textContainer}>
        <Animated.Text
          style={styles.statusText}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
          layout={Layout.springify()}
        >
          {getStatusText()}
        </Animated.Text>

        {isConnected && eventsCount > 0 && (
          <Animated.Text
            style={styles.countText}
            entering={FadeIn.duration(400).delay(100)}
            layout={Layout.springify()}
          >
            {eventsCount} event{eventsCount !== 1 ? "s" : ""} in area
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 20,
    padding: 8,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicator: {
    width: 28,
    height: 28,
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
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  countText: {
    color: "#e0e0e0",
    fontSize: 8,
    fontFamily: "SpaceMono",
  },
});

export default ConnectionIndicator;
