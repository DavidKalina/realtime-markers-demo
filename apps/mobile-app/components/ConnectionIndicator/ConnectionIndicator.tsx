import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { WifiOff, Wifi, Signal } from "lucide-react-native";
import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  SlideInLeft,
  SlideOutLeft,
} from "react-native-reanimated";

interface ConnectionIndicatorProps {
  initialConnectionState?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
  showAnimation?: boolean;
}

// Pre-define animations to avoid recreation
const SPRING_LAYOUT = Layout.springify();
const SLIDE_IN = SlideInLeft.springify()
  .damping(20)
  .mass(1.2)
  .stiffness(150);
const SLIDE_OUT = SlideOutLeft.springify()
  .damping(20)
  .mass(1.2)
  .stiffness(150);
const FADE_IN = FadeIn.duration(400).delay(100);

// Animation configurations
const ANIMATION_CONFIG = {
  pulseDuration: 2000,
  fadeOut: { duration: 200 },
  fadeIn: { duration: 300 },
};

// Get status color based on network strength
const getStatusColor = (strength: number): string => {
  if (strength >= 80) return "#4caf50"; // Green for excellent
  if (strength >= 60) return "#8bc34a"; // Light green for good
  if (strength >= 40) return "#ffc107"; // Yellow for fair
  if (strength >= 20) return "#ff9800"; // Orange for poor
  return "#f44336"; // Red for very poor
};

// Get network type text
const getNetworkTypeText = (type: string | null): string => {
  switch (type) {
    case "wifi":
      return "WiFi";
    case "cellular":
      return "Cellular";
    case "ethernet":
      return "Ethernet";
    case "vpn":
      return "VPN";
    case "none":
      return "No Network";
    default:
      return "Unknown";
  }
};

// Get network quality description
const getNetworkQualityDescription = (strength: number): string => {
  if (strength >= 80) return "Excellent";
  if (strength >= 60) return "Good";
  if (strength >= 40) return "Fair";
  if (strength >= 20) return "Poor";
  return "Very Poor";
};

// Create a memoized status icon component
const StatusIcon = React.memo(({ isConnected, networkState, style }: { isConnected: boolean; networkState: any; style?: any }) => {
  const icon = useMemo(() => {
    if (!isConnected) return <WifiOff size={16} color="#fff" />;
    return <Signal size={16} color="#fff" />;
  }, [isConnected]);

  return <Animated.View style={style}>{icon}</Animated.View>;
});

// Create a memoized status text component
const StatusText = React.memo(
  ({ isConnected, hasConnectionEverBeenEstablished, networkState }: { isConnected: boolean; hasConnectionEverBeenEstablished: boolean; networkState: any }) => {
    const statusText = useMemo(() => {
      if (!isConnected) {
        return hasConnectionEverBeenEstablished ? "Reconnecting" : "Connecting";
      }

      // Only show network details if both network and WebSocket are connected
      if (networkState.isConnected) {
        const networkType = getNetworkTypeText(networkState.type);
        const quality = getNetworkQualityDescription(networkState.strength);
        return `${networkType} - ${quality}`;
      }

      return "Connected";
    }, [isConnected, hasConnectionEverBeenEstablished, networkState]);

    return (
      <Animated.Text
        style={styles.statusText}
        entering={FADE_IN}
        exiting={FadeOut.duration(300)}
        layout={SPRING_LAYOUT}
      >
        {statusText}
      </Animated.Text>
    );
  }
);

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = React.memo(
  ({
    initialConnectionState = false,
    position = "top-right",
    showAnimation = true,
  }) => {
    // Track connection status from WebSocket events
    const [isConnected, setIsConnected] = useState(initialConnectionState);
    const [hasConnectionEverBeenEstablished, setHasConnectionEverBeenEstablished] =
      useState(initialConnectionState);
    const [isVisible, setIsVisible] = useState(true);

    // Get network quality state
    const networkState = useNetworkQuality();

    // Reanimated shared values for animations
    const scale = useSharedValue(1);
    const iconOpacity = useSharedValue(1);

    // Use the event broker hook
    const { subscribe } = useEventBroker();

    // Create event handlers with useCallback to maintain stable references
    const handleConnected = React.useCallback(() => {
      setIsConnected(true);
      setHasConnectionEverBeenEstablished(true);
      setIsVisible(true);
    }, []);

    const handleDisconnected = React.useCallback(() => {
      setIsConnected(false);
      setIsVisible(true);
    }, []);

    const handleError = React.useCallback((event: any) => {
      if (
        event.error &&
        (event.error.message?.includes("WebSocket") ||
          event.source?.includes("WebSocket") ||
          event.source?.includes("useMapWebSocket"))
      ) {
        setIsConnected(false);
      }
    }, []);

    // Listen to WebSocket connection events
    useEffect(() => {
      const unsubConnect = subscribe(EventTypes.WEBSOCKET_CONNECTED, handleConnected);
      const unsubDisconnect = subscribe(EventTypes.WEBSOCKET_DISCONNECTED, handleDisconnected);
      const unsubError = subscribe(EventTypes.ERROR_OCCURRED, handleError);

      return () => {
        unsubConnect();
        unsubDisconnect();
        unsubError();
      };
    }, [subscribe, handleConnected, handleDisconnected, handleError]);

    // Handle animation based on connection status
    useEffect(() => {
      let cleanupNeeded = false;

      const shouldAnimate = !isConnected;

      if (shouldAnimate && showAnimation) {
        cleanupNeeded = true;
        scale.value = withRepeat(
          withSequence(
            withTiming(1.1, {
              duration: ANIMATION_CONFIG.pulseDuration / 2,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(1, {
              duration: ANIMATION_CONFIG.pulseDuration / 2,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1,
          false
        );
      } else {
        cancelAnimation(scale);
        scale.value = withTiming(1, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
      }

      return () => {
        if (cleanupNeeded) {
          cancelAnimation(scale);
          cancelAnimation(iconOpacity);
        }
      };
    }, [isConnected, showAnimation, scale, iconOpacity]);

    // Create animated styles using Reanimated
    const scaleAnimatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
      };
    });

    const statusIconStyle = useAnimatedStyle(() => {
      return {
        opacity: iconOpacity.value,
      };
    });

    // Get position styles based on position prop
    const positionStyle = useMemo(() => {
      switch (position) {
        case "top-left":
          return { top: 50, left: 16 };
        case "bottom-right":
          return { bottom: 50, right: 16 };
        case "bottom-left":
          return { bottom: 50, left: 16 };
        case "custom":
          return {};
        case "top-right":
        default:
          return { top: 50, left: 16 };
      }
    }, [position]);

    // Get status color based on network strength
    const statusColor = useMemo(() => {
      if (!isConnected) return "#f44336"; // Red when disconnected
      return getStatusColor(networkState.strength);
    }, [isConnected, networkState.strength]);

    // Combine indicator styles
    const indicatorStyle = useMemo(() => {
      const baseStyles = [styles.indicator, { backgroundColor: statusColor }];

      if (!isConnected && showAnimation) {
        baseStyles.push(scaleAnimatedStyle as any);
      }

      return baseStyles;
    }, [statusColor, isConnected, showAnimation, scaleAnimatedStyle]);

    // If component should not be visible, return null
    if (!isVisible) {
      return null;
    }

    return (
      <Animated.View
        style={[styles.container, positionStyle]}
        entering={SLIDE_IN}
        exiting={SLIDE_OUT}
        layout={SPRING_LAYOUT}
      >
        <Animated.View style={indicatorStyle} layout={SPRING_LAYOUT}>
          <StatusIcon isConnected={isConnected} networkState={networkState} style={statusIconStyle} />
        </Animated.View>

        <View style={styles.contentContainer}>
          <StatusText
            isConnected={isConnected}
            hasConnectionEverBeenEstablished={hasConnectionEverBeenEstablished}
            networkState={networkState}
          />
        </View>
      </Animated.View>
    );
  }
);

// Refined styles
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(51, 51, 51, 0.92)",
    borderRadius: 16,
    padding: 8,
    paddingRight: 10,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    maxWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  contentContainer: {
    flexDirection: "column",
    flex: 1,
  },
  statusText: {
    color: "#f8f9fa",
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default ConnectionIndicator;
