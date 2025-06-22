import { MessageTypes } from "../config/constants";

export interface ErrorMessage {
  type: string;
  message: string;
  timestamp: string;
}

export interface NotificationMessage {
  type: string;
  title: string;
  message: string;
  notificationType: string;
  timestamp: number;
  source: string;
}

export interface DiscoveryMessage {
  type: string;
  event: Record<string, unknown>;
  timestamp: string;
}

export interface CivicEngagementDiscoveryMessage {
  type: string;
  civicEngagement: Record<string, unknown>;
  timestamp: string;
}

export interface LevelUpdateMessage {
  type: string;
  data: {
    userId: string;
    level: number;
    title: string;
    action: string;
    amount: number;
    totalXp: number;
    timestamp: string;
  };
}

/**
 * Formats an error message for WebSocket clients
 */
export function formatErrorMessage(
  message: string,
  timestamp?: string,
): string {
  const errorMessage: ErrorMessage = {
    type: MessageTypes.ERROR,
    message,
    timestamp: timestamp || new Date().toISOString(),
  };
  return JSON.stringify(errorMessage);
}

/**
 * Formats a notification message for WebSocket clients
 */
export function formatNotificationMessage(
  title: string,
  message: string,
  notificationType: string = "info",
  timestamp?: number,
  source: string = "websocket_server",
): string {
  const notificationMessage: NotificationMessage = {
    type: MessageTypes.NOTIFICATION,
    title,
    message,
    notificationType,
    timestamp: timestamp || new Date().getTime(),
    source,
  };
  return JSON.stringify(notificationMessage);
}

/**
 * Formats a discovery event message for WebSocket clients
 */
export function formatDiscoveryMessage(
  event: Record<string, unknown>,
  timestamp?: string,
): string {
  const discoveryMessage: DiscoveryMessage = {
    type: MessageTypes.EVENT_DISCOVERED,
    event,
    timestamp: timestamp || new Date().toISOString(),
  };
  return JSON.stringify(discoveryMessage);
}

/**
 * Formats a civic engagement discovery message for WebSocket clients
 */
export function formatCivicEngagementDiscoveryMessage(
  civicEngagement: Record<string, unknown>,
  timestamp?: string,
): string {
  const discoveryMessage: CivicEngagementDiscoveryMessage = {
    type: MessageTypes.CIVIC_ENGAGEMENT_DISCOVERED,
    civicEngagement,
    timestamp: timestamp || new Date().toISOString(),
  };
  return JSON.stringify(discoveryMessage);
}

/**
 * Formats a level update message for WebSocket clients
 */
export function formatLevelUpdateMessage(
  userId: string,
  level: number,
  title: string,
  action: string,
  amount: number,
  totalXp: number,
  timestamp?: string,
): string {
  const messageType =
    action === "xp_awarded"
      ? MessageTypes.XP_AWARDED
      : MessageTypes.LEVEL_UPDATE;

  const levelUpdateMessage: LevelUpdateMessage = {
    type: messageType,
    data: {
      userId,
      level,
      title,
      action,
      amount,
      totalXp,
      timestamp: timestamp || new Date().toISOString(),
    },
  };
  return JSON.stringify(levelUpdateMessage);
}
