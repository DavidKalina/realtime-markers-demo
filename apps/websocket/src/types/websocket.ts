import type { ServerWebSocket } from "bun";
import type { ClientType } from "../../../filter-processor/src/types/types";

export interface WebSocketData {
  clientId: string;
  userId?: string;
  lastActivity: number;
  sessionId?: string;
  clientType?: ClientType;
}

export interface SystemHealth {
  backendConnected: boolean;
  redisConnected: boolean;
  filterProcessorConnected: boolean;
  lastBackendCheck: number;
  lastRedisCheck: number;
  lastFilterProcessorCheck: number;
  connectedClients: number;
  connectedUsers: number;
}

export interface ViewportData {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ClientMessage {
  type: string;
  userId?: string;
  viewport?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ClientIdentificationData {
  userId: string;
  clientType?: ClientType;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  retryStrategy: (times: number) => number;
}

export type WebSocketHandler = (
  ws: ServerWebSocket<WebSocketData>,
  message: string,
) => Promise<void>;
export type MessageHandlers = Record<string, WebSocketHandler>;
