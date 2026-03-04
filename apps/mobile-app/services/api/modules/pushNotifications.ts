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
}
