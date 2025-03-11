import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";
import { AlertCircle, Minus, Plus, WifiOff, Wifi } from "lucide-react-native";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
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

// Pre-define animations to avoid recreation
const FADE_IN = FadeIn.duration(300);
const FADE_OUT = FadeOut.duration(300);
const FADE_IN_DELAYED = FadeIn.duration(400).delay(100);
const SPRING_LAYOUT = Layout.springify();

// Create a memoized notification icon component
const NotificationIcon = React.memo(
  ({ type, isConnected }: { type: NotificationType; isConnected: boolean }) => {
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

    return icon;
  }
);

// Create a memoized notification text component
const NotificationText = React.memo(
  ({
    activeNotification,
    notificationData,
    isConnected,
    hasConnectionEverBeenEstablished,
    eventsCount,
  }: {
    activeNotification: NotificationType;
    notificationData: { count: number; text: string };
    isConnected: boolean;
    hasConnectionEverBeenEstablished: boolean;
    eventsCount: number;
  }) => {
    if (activeNotification !== "none") {
      return (
        <Animated.Text
          style={styles.statusText}
          entering={FADE_IN}
          exiting={FADE_OUT}
          layout={SPRING_LAYOUT}
        >
          {notificationData.text}
        </Animated.Text>
      );
    }

    return (
      <>
        <Animated.Text
          style={styles.statusText}
          entering={FADE_IN}
          exiting={FADE_OUT}
          layout={SPRING_LAYOUT}
        >
          {isConnected
            ? "Connected"
            : hasConnectionEverBeenEstablished
            ? "Reconnecting..."
            : "Connecting..."}
        </Animated.Text>

        {isConnected && eventsCount > 0 && (
          <Animated.Text style={styles.countText} entering={FADE_IN_DELAYED} layout={SPRING_LAYOUT}>
            {eventsCount} event{eventsCount !== 1 ? "s" : ""} in view
          </Animated.Text>
        )}
      </>
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

      // Set notification state
      setActiveNotification(type);
      setNotificationData({ count, text });

      // Set timeout to clear this notification - ALWAYS set a timeout
      notificationTimerRef.current = setTimeout(() => {
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
    }, []);

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
            text: type === "reconnecting" ? "Reconnecting..." : "Connecting...",
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

    // Animation configuration - memoized to avoid recreating on each render
    const animationConfig = useMemo(
      () => ({
        pulse: {
          duration: 800,
          easing: Easing.inOut(Easing.sin),
        },
        reset: {
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
      }),
      []
    );

    // Handle animation based on connection status and notifications - optimize deps
    useEffect(() => {
      // Animation cleanup function reference
      let cleanupNeeded = false;

      const shouldAnimate = !isConnected || activeNotification !== "none";

      if (shouldAnimate && showAnimation) {
        cleanupNeeded = true;
        // Create smoother pulsing animation
        scale.value = withRepeat(
          withSequence(
            withTiming(1.2, animationConfig.pulse),
            withTiming(1, animationConfig.pulse)
          ),
          -1, // infinite repetitions
          false // not reverse
        );
      } else {
        // Reset animation with a smooth transition
        cancelAnimation(scale);
        scale.value = withTiming(1, animationConfig.reset);
      }

      return () => {
        // Cleanup animations
        if (cleanupNeeded) {
          cancelAnimation(scale);
        }
      };
    }, [isConnected, activeNotification, showAnimation, scale, animationConfig]);

    // Create animated styles using Reanimated - will only update when scale.value changes
    const animatedStyles = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
      };
    });

    // Get position styles based on position prop - memoized
    const positionStyle = useMemo(() => {
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
    }, [position]);

    // Get notification styles based on type - memoized
    const notificationStyle = useMemo(() => {
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
    }, [activeNotification, isConnected]);

    // Combine indicator styles - memoized
    const indicatorStyle = useMemo(() => {
      const baseStyles = [styles.indicator, notificationStyle];

      if ((!isConnected || activeNotification !== "none") && showAnimation) {
        baseStyles.push(animatedStyles as any);
      }

      return baseStyles;
    }, [notificationStyle, isConnected, activeNotification, showAnimation, animatedStyles]);

    return (
      <Animated.View style={[styles.container, positionStyle]} layout={SPRING_LAYOUT}>
        <Animated.View style={indicatorStyle} layout={SPRING_LAYOUT}>
          <NotificationIcon type={activeNotification} isConnected={isConnected} />
        </Animated.View>

        <View style={styles.textContainer}>
          <NotificationText
            activeNotification={activeNotification}
            notificationData={notificationData}
            isConnected={isConnected}
            hasConnectionEverBeenEstablished={hasConnectionEverBeenEstablished}
            eventsCount={eventsCount}
          />
        </View>
      </Animated.View>
    );
  }
);
