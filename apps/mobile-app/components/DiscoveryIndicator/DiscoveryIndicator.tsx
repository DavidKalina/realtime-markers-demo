import { useEventBroker } from "@/hooks/useEventBroker";
import {
  CameraAnimateToLocationEvent,
  DiscoveredEventData,
  DiscoveryEvent,
  EventTypes,
  NotificationEvent,
} from "@/services/EventBroker";
import { useFilterStore } from "@/stores/useFilterStore";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import * as Crypto from "expo-crypto";
import {
  useColors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  spring,
  type Colors,
} from "@/theme";

interface DiscoveryIndicatorProps {
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "custom";
}

interface IndicatorItem {
  id: string;
  type: "discovery" | "notification";
  event?: DiscoveredEventData;
  notification?: {
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
  };
  timestamp: number;
}

const DiscoveryIndicator: React.FC<DiscoveryIndicatorProps> = ({
  position = "top-right",
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<IndicatorItem[]>([]);
  const { subscribe, publish } = useEventBroker();
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // Track timeouts for cleanup on unmount
  const safeTimeout = useCallback((fn: () => void, delay: number) => {
    const timer = setTimeout(fn, delay);
    timersRef.current.push(timer);
    return timer;
  }, []);

  // Clear all pending timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        clearTimeout(timer);
      }
      timersRef.current = [];
    };
  }, []);

  const positionStyle = useMemo(() => {
    const baseSpacing = spacing.xs;
    const itemSpacing = spacing.sm;
    const maxItems = 5;

    switch (position) {
      case "top-left":
        return {
          left: baseSpacing,
          maxHeight: maxItems * (40 + itemSpacing),
        };
      case "bottom-right":
        return {
          right: baseSpacing,
          maxHeight: maxItems * (40 + itemSpacing),
        };
      case "bottom-left":
        return {
          left: baseSpacing,
          maxHeight: maxItems * (40 + itemSpacing),
        };
      case "top-right":
        return {
          right: baseSpacing,
          maxHeight: maxItems * (40 + itemSpacing),
        };
      default:
        return {
          left: baseSpacing,
          maxHeight: maxItems * (40 + itemSpacing),
        };
    }
  }, [position]);

  // Subscribe to discovery events and notifications
  useEffect(() => {
    const unsubscribeDiscovery = subscribe(
      EventTypes.EVENT_DISCOVERED,
      (event: DiscoveryEvent) => {
        // Filter out events outside the active time range
        const eventDateStr = event.event.eventDate?.split("T")[0];
        if (eventDateStr) {
          const { filters, activeFilterIds } = useFilterStore.getState();
          if (activeFilterIds.length > 0) {
            const activeFilter = filters.find((f) =>
              activeFilterIds.includes(f.id),
            );
            const range = activeFilter?.criteria?.dateRange;
            if (range?.start && range?.end) {
              if (eventDateStr < range.start || eventDateStr > range.end) {
                return;
              }
            }
          }
        }

        setItems((prev) => {
          // Don't add duplicates
          if (prev && prev.some((d) => d.id === event.event.id)) {
            return prev;
          }

          const newItem: IndicatorItem = {
            id: event.event.id,
            type: "discovery",
            event: { ...event.event },
            timestamp: new Date().getTime(),
          };

          // Add new item to the front of the array
          const newItems = [newItem, ...(prev || [])];

          // Auto-dismiss after 10 seconds
          safeTimeout(() => {
            setItems((current) => {
              if (!current) return [];
              return current.filter((item) => item.id !== newItem.id);
            });
          }, 10000);

          // Limit the number of displayed items
          return newItems.slice(0, 10);
        });
      },
    );

    const unsubscribeNotification = subscribe(
      EventTypes.NOTIFICATION,
      (event: NotificationEvent) => {
        setItems((prev) => {
          // Check for duplicate notifications based on content
          const isDuplicate = prev?.some(
            (item) =>
              item.type === "notification" &&
              item.notification?.title === event.title &&
              item.notification?.message === event.message &&
              item.notification?.type === event.notificationType,
          );

          if (isDuplicate) {
            return prev;
          }

          const newItem: IndicatorItem = {
            id: Crypto.randomUUID(),
            type: "notification",
            notification: {
              title: event.title,
              message: event.message,
              type: event.notificationType || "info",
            },
            timestamp: new Date().getTime(),
          };

          // Add new item to the front of the array
          const newItems = [newItem, ...(prev || [])];

          // Auto-dismiss after the specified duration or default to 5 seconds
          safeTimeout(() => {
            setItems((current) => {
              if (!current) return [];
              return current.filter((item) => item.id !== newItem.id);
            });
          }, event.duration || 5000);

          // Limit the number of displayed items
          return newItems.slice(0, 10);
        });
      },
    );

    return () => {
      unsubscribeDiscovery();
      unsubscribeNotification();
    };
  }, [subscribe, safeTimeout]);

  const handlePress = (item: IndicatorItem) => {
    if (item.type === "discovery" && item.event?.location?.coordinates) {
      publish<CameraAnimateToLocationEvent>(
        EventTypes.CAMERA_ANIMATE_TO_LOCATION,
        {
          coordinates: item.event.location.coordinates,
          timestamp: new Date().getTime(),
          source: "discovery_indicator",
          zoomLevel: 16,
          allowZoomChange: true,
        },
      );
    }

    // Remove the item after a short delay
    safeTimeout(() => {
      setItems((current) => current.filter((i) => i.id !== item.id));
    }, 50);
  };

  const getNotificationIcon = (
    type: "info" | "success" | "warning" | "error",
  ) => {
    switch (type) {
      case "success":
        return CheckCircle2;
      case "warning":
        return AlertTriangle;
      case "error":
        return AlertCircle;
      default:
        return Info;
    }
  };

  const getNotificationColor = (
    type: "info" | "success" | "warning" | "error",
  ) => {
    switch (type) {
      case "success":
        return colors.status.success.text;
      case "warning":
        return colors.status.warning.text;
      case "error":
        return colors.status.error.text;
      default:
        return colors.accent.dark;
    }
  };

  const renderItem = (item: IndicatorItem, index: number) => {
    const isNotification = item.type === "notification";
    const iconColor = isNotification
      ? getNotificationColor(item.notification!.type)
      : "rgba(255, 255, 255, 0.9)";
    const IconComponent = isNotification
      ? getNotificationIcon(item.notification!.type)
      : ChevronRight;

    return (
      <Animated.View
        key={item.id}
        style={[styles.itemContainer, index > 0 && { marginTop: spacing.sm }]}
        entering={FadeInDown.springify()
          .damping(spring.firm.damping)
          .mass(0.8)
          .delay(index * 100)}
        exiting={FadeOutUp.springify()
          .damping(spring.firm.damping)
          .mass(0.8)
          .delay(index * 100)}
        layout={LinearTransition.springify()}
      >
        <Pressable onPress={() => handlePress(item)} style={styles.pressable}>
          <View
            style={[
              styles.indicator,
              isNotification && styles.notificationIndicator,
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                isNotification && { backgroundColor: "transparent" },
              ]}
            >
              {isNotification ? (
                <IconComponent size={20} color={iconColor} />
              ) : (
                <Text style={styles.emojiText}>
                  {item.event?.emoji || "🎉"}
                </Text>
              )}
            </View>

            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={styles.titleText} numberOfLines={1}>
                {isNotification
                  ? item.notification!.title
                  : item.event?.isOwnDiscovery
                    ? "Your Discovery"
                    : "Nearby Discovery"}
              </Text>
              {isNotification && item.notification!.message && (
                <Text style={styles.messageText} numberOfLines={1}>
                  {item.notification!.message}
                </Text>
              )}
            </View>

            {!isNotification && (
              <View style={styles.tapIndicator}>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.6)" />
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View
      style={[styles.container, position === "custom" ? null : positionStyle]}
    >
      <View style={styles.wrapper}>
        {items && items.map((item, index) => renderItem(item, index))}
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      zIndex: 1001,
    },
    wrapper: {
      width: 220,
    },
    itemContainer: {
      width: 220,
    },
    pressable: {
      width: "100%",
    },
    indicator: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg.card,
      borderRadius: radius.md,
      padding: spacing.sm,
      paddingRight: spacing.sm,
      width: 200,
      minHeight: 40,
      borderWidth: 1,
      borderColor: colors.border.medium,
      shadowColor: colors.shadow.default,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    notificationIndicator: {
      backgroundColor: colors.bg.cardAlt,
    },
    iconContainer: {
      width: 24,
      height: 24,
      borderRadius: radius.sm,
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.sm,
      backgroundColor: colors.border.subtle,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    titleText: {
      color: colors.text.primary,
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      letterSpacing: 0.5,
    },
    messageText: {
      color: colors.text.secondary,
      fontSize: 10,
      fontFamily: fontFamily.mono,
      marginTop: 2,
    },
    emojiText: {
      fontSize: fontSize.xs,
      textAlign: "center",
      color: colors.text.primary,
    },
    tapIndicator: {
      marginLeft: spacing.xs,
      justifyContent: "center",
      alignItems: "center",
    },
  });

export default DiscoveryIndicator;
