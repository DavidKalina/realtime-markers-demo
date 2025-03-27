import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";
import { AlertCircle, Minus, Plus, WifiOff, Wifi } from "lucide-react-native";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
  eventsCount?: number;
  initialConnectionState?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
  showAnimation?: boolean;
}

// Define notification types
type NotificationType = "none" | "added" | "removed" | "reconnecting" | "connecting";

// Pre-define animations to avoid recreation - matching QueueIndicator
const SPRING_LAYOUT = Layout.springify();
const SLIDE_IN = SlideInLeft.springify()
  .damping(20)  // Increased damping for more controlled movement
  .mass(1.2)    // Slightly increased mass for more weight feel
  .stiffness(150); // Reduced stiffness for smoother movement
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
  iconScale: {
    duration: 400,
    easing: Easing.elastic(1.2),
  },
};

// Create a memoized notification icon component
const NotificationIcon = React.memo(
  ({ type, isConnected, style }: { type: NotificationType; isConnected: boolean; style?: any }) => {
    const icon = useMemo(() => {
      switch (type) {
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
    }, [type, isConnected]);

    return <Animated.View style={style}>{icon}</Animated.View>;
  }
);

// Create a memoized notification text component
const NotificationText = React.memo(
  ({
    activeNotification,
    notificationData,
    isConnected,
    hasConnectionEverBeenEstablished,
  }: {
    activeNotification: NotificationType;
    notificationData: { count: number; text: string };
    isConnected: boolean;
    hasConnectionEverBeenEstablished: boolean;
  }) => {
    if (activeNotification !== "none") {
      return (
        <Animated.Text
          style={styles.statusText}
          entering={FADE_IN}
          exiting={FadeOut.duration(300)}
          layout={SPRING_LAYOUT}
        >
          {notificationData.text}
        </Animated.Text>
      );
    }

    return (
      <Animated.Text
        style={styles.statusText}
        entering={FADE_IN}
        exiting={FadeOut.duration(300)}
        layout={SPRING_LAYOUT}
      >
        {isConnected
          ? "Connected"
          : hasConnectionEverBeenEstablished
            ? "Reconnecting..."
            : "Connecting"}
      </Animated.Text>
    );
  }
);

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = React.memo(
  ({
    eventsCount = 0,
    initialConnectionState = false,
    position = "top-right",
    showAnimation = true,
  }) => {
    // Track connection status from WebSocket events
    const [isConnected, setIsConnected] = useState(initialConnectionState);
    const [hasConnectionEverBeenEstablished, setHasConnectionEverBeenEstablished] =
      useState(initialConnectionState);
    const [isVisible, setIsVisible] = useState(true);

    // Add state for the transient notifications
    const [activeNotification, setActiveNotification] = useState<NotificationType>("none");
    const [notificationData, setNotificationData] = useState<{ count: number; text: string }>({
      count: 0,
      text: "",
    });

    // Use refs for timers and internal tracking to avoid re-renders
    const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notificationQueueRef = useRef<
      { type: NotificationType; count: number; duration: number }[]
    >([]);
    const isProcessingNotificationRef = useRef<boolean>(false);

    // Reanimated shared values for animations
    const scale = useSharedValue(1);
    const iconOpacity = useSharedValue(1);
    const notificationScale = useSharedValue(0);

    // Use the event broker hook
    const { subscribe } = useEventBroker();

    // Process the next notification in queue - completely rewritten for reliability
    const processNextNotification = useCallback(() => {
      // Only process if we're not already processing and there are items in the queue
      if (isProcessingNotificationRef.current || notificationQueueRef.current.length === 0) {
        return;
      }

      // Mark as processing
      isProcessingNotificationRef.current = true;

      // Get next notification from queue
      const { type, count, duration } = notificationQueueRef.current.shift()!;

      // Clear any existing timeout - this is critical for proper cleanup
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }

      // Prepare notification text
      let text = "";
      switch (type) {
        case "added":
          text = `new event!`;
          break;
        case "removed":
          text = `event removed`;
          break;
        case "reconnecting":
          text = "Reconnecting";
          break;
        case "connecting":
          text = "Connecting";
          break;
      }

      // Set notification state
      setActiveNotification(type);
      setNotificationData({ count, text });

      // Apply animation
      iconOpacity.value = withTiming(0, ANIMATION_CONFIG.fadeOut, () => {
        "worklet";
        notificationScale.value = withTiming(1, ANIMATION_CONFIG.iconScale);
      });

      // Set timeout to clear this notification - ALWAYS set a timeout
      notificationTimerRef.current = setTimeout(() => {
        // Reset the animation
        notificationScale.value = withTiming(0, ANIMATION_CONFIG.fadeOut, () => {
          "worklet";
          iconOpacity.value = withTiming(1, ANIMATION_CONFIG.fadeIn);
        });

        // Clear the notification state
        setActiveNotification("none");

        // Reset the timer reference
        notificationTimerRef.current = null;

        // Mark as no longer processing
        isProcessingNotificationRef.current = false;

        // Check if more notifications are in the queue after a small delay
        // This helps with smooth transitions between notifications
        setTimeout(() => {
          if (notificationQueueRef.current.length > 0) {
            processNextNotification();
          }
        }, 300);
      }, duration);
    }, [iconOpacity, notificationScale]);

    // Show a notification for a limited time - simplified and fixed
    const showNotification = useCallback(
      (type: NotificationType, count: number, duration: number = 5000) => {
        // Special handling for connection notifications
        if (type === "reconnecting" || type === "connecting") {
          // Always clear existing timeout
          if (notificationTimerRef.current) {
            clearTimeout(notificationTimerRef.current);
            notificationTimerRef.current = null;
          }

          // Clear the queue and processing state
          notificationQueueRef.current = [];
          isProcessingNotificationRef.current = false;

          // Set the connection notification directly
          setActiveNotification(type);
          setNotificationData({
            count: 0,
            text: type === "reconnecting" ? "Reconnecting" : "Connecting",
          });

          // Even connection notifications should have timeouts (but much longer)
          // This ensures they'll eventually clear if connection state doesn't change
          notificationTimerRef.current = setTimeout(() => {
            // Check if this notification is still active (might have been replaced)
            if (activeNotification === type) {
              setActiveNotification("none");
            }
            notificationTimerRef.current = null;
          }, duration * 3); // Much longer timeout for connection issues

          return;
        }

        // For normal notifications, add to queue
        notificationQueueRef.current.push({ type, count, duration });

        // If nothing is currently being processed, start processing
        if (!isProcessingNotificationRef.current) {
          processNextNotification();
        }
      },
      [activeNotification, processNextNotification]
    );

    // Create event handlers with useCallback to maintain stable references
    const handleConnected = useCallback(() => {
      setIsConnected(true);
      setHasConnectionEverBeenEstablished(true);
      setIsVisible(true);

      // Clear reconnecting notification if active
      if (activeNotification === "reconnecting" || activeNotification === "connecting") {
        setActiveNotification("none");

        // Process any pending notifications
        isProcessingNotificationRef.current = false;

        // Process after a small delay
        setTimeout(() => {
          if (notificationQueueRef.current.length > 0) {
            processNextNotification();
          }
        }, 500);
      }
    }, [activeNotification, processNextNotification]);

    const handleDisconnected = useCallback(() => {
      setIsConnected(false);
      setIsVisible(true);

      if (hasConnectionEverBeenEstablished) {
        showNotification("reconnecting", 0, 10000); // Longer timeout for reconnection
      } else {
        showNotification("connecting", 0, 10000);
      }
    }, [hasConnectionEverBeenEstablished, showNotification]);

    const handleMarkersUpdated = useCallback(() => {
      setIsConnected(true);
      setHasConnectionEverBeenEstablished(true);
    }, []);

    const handleError = useCallback((event: any) => {
      if (
        event.error &&
        (event.error.message?.includes("WebSocket") ||
          event.source?.includes("WebSocket") ||
          event.source?.includes("useMapWebSocket"))
      ) {
        setIsConnected(false);
      }
    }, []);

    const handleMarkerAdded = useCallback(
      (event: any) => {
        if (event.count > 0) {
          showNotification("added", event.count, 3000); // Shorter timeout (3 seconds) for add/remove notifications
        }
      },
      [showNotification]
    );

    const handleMarkerRemoved = useCallback(
      (event: any) => {
        if (event.count > 0) {
          showNotification("removed", event.count, 3000); // Shorter timeout
        }
      },
      [showNotification]
    );

    // Safety mechanism: clean up notifications if they stay active too long
    useEffect(() => {
      // This will check every 10 seconds if a notification has been active for more than 15 seconds
      // This handles edge cases where timeouts might not fire correctly
      const safetyInterval = setInterval(() => {
        // Only applies to non-connection notifications
        if (
          activeNotification !== "none" &&
          activeNotification !== "reconnecting" &&
          activeNotification !== "connecting"
        ) {
          // Force clear the notification state
          setActiveNotification("none");

          // Reset processing flag
          isProcessingNotificationRef.current = false;

          // Clear any existing timeout
          if (notificationTimerRef.current) {
            clearTimeout(notificationTimerRef.current);
            notificationTimerRef.current = null;
          }

          // Process next notification if any
          setTimeout(() => {
            if (notificationQueueRef.current.length > 0) {
              processNextNotification();
            }
          }, 500);
        }
      }, 15000);

      return () => clearInterval(safetyInterval);
    }, [activeNotification, processNextNotification]);

    // Listen to WebSocket connection events
    useEffect(() => {
      // Subscribe to events using the hook (cleanup is handled automatically)
      const unsubConnect = subscribe(EventTypes.WEBSOCKET_CONNECTED, handleConnected);
      const unsubDisconnect = subscribe(EventTypes.WEBSOCKET_DISCONNECTED, handleDisconnected);
      const unsubMarkers = subscribe(EventTypes.MARKERS_UPDATED, handleMarkersUpdated);
      const unsubError = subscribe(EventTypes.ERROR_OCCURRED, handleError);
      const unsubMarkerAdded = subscribe(EventTypes.MARKER_ADDED, handleMarkerAdded);
      const unsubMarkerRemoved = subscribe(EventTypes.MARKER_REMOVED, handleMarkerRemoved);

      // Cleanup function
      return () => {
        if (notificationTimerRef.current) {
          clearTimeout(notificationTimerRef.current);
          notificationTimerRef.current = null;
        }

        // Empty the queue
        notificationQueueRef.current = [];
        isProcessingNotificationRef.current = false;

        // Explicitly unsubscribe from all events
        unsubConnect();
        unsubDisconnect();
        unsubMarkers();
        unsubError();
        unsubMarkerAdded();
        unsubMarkerRemoved();
      };
    }, [
      subscribe,
      handleConnected,
      handleDisconnected,
      handleMarkersUpdated,
      handleError,
      handleMarkerAdded,
      handleMarkerRemoved,
    ]);

    // Handle animation based on connection status and notifications
    useEffect(() => {
      // Animation cleanup function reference
      let cleanupNeeded = false;

      const shouldAnimate = !isConnected || activeNotification !== "none";

      if (shouldAnimate && showAnimation) {
        cleanupNeeded = true;
        // Create smoother pulsing animation
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
          -1, // infinite repetitions
          false // not reverse
        );
      } else {
        // Reset animation with a smooth transition
        cancelAnimation(scale);
        scale.value = withTiming(1, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
      }

      return () => {
        // Cleanup animations
        if (cleanupNeeded) {
          cancelAnimation(scale);
          cancelAnimation(iconOpacity);
          cancelAnimation(notificationScale);
        }
      };
    }, [isConnected, activeNotification, showAnimation, scale, iconOpacity, notificationScale]);

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

    const notificationIconStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: notificationScale.value }],
        opacity: notificationScale.value,
        position: "absolute",
      };
    });

    // Get position styles based on position prop
    const positionStyle = useMemo(() => {
      switch (position) {
        case "top-left":
          return { top: 50, left: 16 }; // Top position
        case "bottom-right":
          return { bottom: 50, right: 16 };
        case "bottom-left":
          return { bottom: 50, left: 16 };
        case "custom":
          return {};
        case "top-right":
        default:
          return { top: 50, left: 16 }; // Top position
      }
    }, [position]);

    // Get status color based on notification type or connection status
    const statusColor = useMemo(() => {
      switch (activeNotification) {
        case "added":
          return "#2196f3"; // Blue for additions
        case "removed":
          return "#ff9800"; // Orange for removals
        case "reconnecting":
        case "connecting":
          return "#f44336"; // Red for connection issues
        default:
          return isConnected ? "#4caf50" : "#f44336"; // Green when connected, red when disconnected
      }
    }, [activeNotification, isConnected]);

    // Combine indicator styles
    const indicatorStyle = useMemo(() => {
      const baseStyles = [styles.indicator, { backgroundColor: statusColor }];

      if ((!isConnected || activeNotification !== "none") && showAnimation) {
        baseStyles.push(scaleAnimatedStyle as any);
      }

      return baseStyles;
    }, [statusColor, isConnected, activeNotification, showAnimation, scaleAnimatedStyle]);

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
          {/* Status icon (wifi connected/disconnected) */}
          <NotificationIcon type="none" isConnected={isConnected} style={statusIconStyle} />

          {/* Notification icon (plus, minus, alert) */}
          {activeNotification !== "none" && (
            <NotificationIcon
              type={activeNotification}
              isConnected={isConnected}
              style={notificationIconStyle}
            />
          )}
        </Animated.View>

        <View style={styles.contentContainer}>
          <NotificationText
            activeNotification={activeNotification}
            notificationData={notificationData}
            isConnected={isConnected}
            hasConnectionEverBeenEstablished={hasConnectionEverBeenEstablished}
          />
        </View>
      </Animated.View>
    );
  }
);

// Refined styles to match QueueIndicator
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
