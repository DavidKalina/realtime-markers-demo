import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { eventBroker, EventTypes, BaseEvent, NotificationEvent } from "@/services/EventBroker";

const ANIMATION_CONFIG = {
  damping: 10,
  stiffness: 200,
};

const ROTATION_CONFIG = {
  duration: 100,
  easing: Easing.inOut(Easing.ease),
};

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const NotificationIndicator: React.FC = () => {
  const router = useRouter();
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Simulate incoming notifications for testing
  useEffect(() => {
    const testNotifications = [
      {
        title: "New Event Nearby! 🎉",
        message: "A new event has been discovered in your area",
        type: "info" as const,
      },
      {
        title: "Level Up! ⭐",
        message: "Congratulations! You've reached level 5",
        type: "success" as const,
      },
      {
        title: "Event Reminder 🔔",
        message: "Your event 'Coffee Meetup' starts in 30 minutes",
        type: "warning" as const,
      },
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < testNotifications.length) {
        eventBroker.emit<NotificationEvent>(EventTypes.NOTIFICATION, {
          timestamp: Date.now(),
          source: "test",
          ...testNotifications[index],
        });
        index++;
      } else {
        clearInterval(interval);
      }
    }, 3000); // Send a new notification every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle new notifications from WebSocket
  useEffect(() => {
    const handleNewNotification = (event: NotificationEvent) => {
      setNotifications((prev) => {
        const newNotifications = [
          {
            id: Date.now().toString(),
            title: event.title,
            message: event.message,
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...prev,
        ];
        // Keep only the last 50 notifications
        return newNotifications.slice(0, 50);
      });
      setUnreadCount((prev) => prev + 1);

      // Trigger notification animation
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scale.value = withSequence(
        withSpring(1.2, ANIMATION_CONFIG),
        withSpring(1, ANIMATION_CONFIG)
      );
      router.push("/notifications");
    };

    const unsubscribe = eventBroker.on(EventTypes.NOTIFICATION, handleNewNotification);

    return () => {
      unsubscribe();
    };
  }, []);

  const handlePress = () => {
    // Cancel any ongoing animations before starting new ones
    cancelAnimation(scale);
    cancelAnimation(rotation);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(withSpring(0.95, ANIMATION_CONFIG), withSpring(1, ANIMATION_CONFIG));
    rotation.value = withSequence(
      withTiming(-5, ROTATION_CONFIG),
      withTiming(5, ROTATION_CONFIG),
      withTiming(0, ROTATION_CONFIG)
    );

    // Mark notifications as read when opening
    setUnreadCount(0);
    router.push("/cluster");
  };

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(scale);
      cancelAnimation(rotation);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications-outline" size={12} color="#F59E0B" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.text}>Notifications</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  text: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: "#F59E0B",
    letterSpacing: 0.2,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#F59E0B",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default React.memo(NotificationIndicator);
