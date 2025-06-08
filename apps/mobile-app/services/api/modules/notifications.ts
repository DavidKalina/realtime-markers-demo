import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import {
  Notification,
  NotificationCreateInput,
  NotificationUpdateInput,
  NotificationCounts,
  NotificationOptions,
} from "../base/types";
import { apiClient } from "../../ApiClient";

export class NotificationsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getNotifications(params: NotificationOptions = {}): Promise<{
    notifications: Notification[];
    count: number;
    total: number;
    firstNotification?: Notification;
    lastNotification?: Notification;
  }> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.read !== undefined)
      queryParams.append("read", params.read.toString());
    if (params.type) queryParams.append("type", params.type);

    const url = `${this.client.baseUrl}/api/notifications?${queryParams.toString()}`;

    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{
      notifications: Notification[];
      total: number;
    }>(response);

    // Ensure we have valid data
    if (!data || !Array.isArray(data.notifications)) {
      console.error("Invalid notification response:", data);
      throw new Error("Invalid notification response format");
    }

    const notifications = data.notifications;
    const result = {
      notifications,
      count: notifications.length,
      total: data.total || notifications.length,
      firstNotification: notifications[0],
      lastNotification: notifications[notifications.length - 1],
    };

    return result;
  }

  async getNotification(id: string): Promise<Notification> {
    const url = `${this.client.baseUrl}/api/notifications/${id}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Notification>(response);
  }

  async createNotification(
    input: NotificationCreateInput,
  ): Promise<Notification> {
    const url = `${this.client.baseUrl}/api/notifications`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Notification>(response);
  }

  async updateNotification(
    id: string,
    input: NotificationUpdateInput,
  ): Promise<Notification> {
    const url = `${this.client.baseUrl}/api/notifications/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Notification>(response);
  }

  async deleteNotification(id: string): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/notifications/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  async getNotificationCounts(): Promise<NotificationCounts> {
    const url = `${this.client.baseUrl}/api/notifications/counts`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<NotificationCounts>(response);
  }

  async markNotificationAsRead(id: string): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/notifications/${id}/read`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  async markAllAsRead(): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/notifications/read/all`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  // Backward compatibility method
  async markAllNotificationsAsRead(): Promise<{ success: boolean }> {
    return this.markAllAsRead();
  }

  async deleteNotifications(ids: string[]): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/notifications`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  async clearAllNotifications(): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/notifications/clear`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  subscribeToNotifications(
    onNotification: (notification: Notification) => void,
    onError?: (error: Event) => void,
  ): () => void {
    const accessToken = this.client.tokens?.accessToken;
    if (!accessToken) {
      throw new Error("Must be authenticated to subscribe to notifications");
    }

    const url = `${this.client.baseUrl}/api/notifications/stream?token=${encodeURIComponent(
      accessToken,
    )}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as Notification;
        onNotification(notification);
      } catch (error) {
        console.error("Error parsing notification:", error);
      }
    };

    if (onError) {
      eventSource.onerror = onError;
    }

    return () => {
      eventSource.close();
    };
  }

  async getUnreadCount(): Promise<number> {
    const url = `${this.client.baseUrl}/api/notifications/unread/count`;
    const response = await this.fetchWithAuth(url);
    const data = await this.handleResponse<{ count: number }>(response);
    return data.count;
  }

  // Backward compatibility method
  async getUnreadNotificationCount(): Promise<{ count: number }> {
    const url = `${this.client.baseUrl}/api/notifications/unread/count`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ count: number }>(response);
  }
}

// Export as singleton using the main ApiClient instance
export const notificationsModule = new NotificationsModule(apiClient);
export default notificationsModule;
