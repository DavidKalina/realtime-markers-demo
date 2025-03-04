import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";
import { AlertCircle, Minus, Plus, Wifi, WifiOff } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
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
} from "react-native-reanimated";
import { styles } from "./styles";

interface ConnectionIndicatorProps {
  eventsCount?: number;
  initialConnectionState?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  showAnimation?: boolean;
}

// Define notification types
type NotificationType = "none" | "added" | "removed" | "reconnecting" | "connecting";

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  eventsCount = 0,
  initialConnectionState = false,
  position = "top-right",
  showAnimation = true,
}) => {
  // Track connection status from WebSocket events
  const [isConnected, setIsConnected] = useState(initialConnectionState);
  const [hasConnectionEverBeenEstablished, setHasConnectionEverBeenEstablished] =
    useState(initialConnectionState);

  // Add state for the transient notifications
  const [activeNotification, setActiveNotification] = useState<NotificationType>("none");
  const [notificationData, setNotificationData] = useState<{ count: number; text: string }>({
    count: 0,
    text: "",
  });
  const [notificationTimer, setNotificationTimer] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Reanimated shared values for animations
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Use the event broker hook
  const { subscribe } = useEventBroker();

  // Show a notification for a limited time
  const showNotification = (type: NotificationType, count: number, duration: number = 5000) => {
    // Clear any existing timeout
    if (notificationTimer) {
      clearTimeout(notificationTimer);
    }

    // Set the notification type and data
    setActiveNotification(type);

    let text = "";
    switch (type) {
      case "added":
        text = `${count} new event${count !== 1 ? "s" : ""} added!`;
        break;
      case "removed":
        text = `${count} event${count !== 1 ? "s" : ""} removed`;
        break;
      case "reconnecting":
        text = "Reconnecting...";
        break;
      case "connecting":
        text = "Connecting...";
        break;
    }

    setNotificationData({ count, text });

    // Set timeout to clear notification
    const timer = setTimeout(() => {
      setActiveNotification("none");
      setNotificationTimer(null);
    }, duration);

    setNotificationTimer(timer);
  };

  // Listen to WebSocket connection events
  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setHasConnectionEverBeenEstablished(true);

      // Clear reconnecting notification if active
      if (activeNotification === "reconnecting" || activeNotification === "connecting") {
        setActiveNotification("none");
      }
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      if (hasConnectionEverBeenEstablished) {
        showNotification("reconnecting", 0);
      } else {
        showNotification("connecting", 0);
      }
    };

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

    // Add handlers for marker added/removed events
    const handleMarkerAdded = (event: any) => {
      if (event.count > 0) {
        showNotification("added", event.count);
      }
    };

    const handleMarkerRemoved = (event: any) => {
      if (event.count > 0) {
        showNotification("removed", event.count);
      }
    };

    // Subscribe to events using the hook (cleanup is handled automatically)
    const unsubConnect = subscribe(EventTypes.WEBSOCKET_CONNECTED, handleConnected);
    const unsubDisconnect = subscribe(EventTypes.WEBSOCKET_DISCONNECTED, handleDisconnected);
    const unsubMarkers = subscribe(EventTypes.MARKERS_UPDATED, handleMarkersUpdated);
    const unsubError = subscribe(EventTypes.ERROR_OCCURRED, handleError);
    const unsubMarkerAdded = subscribe(EventTypes.MARKER_ADDED, handleMarkerAdded);
    const unsubMarkerRemoved = subscribe(EventTypes.MARKER_REMOVED, handleMarkerRemoved);

    // Cleanup function
    return () => {
      if (notificationTimer) {
        clearTimeout(notificationTimer);
      }

      // Explicitly unsubscribe from all events
      unsubConnect();
      unsubDisconnect();
      unsubMarkers();
      unsubError();
      unsubMarkerAdded();
      unsubMarkerRemoved();
    };
  }, [subscribe, activeNotification, hasConnectionEverBeenEstablished, notificationTimer]);

  // Handle animation based on connection status and notifications
  useEffect(() => {
    const shouldAnimate = !isConnected || activeNotification !== "none";

    if (shouldAnimate && showAnimation) {
      // Create smoother pulsing animation
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
      // Reset animation with a smooth transition
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
  }, [isConnected, scale, opacity, showAnimation, activeNotification]);

  // Create animated styles using Reanimated
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

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

  // Get the notification icon based on type
  const getNotificationIcon = () => {
    switch (activeNotification) {
      case "added":
        return <Plus size={16} color="#fff" />;
      case "removed":
        return <Minus size={16} color="#fff" />;
      case "reconnecting":
      case "connecting":
        return <AlertCircle size={16} color="#fff" />;
      default:
        return isConnected ? <Wifi size={16} color="#fff" /> : <WifiOff size={16} color="#fff" />;
    }
  };

  // Get notification styles based on type
  const getNotificationStyle = () => {
    switch (activeNotification) {
      case "added":
        return styles.notificationAdded;
      case "removed":
        return styles.notificationRemoved;
      case "reconnecting":
      case "connecting":
        return styles.disconnected;
      default:
        return isConnected ? styles.connected : styles.disconnected;
    }
  };

  // Log changes to active notification for debugging

  return (
    <Animated.View style={[styles.container, getPositionStyle()]} layout={Layout.springify()}>
      <Animated.View
        style={[
          styles.indicator,
          getNotificationStyle(),
          (!isConnected || activeNotification !== "none") && showAnimation && animatedStyles,
        ]}
        layout={Layout.springify()}
      >
        {getNotificationIcon()}
      </Animated.View>

      <View style={styles.textContainer}>
        {activeNotification !== "none" ? (
          <Animated.Text
            style={styles.statusText}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            layout={Layout.springify()}
          >
            {notificationData.text}
          </Animated.Text>
        ) : (
          <>
            <Animated.Text
              style={styles.statusText}
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(300)}
              layout={Layout.springify()}
            >
              {isConnected
                ? "Connected"
                : hasConnectionEverBeenEstablished
                ? "Reconnecting..."
                : "Connecting..."}
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
          </>
        )}
      </View>
    </Animated.View>
  );
};
