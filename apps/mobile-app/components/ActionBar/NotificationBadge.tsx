import { apiClient } from "@/services/ApiClient";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

const ANIMATION_CONFIG = {
  damping: 10,
  stiffness: 200,
};

interface NotificationBadgeProps {
  isActive: boolean;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ isActive }) => {
  const scale = useSharedValue(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchUnreadCount = async () => {
        if (isActive) {
          setIsLoading(true);
        }
        try {
          const { count } =
            await apiClient.notifications.getUnreadNotificationCount();
          if (isActive) {
            setUnreadCount(count);
          }
        } catch (error) {
          console.error("Error fetching unread notification count:", error);
          if (isActive) {
            setUnreadCount(0);
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      fetchUnreadCount();

      return () => {
        isActive = false;
      };
    }, []),
  );

  useEffect(() => {
    const handleNewNotification = () => {
      setUnreadCount((prev) => prev + 1);
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (isLoading || (!isActive && unreadCount === 0)) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {isLoading ? (
        <ActivityIndicator size={8} color="#F59E0B" />
      ) : (
        unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: -4,
    right: -4,
  },
  badge: {
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

export default React.memo(NotificationBadge);
