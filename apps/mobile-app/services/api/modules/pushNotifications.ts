import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export interface DeviceInfo {
  platform: "ios" | "android" | "web";
  version?: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
  [key: string]: unknown;
}

export interface PushToken {
  id: string;
  token: string;
  deviceInfo: DeviceInfo | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PushNotificationStats {
  totalTokens: number;
  activeTokens: number;
  usersWithTokens: number;
}

export class PushNotificationsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  /**
   * Register a push token for the current user
   */
  async registerToken(
    token: string,
    deviceInfo?: DeviceInfo,
  ): Promise<PushToken> {
    const url = `${this.client.baseUrl}/api/push-notifications/register`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ token, deviceInfo }),
    });

    const data = await this.handleResponse<{
      success: boolean;
      token: PushToken;
    }>(response);
    return data.token;
  }

  /**
   * Unregister a push token for the current user
   */
  async unregisterToken(token: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/push-notifications/unregister`;
    await this.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Get all push tokens for the current user
   */
  async getUserTokens(): Promise<PushToken[]> {
    const url = `${this.client.baseUrl}/api/push-notifications/tokens`;
    const response = await this.fetchWithAuth(url, { method: "GET" });
    const data = await this.handleResponse<{
      success: boolean;
      tokens: PushToken[];
    }>(response);
    return data.tokens;
  }

  /**
   * Send notification to a specific user (admin only)
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
    options?: {
      sound?: "default" | null;
      badge?: number;
      priority?: "default" | "normal" | "high";
    },
  ): Promise<{ success: number; failed: number }> {
    const url = `${this.client.baseUrl}/api/push-notifications/send`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({
        userId,
        title,
        body,
        data,
        ...options,
      }),
    });

    const result = await this.handleResponse<{
      success: boolean;
      result: { success: number; failed: number };
    }>(response);
    return result.result;
  }

  /**
   * Send notification to multiple users (admin only)
   */
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
    options?: {
      sound?: "default" | null;
      badge?: number;
      priority?: "default" | "normal" | "high";
    },
  ): Promise<{ success: number; failed: number }> {
    const url = `${this.client.baseUrl}/api/push-notifications/send-to-users`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({
        userIds,
        title,
        body,
        data,
        ...options,
      }),
    });

    const result = await this.handleResponse<{
      success: boolean;
      result: { success: number; failed: number };
    }>(response);
    return result.result;
  }

  /**
   * Get push notification statistics (admin only)
   */
  async getStats(): Promise<PushNotificationStats> {
    const url = `${this.client.baseUrl}/api/push-notifications/stats`;
    const response = await this.fetchWithAuth(url, { method: "GET" });
    const data = await this.handleResponse<{
      success: boolean;
      stats: PushNotificationStats;
    }>(response);
    return data.stats;
  }

  /**
   * Clean up invalid tokens (admin only)
   */
  async cleanupTokens(): Promise<number> {
    const url = `${this.client.baseUrl}/api/push-notifications/cleanup`;
    const response = await this.fetchWithAuth(url, { method: "POST" });
    const data = await this.handleResponse<{
      success: boolean;
      cleanedCount: number;
    }>(response);
    return data.cleanedCount;
  }
}
