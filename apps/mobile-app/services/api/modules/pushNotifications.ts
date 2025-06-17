import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import {
  PushToken,
  PushTokenRegistrationInput,
  PushTokenUnregistrationInput,
  TestNotificationInput,
  SendToUsersInput,
  PushNotificationResponse,
} from "../base/types";
import { apiClient } from "../../ApiClient";

export class PushNotificationsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  /**
   * Register a push token for the authenticated user
   * @param input - Token registration data
   * @returns The registered push token
   */
  async registerToken(input: PushTokenRegistrationInput): Promise<PushToken> {
    const url = `${this.client.baseUrl}/api/push-notifications/register`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });

    const data = await this.handleResponse<{
      success: boolean;
      data: PushToken;
    }>(response);
    return data.data;
  }

  /**
   * Unregister a push token
   * @param input - Token unregistration data
   * @returns Success status
   */
  async unregisterToken(
    input: PushTokenUnregistrationInput,
  ): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/push-notifications/unregister`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify(input),
    });

    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Get all push tokens for the authenticated user
   * @returns Array of user's push tokens
   */
  async getUserTokens(): Promise<PushToken[]> {
    const url = `${this.client.baseUrl}/api/push-notifications/tokens`;
    const response = await this.fetchWithAuth(url);

    const data = await this.handleResponse<{
      success: boolean;
      data: PushToken[];
    }>(response);
    return data.data;
  }

  /**
   * Send a test push notification to the authenticated user
   * @param input - Test notification data
   * @returns Push notification results
   */
  async sendTestNotification(
    input: TestNotificationInput,
  ): Promise<PushNotificationResponse> {
    const url = `${this.client.baseUrl}/api/push-notifications/test`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });

    const data = await this.handleResponse<{
      success: boolean;
      data: PushNotificationResponse;
    }>(response);
    return data.data;
  }

  /**
   * Admin endpoint to send push notifications to multiple users
   * @param input - Notification data and target user IDs
   * @returns Push notification results
   */
  async sendToUsers(
    input: SendToUsersInput,
  ): Promise<PushNotificationResponse> {
    const url = `${this.client.baseUrl}/api/push-notifications/send`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });

    const data = await this.handleResponse<{
      success: boolean;
      data: PushNotificationResponse;
    }>(response);
    return data.data;
  }

  /**
   * Check if the user has any registered push tokens
   * @returns true if user has at least one active token
   */
  async hasRegisteredTokens(): Promise<boolean> {
    try {
      const tokens = await this.getUserTokens();
      return tokens.some((token) => token.isActive);
    } catch (error) {
      console.error("Error checking registered tokens:", error);
      return false;
    }
  }

  /**
   * Get the count of active push tokens for the user
   * @returns Number of active tokens
   */
  async getActiveTokenCount(): Promise<number> {
    try {
      const tokens = await this.getUserTokens();
      return tokens.filter((token) => token.isActive).length;
    } catch (error) {
      console.error("Error getting active token count:", error);
      return 0;
    }
  }

  /**
   * Deactivate all push tokens for the user (useful for logout)
   * @returns Success status
   */
  async deactivateAllTokens(): Promise<{ success: boolean }> {
    try {
      const tokens = await this.getUserTokens();
      const activeTokens = tokens.filter((token) => token.isActive);

      const results = await Promise.allSettled(
        activeTokens.map((token) =>
          this.unregisterToken({ token: token.token }),
        ),
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled" && result.value.success,
      ).length;

      return { success: successCount === activeTokens.length };
    } catch (error) {
      console.error("Error deactivating tokens:", error);
      return { success: false };
    }
  }
}

// Export as singleton using the main ApiClient instance
export const pushNotificationsModule = new PushNotificationsModule(apiClient);
export default pushNotificationsModule;
