import { describe, it, expect, beforeEach, jest } from "bun:test";
import {
  validateAndFormatViewport,
  handleViewportUpdate,
} from "../src/handlers/viewportHandler";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../src/types/websocket";

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

describe("Viewport Handler", () => {
  describe("validateAndFormatViewport", () => {
    it("should validate and format valid viewport data", () => {
      const viewportData = {
        west: -122.4194,
        south: 37.7749,
        east: -122.4,
        north: 37.8,
      };

      const result = validateAndFormatViewport(viewportData, "client-123");

      expect(result.isValid).toBe(true);
      expect(result.viewport).toEqual({
        minX: -122.4194,
        minY: 37.7749,
        maxX: -122.4,
        maxY: 37.8,
      });
    });

    it("should reject null viewport data", () => {
      const result = validateAndFormatViewport(null, "client-123");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "Invalid viewport data from client client-123",
      );
    });

    it("should reject non-object viewport data", () => {
      const result = validateAndFormatViewport("invalid", "client-123");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "Invalid viewport data from client client-123",
      );
    });

    it("should reject viewport with missing coordinates", () => {
      const viewportData = {
        west: -122.4194,
        south: 37.7749,
        // missing east and north
      };

      const result = validateAndFormatViewport(viewportData, "client-123");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "Invalid viewport coordinates from client client-123",
      );
    });

    it("should reject viewport with non-numeric coordinates", () => {
      const viewportData = {
        west: "invalid",
        south: 37.7749,
        east: -122.4,
        north: 37.8,
      };

      const result = validateAndFormatViewport(viewportData, "client-123");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "Invalid viewport coordinates from client client-123",
      );
    });

    it("should reject longitude values outside valid range", () => {
      const viewportData = {
        west: -200, // Invalid longitude
        south: 37.7749,
        east: -122.4,
        north: 37.8,
      };

      const result = validateAndFormatViewport(viewportData, "client-123");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid west coordinate: -200");
    });

    it("should reject latitude values outside valid range", () => {
      const viewportData = {
        west: -122.4194,
        south: 100, // Invalid latitude
        east: -122.4,
        north: 37.8,
      };

      const result = validateAndFormatViewport(viewportData, "client-123");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid south coordinate: 100");
    });

    it("should reject when west >= east", () => {
      const viewportData = {
        west: -122.4,
        south: 37.7749,
        east: -122.4194, // Less than west
        north: 37.8,
      };

      const result = validateAndFormatViewport(viewportData, "client-123");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "West coordinate (-122.4) must be less than east coordinate (-122.4194)",
      );
    });

    it("should reject when south >= north", () => {
      const viewportData = {
        west: -122.4194,
        south: 37.8, // Greater than north
        east: -122.4,
        north: 37.7749,
      };

      const result = validateAndFormatViewport(viewportData, "client-123");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "South coordinate (37.8) must be less than north coordinate (37.7749)",
      );
    });

    it("should handle edge cases with valid coordinates", () => {
      const viewportData = {
        west: -180,
        south: -90,
        east: 180,
        north: 90,
      };

      const result = validateAndFormatViewport(viewportData, "client-123");

      expect(result.isValid).toBe(true);
      expect(result.viewport).toEqual({
        minX: -180,
        minY: -90,
        maxX: 180,
        maxY: 90,
      });
    });
  });

  describe("handleViewportUpdate", () => {
    let mockUpdateViewport: jest.Mock;

    beforeEach(() => {
      mockUpdateViewport = jest.fn();
    });

    it("should handle valid viewport update for identified user", async () => {
      const mockWs = createMockWebSocket("client-123", "user-456");
      const viewportData = {
        west: -122.4194,
        south: 37.7749,
        east: -122.4,
        north: 37.8,
      };

      await handleViewportUpdate(mockWs, viewportData, mockUpdateViewport);

      expect(mockUpdateViewport).toHaveBeenCalledWith("user-456", {
        minX: -122.4194,
        minY: 37.7749,
        maxX: -122.4,
        maxY: 37.8,
      });
    });

    it("should handle viewport update for unidentified user", async () => {
      const mockWs = createMockWebSocket("client-123"); // No userId
      const viewportData = {
        west: -122.4194,
        south: 37.7749,
        east: -122.4,
        north: 37.8,
      };

      await handleViewportUpdate(mockWs, viewportData, mockUpdateViewport);

      expect(mockUpdateViewport).not.toHaveBeenCalled();
    });

    it("should handle invalid viewport data", async () => {
      const mockWs = createMockWebSocket("client-123", "user-456");
      const invalidViewportData = null;

      await handleViewportUpdate(
        mockWs,
        invalidViewportData,
        mockUpdateViewport,
      );

      expect(mockUpdateViewport).not.toHaveBeenCalled();
    });
  });
});
