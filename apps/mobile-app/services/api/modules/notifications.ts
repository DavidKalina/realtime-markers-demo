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

  async getNotifications(
    options?: NotificationOptions,
  ): Promise<Notification[]> {
    const queryParams = new URLSearchParams();
    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.offset)
      queryParams.append("offset", options.offset.toString());
    if (options?.type) queryParams.append("type", options.type);
    if (options?.read !== undefined)
      queryParams.append("read", options.read.toString());

    const url = `${this.client.baseUrl}/api/notifications?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Notification[]>(response);
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

  async deleteNotification(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/notifications/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
  }

  async getNotificationCounts(): Promise<NotificationCounts> {
    const url = `${this.client.baseUrl}/api/notifications/counts`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<NotificationCounts>(response);
  }

  async markAsRead(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/notifications/${id}/read`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    await this.handleResponse<void>(response);
  }

  async markAllAsRead(): Promise<void> {
    const url = `${this.client.baseUrl}/api/notifications/mark-all-read`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    await this.handleResponse<void>(response);
  }

  async deleteNotifications(ids: string[]): Promise<void> {
    const url = `${this.client.baseUrl}/api/notifications`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    await this.handleResponse<void>(response);
  }

  async clearAllNotifications(): Promise<void> {
    const url = `${this.client.baseUrl}/api/notifications`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
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
    const url = `${this.client.baseUrl}/api/notifications/unread-count`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<number>(response);
  }

  // Backward compatibility method
  async getUnreadNotificationCount(): Promise<{ count: number }> {
    const count = await this.getUnreadCount();
    return { count };
  }
}

// Export as singleton using the main ApiClient instance
export const notificationsModule = new NotificationsModule(apiClient);
export default notificationsModule;
