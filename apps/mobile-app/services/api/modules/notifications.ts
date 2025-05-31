import { BaseApiClient } from "../base/ApiClient";
import {
  Notification,
  NotificationCounts,
  NotificationOptions,
  NotificationType,
} from "../base/types";

export class NotificationsModule extends BaseApiClient {
  /**
   * Get notifications for the current user with pagination and filtering
   * @param options - Pagination and filter options
   * @returns Array of notifications
   */
  async getNotifications(
    options: NotificationOptions = {},
  ): Promise<Notification[]> {
    const queryParams = new URLSearchParams();

    if (options.skip) queryParams.append("skip", options.skip.toString());
    if (options.take) queryParams.append("take", options.take.toString());
    if (options.read !== undefined)
      queryParams.append("read", options.read.toString());
    if (options.type) queryParams.append("type", options.type);

    const url = `${this.baseUrl}/api/notifications?${queryParams.toString()}`;
    console.log("Fetching notifications from URL:", url);

    const response = await this.fetchWithAuth(url);
    console.log("Notifications response status:", response.status);

    const data = await this.handleResponse<{
      notifications: Notification[];
      total: number;
    }>(response);
    console.log("Parsed notifications data:", data);

    return data.notifications;
  }

  /**
   * Get notification counts (total, unread, by type)
   * @returns Object containing notification counts
   */
  async getNotificationCounts(): Promise<NotificationCounts> {
    const url = `${this.baseUrl}/api/notifications/counts`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<NotificationCounts>(response);
  }

  /**
   * Get unread notification count
   * @returns Object containing unread count
   */
  async getUnreadNotificationCount(): Promise<{ count: number }> {
    const url = `${this.baseUrl}/api/notifications/unread/count`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{ count: number }>(response);
  }

  /**
   * Mark a specific notification as read
   * @param notificationId - ID of the notification to mark as read
   * @returns Success status
   */
  async markNotificationAsRead(
    notificationId: string,
  ): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/api/notifications/${notificationId}/read`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Mark multiple notifications as read
   * @param notificationIds - Array of notification IDs to mark as read
   * @returns Success status
   */
  async markNotificationsAsRead(
    notificationIds: string[],
  ): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/api/notifications/read`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ notificationIds }),
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Mark all notifications as read
   * @returns Success status
   */
  async markAllNotificationsAsRead(): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/api/notifications/read/all`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Delete a specific notification
   * @param notificationId - ID of the notification to delete
   * @returns Success status
   */
  async deleteNotification(
    notificationId: string,
  ): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/api/notifications/${notificationId}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Delete multiple notifications
   * @param notificationIds - Array of notification IDs to delete
   * @returns Success status
   */
  async deleteNotifications(
    notificationIds: string[],
  ): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/api/notifications`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify({ notificationIds }),
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Clear all notifications
   * @returns Success status
   */
  async clearAllNotifications(): Promise<{ success: boolean }> {
    const url = `${this.baseUrl}/api/notifications`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Get notifications by type
   * @param type - Type of notifications to fetch
   * @param options - Pagination options
   * @returns Array of notifications of the specified type
   */
  async getNotificationsByType(
    type: NotificationType,
    options: Omit<NotificationOptions, "type"> = {},
  ): Promise<Notification[]> {
    return this.getNotifications({ ...options, type });
  }

  /**
   * Subscribe to real-time notifications
   * @param onNotification - Callback function for new notifications
   * @param onError - Optional error callback
   * @returns Function to unsubscribe
   */
  subscribeToNotifications(
    onNotification: (notification: Notification) => void,
    onError?: (error: Event) => void,
  ): () => void {
    const accessToken = this.tokens?.accessToken;
    if (!accessToken) {
      throw new Error("Must be authenticated to subscribe to notifications");
    }

    const url = `${this.baseUrl}/api/notifications/stream?token=${encodeURIComponent(
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

    eventSource.onerror = (error) => {
      console.error("Notification stream error:", error);
      if (onError) onError(error);
      eventSource.close();
    };

    // Return unsubscribe function
    return () => {
      eventSource.close();
    };
  }
}

// Export as singleton
export const notificationsModule = new NotificationsModule();
export default notificationsModule;
