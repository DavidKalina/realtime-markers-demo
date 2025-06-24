import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiClient, DeviceInfo } from "./ApiClient";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class PushNotificationService {
  private static instance: PushNotificationService | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Request notification permissions and register token with backend
   */
  async setupPushNotifications(userId: string): Promise<boolean> {
    try {
      console.log("🔔 Setting up push notifications for user:", userId);

      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== "granted") {
        console.log("❌ Notification permissions not granted");
        return false;
      }

      console.log("✅ Notification permissions granted");

      // Get the token - use project ID from app config or environment
      const tokenOptions: { projectId?: string } = {};

      // First try to get from environment variable
      if (process.env.EXPO_PUBLIC_PROJECT_ID) {
        tokenOptions.projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
        console.log(
          "📱 Using project ID from environment:",
          tokenOptions.projectId,
        );
      }
      // Fall back to app config
      else if (Constants.expoConfig?.extra?.expoProjectId) {
        tokenOptions.projectId = Constants.expoConfig.extra.expoProjectId;
        console.log(
          "📱 Using project ID from app config:",
          tokenOptions.projectId,
        );
      }
      // Final fallback to EAS project ID
      else if (Constants.expoConfig?.extra?.eas?.projectId) {
        tokenOptions.projectId = Constants.expoConfig.extra.eas.projectId;
        console.log(
          "📱 Using project ID from EAS config:",
          tokenOptions.projectId,
        );
      }

      const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);

      if (!tokenData?.data) {
        console.log("❌ Failed to get push token");
        return false;
      }

      console.log("📱 Got push token:", tokenData.data);

      // Get device info
      const deviceInfo = await this.getDeviceInfo();

      // Register token with backend
      await apiClient.pushNotifications.registerToken(
        tokenData.data,
        deviceInfo,
      );

      console.log("✅ Push token registered successfully");
      return true;
    } catch (error) {
      console.error("❌ Error setting up push notifications:", error);
      return false;
    }
  }

  /**
   * Get device information for token registration
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    const deviceInfo: DeviceInfo = {
      platform: Platform.OS as "ios" | "android" | "web",
    };

    if (Device.isDevice) {
      deviceInfo.model = Device.modelName || undefined;
      deviceInfo.osVersion = Device.osVersion || undefined;
    }

    // Add app version if available
    if (Constants.expoConfig?.version) {
      deviceInfo.appVersion = Constants.expoConfig.version;
    }

    return deviceInfo;
  }

  /**
   * Unregister push token from backend
   */
  async unregisterPushToken(token: string): Promise<void> {
    try {
      await apiClient.pushNotifications.unregisterToken(token);
      console.log("✅ Push token unregistered successfully");
    } catch (error) {
      console.error("❌ Error unregistering push token:", error);
    }
  }

  /**
   * Get all registered tokens for the current user
   */
  async getUserTokens() {
    try {
      return await apiClient.pushNotifications.getUserTokens();
    } catch (error) {
      console.error("❌ Error getting user tokens:", error);
      return [];
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners() {
    // Handle notification received while app is running
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("📱 Notification received:", notification);
        // Handle the notification as needed
      },
    );

    // Handle notification response (user tapped notification)
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("👆 Notification response:", response);
        // Handle the notification response as needed
        // You can navigate to specific screens based on the notification data
        this.handleNotificationResponse(response);
      });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  /**
   * Handle notification response (user tapped notification)
   */
  private handleNotificationResponse(
    response: Notifications.NotificationResponse,
  ) {
    const data = response.notification.request.content.data;

    // Handle different types of notifications based on data
    if (data?.type === "event") {
      // Navigate to event details
      console.log("Navigate to event:", data.eventId);
      // You can use navigation here if you have access to it
    } else if (data?.type === "civic_engagement") {
      // Navigate to civic engagement details
      console.log("Navigate to civic engagement:", data.engagementId);
    } else if (data?.type === "civic_engagement_update") {
      // Navigate to civic engagement details when status is updated
      console.log(
        "Navigate to civic engagement update:",
        data.civicEngagementId,
      );
      // You can use navigation here if you have access to it
    } else if (data?.type === "civic_engagement_implemented") {
      // Navigate to civic engagement details when implemented
      console.log(
        "Navigate to implemented civic engagement:",
        data.civicEngagementId,
      );
      // You can use navigation here if you have access to it
    } else if (data?.type === "civic_engagement_admin_notes") {
      // Navigate to civic engagement details when admin notes are added
      console.log(
        "Navigate to civic engagement with admin notes:",
        data.civicEngagementId,
      );
      // You can use navigation here if you have access to it
    }
    // Add more notification types as needed
  }

  /**
   * Schedule a local notification (for testing)
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    trigger?: Notifications.NotificationTriggerInput,
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: trigger || null, // null means show immediately
      });
      console.log("✅ Local notification scheduled");
    } catch (error) {
      console.error("❌ Error scheduling local notification:", error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("✅ All notifications cancelled");
    } catch (error) {
      console.error("❌ Error cancelling notifications:", error);
    }
  }

  /**
   * Get notification permissions status
   */
  async getNotificationPermissions() {
    try {
      return await Notifications.getPermissionsAsync();
    } catch (error) {
      console.error("❌ Error getting notification permissions:", error);
      return null;
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();
