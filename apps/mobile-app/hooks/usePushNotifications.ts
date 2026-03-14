import { useEffect } from "react";
import { useRouter } from "expo-router";
import { pushNotificationService } from "../services/PushNotificationService";
import {
  eventBroker,
  EventTypes,
  type NavigateToScreenEvent,
} from "../services/EventBroker";

/**
 * Hook to set up push notification listeners
 * Should be used in the root component or app layout
 */
export const usePushNotifications = () => {
  const router = useRouter();

  useEffect(() => {
    // Set up notification listeners
    const cleanup = pushNotificationService.setupNotificationListeners();

    // Listen for navigation events from push notification taps
    const unsubNav = eventBroker.on<NavigateToScreenEvent>(
      EventTypes.NAVIGATE_TO_SCREEN,
      (event) => {
        router.push(event.path as never);
      },
    );

    // Cleanup on unmount
    return () => {
      cleanup();
      unsubNav();
    };
  }, [router]);
};

/**
 * Hook to test local notifications (for development)
 */
export const useTestNotifications = () => {
  const testLocalNotification = async () => {
    await pushNotificationService.scheduleLocalNotification(
      "Test Notification",
      "This is a test notification from the app!",
      { type: "test", timestamp: Date.now() },
    );
  };

  const cancelAllNotifications = async () => {
    await pushNotificationService.cancelAllNotifications();
  };

  const checkPermissions = async () => {
    const permissions =
      await pushNotificationService.getNotificationPermissions();
    return permissions;
  };

  return {
    testLocalNotification,
    cancelAllNotifications,
    checkPermissions,
  };
};
