import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiClient, DeviceInfo } from "./ApiClient";
import { eventBroker, EventTypes } from "./EventBroker";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Suppress discovery pushes when app is in foreground
    // (the DiscoveryIndicator toast handles this via WebSocket)
    if (notification.request.content.data?.type === "discovery") {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
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
   * Register token if permissions are already granted (no prompt).
   * Returns true if token was registered, false if permission not yet granted.
   */
  async registerIfAlreadyGranted(userId: string): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") return false;
      return this.registerToken(userId);
    } catch (error) {
      console.error("❌ Error checking notification permissions:", error);
      return false;
    }
  }

  /**
   * Request notification permissions and register token with backend
   */
  /**
   * Request notification permissions and register token with backend.
   * This shows the system permission prompt if not yet granted.
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

      return this.registerToken(userId);
    } catch (error) {
      console.error("❌ Error setting up push notifications:", error);
      return false;
    }
  }

  /**
   * Internal: get push token and register with backend (assumes permission already granted).
   */
  private async registerToken(userId: string): Promise<boolean> {
    try {
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
    // Handle notification received while app is running (foreground)
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("📱 Notification received:", notification);
        const data = notification.request.content.data;

        // Process itinerary check-ins immediately so the UI updates
        // without waiting for the user to tap the notification banner
        if (data?.type === "itinerary_checkin" && data.itineraryId) {
          eventBroker.emit(EventTypes.ITINERARY_CHECKIN, {
            timestamp: Date.now(),
            source: "PushNotification",
            itineraryId: data.itineraryId as string,
            itemId: data.itemId as string,
            completed: data.completed as boolean,
          });
        }
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
      notificationListener.remove();
      responseListener.remove();
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
    if (data?.type === "discovery" && data.coordinates) {
      // Animate map to the discovered event's location
      const coordinates = data.coordinates as [number, number];
      eventBroker.emit(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
        timestamp: Date.now(),
        source: "PushNotification",
        coordinates,
        zoomLevel: 15,
      });
    } else if (data?.type === "itinerary_checkin" && data.itineraryId) {
      // User auto-checked in at an itinerary stop
      eventBroker.emit(EventTypes.ITINERARY_CHECKIN, {
        timestamp: Date.now(),
        source: "PushNotification",
        itineraryId: data.itineraryId as string,
        itemId: data.itemId as string,
        completed: data.completed as boolean,
      });
    } else if (data?.type === "badge_unlocked") {
      // Badge unlocked — navigate to profile/badges
      console.log("Badge unlocked:", data.badgeName, data.badgeEmoji);
      eventBroker.emit(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "PushNotification",
        title: `${data.badgeEmoji} Badge Unlocked!`,
        message: data.badgeName as string,
        notificationType: "success" as const,
      });
    } else if (data?.type === "streak_at_risk") {
      // Streak at risk — show notification and navigate to itineraries
      eventBroker.emit(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "PushNotification",
        title: "Streak at risk!",
        message: `Your ${data.currentStreak}-week streak needs a check-in this week`,
        notificationType: "warning" as const,
      });
      eventBroker.emit(EventTypes.NAVIGATE_TO_SCREEN, {
        timestamp: Date.now(),
        source: "PushNotification",
        path: "/itineraries",
      });
    } else if (data?.type === "milestone") {
      // Completion milestone — show celebration notification
      eventBroker.emit(EventTypes.NOTIFICATION, {
        timestamp: Date.now(),
        source: "PushNotification",
        title: "Milestone reached!",
        message: `You've completed ${data.count} itineraries!`,
        notificationType: "success" as const,
        duration: 5000,
      });
      eventBroker.emit(EventTypes.NAVIGATE_TO_SCREEN, {
        timestamp: Date.now(),
        source: "PushNotification",
        path: "/user",
      });
    } else if (data?.type === "weekly_nudge") {
      // Weekly nudge — navigate to itinerary builder
      eventBroker.emit(EventTypes.NAVIGATE_TO_SCREEN, {
        timestamp: Date.now(),
        source: "PushNotification",
        path: "/itineraries",
      });
    } else if (data?.type === "follow_activity" && data.eventId) {
      // A followed user saved/rsvp'd/scanned an event
      console.log("Follow activity notification, event:", data.eventId);
    } else if (data?.type === "event") {
      // Navigate to event details
      console.log("Navigate to event:", data.eventId);
    }
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
