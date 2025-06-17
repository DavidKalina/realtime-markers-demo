import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiClient } from "./ApiClient";
import { DeviceType, PushTokenRegistrationInput } from "./api/base/types";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationConfig {
  enableBadge?: boolean;
  enableSound?: boolean;
  enableAlert?: boolean;
}

export class PushNotificationService {
  private static instance: PushNotificationService | null = null;
  private isInitialized = false;
  private currentToken: string | null = null;
  private cleanupListeners: (() => void) | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize the push notification service
   * This should be called early in the app lifecycle
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Request permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("Push notification permissions not granted");
        return;
      }

      // Get the token
      const token = await this.getExpoPushToken();
      if (token) {
        this.currentToken = token;
        console.log("Push notification token obtained:", token);
      }

      // Set up notification listeners
      this.setupNotificationListeners();

      this.isInitialized = true;
      console.log("Push notification service initialized");
    } catch (error) {
      console.error("Failed to initialize push notification service:", error);
    }
  }

  /**
   * Get the Expo push token
   */
  private async getExpoPushToken(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log(
          "Push notifications are only supported on physical devices",
        );
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      return token.data;
    } catch (error) {
      console.error("Error getting Expo push token:", error);
      return null;
    }
  }

  /**
   * Set up notification listeners
   */
  private setupNotificationListeners(): void {
    // Handle notifications received while app is in foreground
    const foregroundSubscription =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received in foreground:", notification);
        // You can handle foreground notifications here
        // For example, show a custom in-app notification
      });

    // Handle notification responses (when user taps notification)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification response received:", response);
        // Handle notification tap here
        // You can navigate to specific screens based on the notification data
        this.handleNotificationResponse(response);
      });

    // Store cleanup function
    this.cleanupListeners = () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }

  /**
   * Handle notification response (when user taps notification)
   */
  private handleNotificationResponse(
    response: Notifications.NotificationResponse,
  ): void {
    const data = response.notification.request.content.data;

    // Handle different types of notifications
    if (data?.type === "event_invite") {
      // Navigate to event details
      // You can use router.push here if you have access to it
      console.log("Navigate to event:", data.eventId);
    } else if (data?.type === "friend_request") {
      // Navigate to friends screen
      console.log("Navigate to friends screen");
    }
    // Add more notification types as needed
  }

  /**
   * Register the current token with the backend
   * This should be called after successful authentication
   */
  async registerToken(): Promise<boolean> {
    if (!this.currentToken || !apiClient.isAuthenticated()) {
      console.log("Cannot register token: no token or not authenticated");
      return false;
    }

    try {
      const deviceInfo = await this.getDeviceInfo();

      const registrationInput: PushTokenRegistrationInput = {
        token: this.currentToken,
        deviceType: deviceInfo.deviceType,
        deviceId: deviceInfo.deviceId,
        appVersion: deviceInfo.appVersion,
        osVersion: deviceInfo.osVersion,
      };

      const result =
        await apiClient.pushNotifications.registerToken(registrationInput);
      console.log("Push token registered successfully:", result.id);
      return true;
    } catch (error) {
      console.error("Failed to register push token:", error);
      return false;
    }
  }

  /**
   * Unregister the current token from the backend
   * This should be called during logout
   */
  async unregisterToken(): Promise<boolean> {
    if (!this.currentToken) {
      console.log("No token to unregister");
      return true;
    }

    try {
      await apiClient.pushNotifications.unregisterToken({
        token: this.currentToken,
      });
      console.log("Push token unregistered successfully");
      this.currentToken = null;
      return true;
    } catch (error) {
      console.error("Failed to unregister push token:", error);
      return false;
    }
  }

  /**
   * Get device information for token registration
   */
  private async getDeviceInfo(): Promise<{
    deviceType: DeviceType;
    deviceId: string;
    appVersion: string;
    osVersion: string;
  }> {
    const deviceType: DeviceType = Platform.OS === "ios" ? "IOS" : "ANDROID";

    return {
      deviceType,
      deviceId: Device.deviceName || "unknown",
      appVersion: Constants.expoConfig?.version || "1.0.0",
      osVersion: Device.osVersion || "unknown",
    };
  }

  /**
   * Check if the user has registered tokens
   */
  async hasRegisteredTokens(): Promise<boolean> {
    try {
      return await apiClient.pushNotifications.hasRegisteredTokens();
    } catch (error) {
      console.error("Error checking registered tokens:", error);
      return false;
    }
  }

  /**
   * Send a test notification to the current user
   */
  async sendTestNotification(title: string, body: string): Promise<boolean> {
    try {
      const result = await apiClient.pushNotifications.sendTestNotification({
        title,
        body,
        data: { type: "test" },
      });

      console.log("Test notification sent:", result);
      return result.sent > 0;
    } catch (error) {
      console.error("Failed to send test notification:", error);
      return false;
    }
  }

  /**
   * Get the current push token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Check if the service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset the service state (useful for testing)
   */
  reset(): void {
    this.isInitialized = false;
    this.currentToken = null;
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();
export default pushNotificationService;
