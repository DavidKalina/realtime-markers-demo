import { useEffect } from "react";
import { pushNotificationService } from "../services/PushNotificationService";

/**
 * Hook to set up push notification listeners
 * Should be used in the root component or app layout
 */
export const usePushNotifications = () => {
  useEffect(() => {
    console.log("🔔 Setting up push notification listeners");

    // Set up notification listeners
    const cleanup = pushNotificationService.setupNotificationListeners();

    // Cleanup on unmount
    return cleanup;
  }, []);
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
    console.log("📱 Notification permissions:", permissions);
    return permissions;
  };

  return {
    testLocalNotification,
    cancelAllNotifications,
    checkPermissions,
  };
};
