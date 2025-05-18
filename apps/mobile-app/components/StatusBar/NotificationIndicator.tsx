import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
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
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  eventBroker,
  EventTypes,
  BaseEvent,
  NotificationEvent,
} from "@/services/EventBroker";
import { apiClient } from "@/services/ApiClient";

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
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true; // Flag to prevent state updates if the component is unmounted before fetch completes

      const fetchUnreadCount = async () => {
        console.log("Fetching unread count on focus..."); // Optional: for debugging
        // Set loading to true each time we fetch on focus
        if (isActive) {
          setIsLoading(true);
        }
        try {
          const { count } = await apiClient.getUnreadNotificationCount();
          if (isActive) {
            setUnreadCount(count);
          }
        } catch (error) {
          console.error(
            "Error fetching unread notification count on focus:",
            error,
          );
          // Optionally set count to 0 or handle error state
          if (isActive) {
            setUnreadCount(0); // Example: reset on error
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      fetchUnreadCount();

      // Cleanup function: runs when the screen loses focus or component unmounts
      return () => {
        isActive = false;
        console.log("Screen lost focus or unmounted during fetch."); // Optional: for debugging
      };
    }, []), // Dependencies for the useCallback. Usually empty unless fetchUnreadCount depends on props/state.
  );

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
        withSpring(1, ANIMATION_CONFIG),
      );
    };

    const unsubscribe = eventBroker.on(
      EventTypes.NOTIFICATION,
      handleNewNotification,
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handlePress = () => {
    // Cancel any ongoing animations before starting new ones
    cancelAnimation(scale);
    cancelAnimation(rotation);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(0.95, ANIMATION_CONFIG),
      withSpring(1, ANIMATION_CONFIG),
    );
    rotation.value = withSequence(
      withTiming(-5, ROTATION_CONFIG),
      withTiming(5, ROTATION_CONFIG),
      withTiming(0, ROTATION_CONFIG),
    );

    // Mark notifications as read when opening
    setUnreadCount(0);
    router.push("/notifications");
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
          {isLoading ? (
            <ActivityIndicator size={12} color="#F59E0B" />
          ) : (
            <Ionicons name="notifications-outline" size={12} color="#F59E0B" />
          )}
          {!isLoading && unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.text}>Messages</Text>
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
  loadingContainer: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
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
