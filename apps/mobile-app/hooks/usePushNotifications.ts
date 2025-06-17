import { useEffect, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/contexts/AuthContext";
import { pushNotificationService } from "@/services/PushNotificationService";

export interface UsePushNotificationsReturn {
  isInitialized: boolean;
  hasPermission: boolean;
  currentToken: string | null;
  registerToken: () => Promise<boolean>;
  unregisterToken: () => Promise<boolean>;
  sendTestNotification: (title: string, body: string) => Promise<boolean>;
  hasRegisteredTokens: () => Promise<boolean>;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const { isAuthenticated, user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  // Initialize push notification service
  useEffect(() => {
    const initializeService = async () => {
      try {
        await pushNotificationService.initialize();
        setIsInitialized(pushNotificationService.isServiceInitialized());
        setCurrentToken(pushNotificationService.getCurrentToken());

        // Check if we have permission
        const { status } = await Notifications.getPermissionsAsync();
        setHasPermission(status === "granted");
      } catch (error) {
        console.error("Failed to initialize push notification service:", error);
      }
    };

    initializeService();
  }, []);

  // Handle authentication state changes
  useEffect(() => {
    const handleAuthChange = async () => {
      if (isAuthenticated && user && isInitialized) {
        // User is authenticated, register the token
        console.log("User authenticated, registering push token...");
        await registerToken();
      } else if (!isAuthenticated && isInitialized) {
        // User logged out, unregister the token
        console.log("User logged out, unregistering push token...");
        await unregisterToken();
      }
    };

    handleAuthChange();
  }, [isAuthenticated, user, isInitialized]);

  // Register token with backend
  const registerToken = useCallback(async (): Promise<boolean> => {
    if (!isInitialized || !isAuthenticated) {
      console.log(
        "Cannot register token: service not initialized or user not authenticated",
      );
      return false;
    }

    try {
      const success = await pushNotificationService.registerToken();
      if (success) {
        console.log("Push token registered successfully");
      }
      return success;
    } catch (error) {
      console.error("Failed to register push token:", error);
      return false;
    }
  }, [isInitialized, isAuthenticated]);

  // Unregister token from backend
  const unregisterToken = useCallback(async (): Promise<boolean> => {
    if (!isInitialized) {
      console.log("Cannot unregister token: service not initialized");
      return false;
    }

    try {
      const success = await pushNotificationService.unregisterToken();
      if (success) {
        console.log("Push token unregistered successfully");
      }
      return success;
    } catch (error) {
      console.error("Failed to unregister push token:", error);
      return false;
    }
  }, [isInitialized]);

  // Send test notification
  const sendTestNotification = useCallback(
    async (title: string, body: string): Promise<boolean> => {
      if (!isInitialized || !isAuthenticated) {
        console.log(
          "Cannot send test notification: service not initialized or user not authenticated",
        );
        return false;
      }

      try {
        return await pushNotificationService.sendTestNotification(title, body);
      } catch (error) {
        console.error("Failed to send test notification:", error);
        return false;
      }
    },
    [isInitialized, isAuthenticated],
  );

  // Check if user has registered tokens
  const hasRegisteredTokens = useCallback(async (): Promise<boolean> => {
    if (!isInitialized || !isAuthenticated) {
      return false;
    }

    try {
      return await pushNotificationService.hasRegisteredTokens();
    } catch (error) {
      console.error("Failed to check registered tokens:", error);
      return false;
    }
  }, [isInitialized, isAuthenticated]);

  return {
    isInitialized,
    hasPermission,
    currentToken,
    registerToken,
    unregisterToken,
    sendTestNotification,
    hasRegisteredTokens,
  };
};
