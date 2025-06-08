import { useEventBroker } from "@/hooks/useEventBroker";
import {
  CameraAnimateToLocationEvent,
  DiscoveredEventData,
  DiscoveryEvent,
  EventTypes,
  NotificationEvent,
} from "@/services/EventBroker";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import * as Crypto from "expo-crypto";
import { COLORS } from "../Layout/ScreenLayout";

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
  const [items, setItems] = useState<IndicatorItem[]>([]);
  const { subscribe, publish } = useEventBroker();

  const positionStyle = useMemo(() => {
    const baseSpacing = 4;
    const itemSpacing = 8;
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
          setTimeout(() => {
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
          setTimeout(() => {
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
  }, [subscribe]);

  const handlePress = (item: IndicatorItem) => {
    if (item.type === "discovery" && item.event?.location?.coordinates) {
      publish<CameraAnimateToLocationEvent>(
        EventTypes.CAMERA_ANIMATE_TO_LOCATION,
        {
          coordinates: item.event.location.coordinates,
          timestamp: new Date().getTime(),
          source: "discovery_indicator",
          zoomLevel: 20,
        },
      );
    }

    // Remove the item after a short delay
    setTimeout(() => {
      setItems((current) => current.filter((i) => i.id !== item.id));
    }, 50);
  };

  const getNotificationIcon = (
    type: "info" | "success" | "warning" | "error",
  ) => {
    switch (type) {
      case "success":
        return "checkmark-circle";
      case "warning":
        return "warning";
      case "error":
        return "alert-circle";
      default:
        return "information-circle";
    }
  };

  const getNotificationColor = (
    type: "info" | "success" | "warning" | "error",
  ) => {
    switch (type) {
      case "success":
        return "#4CAF50";
      case "warning":
        return "#FFC107";
      case "error":
        return "#F44336";
      default:
        return "#2196F3";
    }
  };

  const renderItem = (item: IndicatorItem, index: number) => {
    const isNotification = item.type === "notification";
    const iconColor = isNotification
      ? getNotificationColor(item.notification!.type)
      : "rgba(255, 255, 255, 0.9)";
    const iconName = isNotification
      ? getNotificationIcon(item.notification!.type)
      : "chevron-forward";

    return (
      <Animated.View
        key={item.id}
        style={[styles.itemContainer, index > 0 && { marginTop: 8 }]}
        entering={FadeInDown.springify()
          .damping(15)
          .mass(0.8)
          .delay(index * 100)}
        exiting={FadeOutUp.springify()
          .damping(15)
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
                <Ionicons name={iconName} size={20} color={iconColor} />
              ) : (
                <Text style={styles.emojiText}>
                  {item.event?.emoji || "🎉"}
                </Text>
              )}
            </View>

            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={styles.titleText} numberOfLines={1}>
                {isNotification ? item.notification!.title : "New Discovery"}
              </Text>
              {isNotification && item.notification!.message && (
                <Text style={styles.messageText} numberOfLines={1}>
                  {item.notification!.message}
                </Text>
              )}
            </View>

            {!isNotification && (
              <View style={styles.tapIndicator}>
                <Ionicons
                  name={iconName}
                  size={16}
                  color="rgba(255, 255, 255, 0.6)"
                />
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

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
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
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 8,
    paddingRight: 8,
    width: 200,
    minHeight: 40,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  notificationIndicator: {
    backgroundColor: COLORS.cardBackgroundAlt,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  titleText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  messageText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontFamily: "SpaceMono",
    marginTop: 2,
  },
  emojiText: {
    fontSize: 12,
    textAlign: "center",
    color: COLORS.textPrimary,
  },
  tapIndicator: {
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default DiscoveryIndicator;
