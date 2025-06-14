import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { REDIS_CHANNELS, MessageTypes } from "../src/config/constants";
import { handleRedisMessage } from "../src/handlers/redisMessageHandler";
import type { ConnectionHandler } from "../src/handlers/connectionHandler";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../src/types/websocket";

// Mock ConnectionHandler type
type MockConnectionHandler = {
  getUserClients: jest.Mock;
  getClient: jest.Mock;
};

// Mock ConnectionHandler
const mockConnectionHandler: MockConnectionHandler = {
  getUserClients: jest.fn(),
  getClient: jest.fn(),
};

// Mock WebSocket
const createMockWebSocket = (
  clientId: string,
  userId?: string,
): ServerWebSocket<WebSocketData> & { send: jest.Mock } => {
  const mockSend = jest.fn();
  return {
    data: {
      clientId,
      userId,
      lastActivity: Date.now(),
    },
    send: mockSend,
    close: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    isSubscribed: jest.fn(),
    cork: jest.fn(),
    readyState: 1,
    url: "ws://localhost:8081",
    protocol: "",
    remoteAddress: "127.0.0.1",
    binaryType: "arraybuffer",
    bufferedAmount: 0,
    extensions: "",
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    sendText: jest.fn(),
    sendBinary: jest.fn(),
    terminate: jest.fn(),
    ping: jest.fn(),
    pong: jest.fn(),
    publishText: jest.fn(),
    publishBinary: jest.fn(),
    getBufferedAmount: jest.fn(),
  } as unknown as ServerWebSocket<WebSocketData> & { send: jest.Mock };
};

// Mock console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe("Redis Message Handling", () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let consoleWarns: string[] = [];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Capture console output
    consoleLogs = [];
    consoleErrors = [];
    consoleWarns = [];

    console.log = jest.fn((...args) => {
      consoleLogs.push(args.join(" "));
      originalConsoleLog(...args);
    });

    console.error = jest.fn((...args) => {
      consoleErrors.push(args.join(" "));
      originalConsoleError(...args);
    });

    console.warn = jest.fn((...args) => {
      consoleWarns.push(args.join(" "));
      originalConsoleWarn(...args);
    });
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe("Discovered Events Channel", () => {
    it("should handle valid discovered event and send to user clients", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const eventData = {
        event: {
          creatorId: userId,
          eventId: "event-456",
          title: "Test Event",
          description: "Test Description",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.DISCOVERED_EVENTS,
        JSON.stringify(eventData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(mockConnectionHandler.getUserClients).toHaveBeenCalledWith(userId);
      expect(mockConnectionHandler.getClient).toHaveBeenCalledWith(clientId);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(MessageTypes.EVENT_DISCOVERED),
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(eventData.event.eventId),
      );
    });

    it("should handle discovered event with missing creatorId", () => {
      const eventData = {
        event: {
          eventId: "event-456",
          title: "Test Event",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.DISCOVERED_EVENTS,
        JSON.stringify(eventData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleErrors.some((error) =>
          error.includes("Invalid discovered event data"),
        ),
      ).toBe(true);
      expect(mockConnectionHandler.getUserClients).not.toHaveBeenCalled();
    });

    it("should handle discovered event when no clients are found", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";

      mockConnectionHandler.getUserClients.mockReturnValue(null);

      const eventData = {
        event: {
          creatorId: userId,
          eventId: "event-456",
          title: "Test Event",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.DISCOVERED_EVENTS,
        JSON.stringify(eventData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleLogs.some((log) => log.includes("No clients found for user")),
      ).toBe(true);
      expect(mockConnectionHandler.getClient).not.toHaveBeenCalled();
    });

    it("should handle discovered event when client send fails", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);
      const sendError = new Error("Send failed");

      (mockWs.send as jest.Mock).mockImplementation(() => {
        throw sendError;
      });

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const eventData = {
        event: {
          creatorId: userId,
          eventId: "event-456",
          title: "Test Event",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.DISCOVERED_EVENTS,
        JSON.stringify(eventData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleErrors.some((error) =>
          error.includes("Error sending discovery event to client"),
        ),
      ).toBe(true);
    });
  });

  describe("Notifications Channel", () => {
    it("should handle valid notification and send to user clients", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const notificationData = {
        notification: {
          userId: userId,
          title: "Test Notification",
          message: "Test message",
          type: "info",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.NOTIFICATIONS,
        JSON.stringify(notificationData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(mockConnectionHandler.getUserClients).toHaveBeenCalledWith(userId);
      expect(mockConnectionHandler.getClient).toHaveBeenCalledWith(clientId);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(MessageTypes.NOTIFICATION),
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Test Notification"),
      );
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining("info"));
    });

    it("should handle notification with missing userId", () => {
      const notificationData = {
        notification: {
          title: "Test Notification",
          message: "Test message",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.NOTIFICATIONS,
        JSON.stringify(notificationData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleErrors.some((error) =>
          error.includes("Invalid notification data"),
        ),
      ).toBe(true);
      expect(mockConnectionHandler.getUserClients).not.toHaveBeenCalled();
    });

    it("should handle notification with default type when not provided", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const notificationData = {
        notification: {
          userId: userId,
          title: "Test Notification",
          message: "Test message",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.NOTIFICATIONS,
        JSON.stringify(notificationData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("notificationType"),
      );
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining("info"));
    });

    it("should handle notification when no clients are found", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";

      mockConnectionHandler.getUserClients.mockReturnValue(null);

      const notificationData = {
        notification: {
          userId: userId,
          title: "Test Notification",
          message: "Test message",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.NOTIFICATIONS,
        JSON.stringify(notificationData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleLogs.some((log) => log.includes("No clients found for user")),
      ).toBe(true);
    });
  });

  describe("Level Update Channel", () => {
    it("should handle valid level update and send to user clients", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const levelData = {
        userId: userId,
        level: 5,
        title: "Level Up!",
        action: "level_up",
        amount: 100,
        totalXp: 1500,
        timestamp: "2024-01-01T00:00:00.000Z",
      };

      handleRedisMessage(
        REDIS_CHANNELS.LEVEL_UPDATE,
        JSON.stringify(levelData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(mockConnectionHandler.getUserClients).toHaveBeenCalledWith(userId);
      expect(mockConnectionHandler.getClient).toHaveBeenCalledWith(clientId);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(MessageTypes.LEVEL_UPDATE),
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("level"),
      );
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining("5"));
    });

    it("should handle XP awarded action with correct message type", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const levelData = {
        userId: userId,
        level: 5,
        title: "XP Awarded!",
        action: "xp_awarded",
        amount: 50,
        totalXp: 1550,
      };

      handleRedisMessage(
        REDIS_CHANNELS.LEVEL_UPDATE,
        JSON.stringify(levelData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(MessageTypes.XP_AWARDED),
      );
    });

    it("should handle level update with missing userId", () => {
      const levelData = {
        level: 5,
        title: "Level Up!",
        action: "level_up",
        amount: 100,
        totalXp: 1500,
      };

      handleRedisMessage(
        REDIS_CHANNELS.LEVEL_UPDATE,
        JSON.stringify(levelData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleErrors.some((error) =>
          error.includes("Invalid level update data"),
        ),
      ).toBe(true);
      expect(mockConnectionHandler.getUserClients).not.toHaveBeenCalled();
    });

    it("should handle level update with generated timestamp when not provided", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const levelData = {
        userId: userId,
        level: 5,
        title: "Level Up!",
        action: "level_up",
        amount: 100,
        totalXp: 1500,
      };

      handleRedisMessage(
        REDIS_CHANNELS.LEVEL_UPDATE,
        JSON.stringify(levelData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("timestamp"),
      );
    });

    it("should handle level update when no clients are found", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";

      mockConnectionHandler.getUserClients.mockReturnValue(null);

      const levelData = {
        userId: userId,
        level: 5,
        title: "Level Up!",
        action: "level_up",
        amount: 100,
        totalXp: 1500,
      };

      handleRedisMessage(
        REDIS_CHANNELS.LEVEL_UPDATE,
        JSON.stringify(levelData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleLogs.some((log) => log.includes("No clients found for user")),
      ).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid JSON in message", () => {
      const invalidJson = "invalid json {";

      handleRedisMessage(
        REDIS_CHANNELS.NOTIFICATIONS,
        invalidJson,
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleErrors.some((error) =>
          error.includes("Error processing message from notifications"),
        ),
      ).toBe(true);
    });

    it("should handle unknown Redis channel", () => {
      const data = { test: "data" };

      handleRedisMessage(
        "unknown_channel",
        JSON.stringify(data),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(
        consoleWarns.some((warn) =>
          warn.includes("Unhandled Redis channel: unknown_channel"),
        ),
      ).toBe(true);
    });

    it("should handle multiple clients for a user", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId1 = "client-123";
      const clientId2 = "client-456";
      const mockWs1 = createMockWebSocket(clientId1, userId);
      const mockWs2 = createMockWebSocket(clientId2, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([
        clientId1,
        clientId2,
      ]);
      mockConnectionHandler.getClient
        .mockReturnValueOnce(mockWs1)
        .mockReturnValueOnce(mockWs2);

      const notificationData = {
        notification: {
          userId: userId,
          title: "Test Notification",
          message: "Test message",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.NOTIFICATIONS,
        JSON.stringify(notificationData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
      expect(mockConnectionHandler.getClient).toHaveBeenCalledTimes(2);
    });

    it("should handle null client from connection handler", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(null);

      const notificationData = {
        notification: {
          userId: userId,
          title: "Test Notification",
          message: "Test message",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.NOTIFICATIONS,
        JSON.stringify(notificationData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      // Should not throw error, just skip sending
      expect(consoleErrors).toHaveLength(0);
    });
  });

  describe("Message Format Validation", () => {
    it("should validate discovered event message format", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const eventData = {
        event: {
          creatorId: userId,
          eventId: "event-456",
          title: "Test Event",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.DISCOVERED_EVENTS,
        JSON.stringify(eventData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      const sentMessage = JSON.parse(
        (mockWs.send as jest.Mock).mock.calls[0][0],
      );
      expect(sentMessage.type).toBe(MessageTypes.EVENT_DISCOVERED);
      expect(sentMessage.event).toEqual(eventData.event);
      expect(sentMessage.timestamp).toBeDefined();
    });

    it("should validate notification message format", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const notificationData = {
        notification: {
          userId: userId,
          title: "Test Notification",
          message: "Test message",
          type: "warning",
        },
      };

      handleRedisMessage(
        REDIS_CHANNELS.NOTIFICATIONS,
        JSON.stringify(notificationData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      const sentMessage = JSON.parse(
        (mockWs.send as jest.Mock).mock.calls[0][0],
      );
      expect(sentMessage.type).toBe(MessageTypes.NOTIFICATION);
      expect(sentMessage.title).toBe("Test Notification");
      expect(sentMessage.message).toBe("Test message");
      expect(sentMessage.notificationType).toBe("warning");
      expect(sentMessage.timestamp).toBeDefined();
      expect(sentMessage.source).toBe("websocket_server");
    });

    it("should validate level update message format", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const clientId = "client-123";
      const mockWs = createMockWebSocket(clientId, userId);

      mockConnectionHandler.getUserClients.mockReturnValue([clientId]);
      mockConnectionHandler.getClient.mockReturnValue(mockWs);

      const levelData = {
        userId: userId,
        level: 5,
        title: "Level Up!",
        action: "level_up",
        amount: 100,
        totalXp: 1500,
        timestamp: "2024-01-01T00:00:00.000Z",
      };

      handleRedisMessage(
        REDIS_CHANNELS.LEVEL_UPDATE,
        JSON.stringify(levelData),
        mockConnectionHandler as unknown as ConnectionHandler,
      );

      const sentMessage = JSON.parse(
        (mockWs.send as jest.Mock).mock.calls[0][0],
      );
      expect(sentMessage.type).toBe(MessageTypes.LEVEL_UPDATE);
      expect(sentMessage.data.userId).toBe(userId);
      expect(sentMessage.data.level).toBe(5);
      expect(sentMessage.data.title).toBe("Level Up!");
      expect(sentMessage.data.action).toBe("level_up");
      expect(sentMessage.data.amount).toBe(100);
      expect(sentMessage.data.totalXp).toBe(1500);
      expect(sentMessage.data.timestamp).toBe("2024-01-01T00:00:00.000Z");
    });
  });
});
