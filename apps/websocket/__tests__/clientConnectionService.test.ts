/* eslint-disable quotes */
import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createClientConnectionService } from "../src/services/clientConnectionService";
import { SessionManager } from "../SessionManager";
import { RedisService } from "../src/services/redisService";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../src/types/websocket";

describe("ClientConnectionService", () => {
  let clientConnectionService: ReturnType<typeof createClientConnectionService>;
  let mockSessionManager: SessionManager;
  let mockRedisService: RedisService;
  let mockWebSocket: ServerWebSocket<WebSocketData>;

  beforeEach(() => {
    // Create mock dependencies
    mockSessionManager = {
      registerClient: mock(() => {}),
      unregisterClient: mock(() => Promise.resolve()),
      handleMessage: mock(() => Promise.resolve()),
    } as unknown as SessionManager;

    mockRedisService = {
      subscribe: mock(() => Promise.resolve()),
      unsubscribe: mock(() => Promise.resolve()),
      publish: mock(() => Promise.resolve()),
      getUserSubscriber: mock(() => ({
        on: mock(() => {}),
      })),
      releaseUserSubscriber: mock(() => {}),
    } as unknown as RedisService;

    // Create mock WebSocket
    mockWebSocket = {
      data: {
        clientId: "",
        userId: "test-user-1",
        lastActivity: Date.now(),
      },
      send: mock(() => {}),
      close: mock(() => {}),
    } as unknown as ServerWebSocket<WebSocketData>;

    // Create the service instance
    clientConnectionService = createClientConnectionService({
      sessionManager: mockSessionManager,
      redisService: mockRedisService,
    });
  });

  describe("Batch Update Message Transformation", () => {
    test("should transform batch-update with events to replace-all", () => {
      const userId = "test-user-1";

      // Register a client (this will generate a client ID)
      clientConnectionService.registerClient(mockWebSocket);

      // Get the generated client ID from the WebSocket data
      const clientId = mockWebSocket.data.clientId;
      expect(clientId).toBeTruthy();

      // Add the user-client association
      clientConnectionService.addUserClient(userId, clientId);

      const batchUpdateMessage = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: [
            {
              id: "event-1",
              title: "Test Event 1",
              location: { coordinates: [-122.4194, 37.7749] },
              eventDate: "2024-01-15T10:00:00Z",
              scanCount: 5,
              saveCount: 2,
              isPrivate: false,
              creatorId: "user-1",
              sharedWith: [],
              isRecurring: false,
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
            {
              id: "event-2",
              title: "Test Event 2",
              location: { coordinates: [-122.4195, 37.775] },
              eventDate: "2024-01-15T11:00:00Z",
              scanCount: 3,
              saveCount: 1,
              isPrivate: false,
              creatorId: "user-1",
              sharedWith: [],
              isRecurring: false,
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          ],
          updates: [],
          deletes: [],
        },
        summary: {
          totalEvents: 2,
          newEvents: 2,
          updatedEvents: 0,
          deletedEvents: 0,
        },
      };

      // Forward the message
      clientConnectionService.forwardMessageToUserClients(
        userId,
        JSON.stringify(batchUpdateMessage),
      );

      // Should have sent a replace-all message
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"replace-all"'),
      );

      // Should have included both events
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"event-1"'),
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"event-2"'),
      );
    });

    test("should transform batch-update with empty events array to replace-all", () => {
      const userId = "test-user-1";

      // Register a client (this will generate a client ID)
      clientConnectionService.registerClient(mockWebSocket);

      // Get the generated client ID from the WebSocket data
      const clientId = mockWebSocket.data.clientId;
      expect(clientId).toBeTruthy();

      // Add the user-client association
      clientConnectionService.addUserClient(userId, clientId);

      const batchUpdateMessage = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: [], // Empty array - this should clear markers
          updates: [],
          deletes: [],
        },
        summary: {
          totalEvents: 0,
          newEvents: 0,
          updatedEvents: 0,
          deletedEvents: 0,
        },
      };

      // Forward the message
      clientConnectionService.forwardMessageToUserClients(
        userId,
        JSON.stringify(batchUpdateMessage),
      );

      // Should have sent a replace-all message with empty events array
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"replace-all"'),
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"events":[]'),
      );
    });

    test("should transform batch-update with undefined creates to replace-all", () => {
      const userId = "test-user-1";

      // Register a client (this will generate a client ID)
      clientConnectionService.registerClient(mockWebSocket);

      // Get the generated client ID from the WebSocket data
      const clientId = mockWebSocket.data.clientId;
      expect(clientId).toBeTruthy();

      // Add the user-client association
      clientConnectionService.addUserClient(userId, clientId);

      // Clear mock calls from registration
      (mockWebSocket.send as ReturnType<typeof mock>).mockClear();

      const batchUpdateMessage = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: undefined, // Undefined creates array
          updates: [],
          deletes: [],
        },
        summary: {
          totalEvents: 0,
          newEvents: 0,
          updatedEvents: 0,
          deletedEvents: 0,
        },
      };

      // Forward the message
      clientConnectionService.forwardMessageToUserClients(
        userId,
        JSON.stringify(batchUpdateMessage),
      );

      // Should have forwarded the original message since creates is undefined
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(batchUpdateMessage),
      );
    });

    test("should transform batch-update with updates to update-event messages", () => {
      const userId = "test-user-1";

      // Register a client (this will generate a client ID)
      clientConnectionService.registerClient(mockWebSocket);

      // Get the generated client ID from the WebSocket data
      const clientId = mockWebSocket.data.clientId;
      expect(clientId).toBeTruthy();

      // Add the user-client association
      clientConnectionService.addUserClient(userId, clientId);

      // Clear mock calls from registration
      (mockWebSocket.send as ReturnType<typeof mock>).mockClear();

      const batchUpdateMessage = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: [],
          updates: [
            {
              id: "event-1",
              title: "Updated Event 1",
              location: { coordinates: [-122.4194, 37.7749] },
              eventDate: "2024-01-15T10:00:00Z",
              scanCount: 6,
              saveCount: 3,
              isPrivate: false,
              creatorId: "user-1",
              sharedWith: [],
              isRecurring: false,
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          ],
          deletes: [],
        },
        summary: {
          totalEvents: 1,
          newEvents: 0,
          updatedEvents: 1,
          deletedEvents: 0,
        },
      };

      // Forward the message
      clientConnectionService.forwardMessageToUserClients(
        userId,
        JSON.stringify(batchUpdateMessage),
      );

      // Should have sent an update-event message
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"update-event"'),
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"Updated Event 1"'),
      );
    });

    test("should transform batch-update with deletes to delete-event messages", () => {
      const userId = "test-user-1";

      // Register a client (this will generate a client ID)
      clientConnectionService.registerClient(mockWebSocket);

      // Get the generated client ID from the WebSocket data
      const clientId = mockWebSocket.data.clientId;
      expect(clientId).toBeTruthy();

      // Add the user-client association
      clientConnectionService.addUserClient(userId, clientId);

      // Clear mock calls from registration
      (mockWebSocket.send as ReturnType<typeof mock>).mockClear();

      const batchUpdateMessage = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: [],
          updates: [],
          deletes: ["event-1", "event-2"],
        },
        summary: {
          totalEvents: 2,
          newEvents: 0,
          updatedEvents: 0,
          deletedEvents: 2,
        },
      };

      // Forward the message
      clientConnectionService.forwardMessageToUserClients(
        userId,
        JSON.stringify(batchUpdateMessage),
      );

      // Should have sent delete-event messages for each deleted event
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);

      // Check that both delete-event messages were sent
      const calls = (mockWebSocket.send as ReturnType<typeof mock>).mock.calls;
      expect(calls[0][0]).toContain('"type":"delete-event"');
      expect(calls[0][0]).toContain('"id":"event-1"');
      expect(calls[1][0]).toContain('"type":"delete-event"');
      expect(calls[1][0]).toContain('"id":"event-2"');
    });

    test("should forward non-batch-update messages as-is", () => {
      const userId = "test-user-1";

      // Register a client (this will generate a client ID)
      clientConnectionService.registerClient(mockWebSocket);

      // Get the generated client ID from the WebSocket data
      const clientId = mockWebSocket.data.clientId;
      expect(clientId).toBeTruthy();

      // Add the user-client association
      clientConnectionService.addUserClient(userId, clientId);

      const regularMessage = {
        type: "some-other-message",
        data: "test data",
        timestamp: new Date().toISOString(),
      };

      // Forward the message
      clientConnectionService.forwardMessageToUserClients(
        userId,
        JSON.stringify(regularMessage),
      );

      // Should have forwarded the original message
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(regularMessage),
      );
    });

    test("should handle multiple clients for the same user", () => {
      const userId = "test-user-1";

      // Create second mock WebSocket
      const mockWebSocket2 = {
        data: {
          clientId: "",
          userId: userId,
          lastActivity: Date.now(),
        },
        send: mock(() => {}),
        close: mock(() => {}),
      } as unknown as ServerWebSocket<WebSocketData>;

      // Register both clients
      clientConnectionService.registerClient(mockWebSocket);
      clientConnectionService.registerClient(mockWebSocket2);

      // Get the generated client IDs
      const clientId1 = mockWebSocket.data.clientId;
      const clientId2 = mockWebSocket2.data.clientId;
      expect(clientId1).toBeTruthy();
      expect(clientId2).toBeTruthy();

      // Add the user-client associations
      clientConnectionService.addUserClient(userId, clientId1);
      clientConnectionService.addUserClient(userId, clientId2);

      const batchUpdateMessage = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: [],
          updates: [],
          deletes: [],
        },
        summary: {
          totalEvents: 0,
          newEvents: 0,
          updatedEvents: 0,
          deletedEvents: 0,
        },
      };

      // Forward the message
      clientConnectionService.forwardMessageToUserClients(
        userId,
        JSON.stringify(batchUpdateMessage),
      );

      // Both clients should receive the message
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket2.send).toHaveBeenCalled();
    });

    test("should handle missing clients gracefully", () => {
      const userId = "test-user-1";
      const clientId = "non-existent-client";

      // Add user but don't register the client
      clientConnectionService.addUserClient(userId, clientId);

      const batchUpdateMessage = {
        type: "batch-update",
        timestamp: new Date().toISOString(),
        updates: {
          creates: [],
          updates: [],
          deletes: [],
        },
        summary: {
          totalEvents: 0,
          newEvents: 0,
          updatedEvents: 0,
          deletedEvents: 0,
        },
      };

      // Forward the message - should not throw
      expect(() => {
        clientConnectionService.forwardMessageToUserClients(
          userId,
          JSON.stringify(batchUpdateMessage),
        );
      }).not.toThrow();
    });
  });

  describe("Client Management", () => {
    test("should register and unregister clients", () => {
      const userId = "test-user-1";

      // Register client
      clientConnectionService.registerClient(mockWebSocket);

      // Get the generated client ID
      const clientId = mockWebSocket.data.clientId;
      expect(clientId).toBeTruthy();

      // Add the user-client association
      clientConnectionService.addUserClient(userId, clientId);

      // Check that client is registered
      expect(
        clientConnectionService.getUserClients(userId)?.has(clientId),
      ).toBe(true);
      expect(clientConnectionService.getClient(clientId)).toBe(mockWebSocket);

      // Unregister client
      clientConnectionService.removeUserClient(userId, clientId);

      // Check that client is unregistered from user mapping
      expect(
        clientConnectionService.getUserClients(userId)?.has(clientId),
      ).toBe(false);
      // Client should still exist in the main client map until unregisterClient is called
      expect(clientConnectionService.getClient(clientId)).toBe(mockWebSocket);
    });

    test("should track connected clients and users", () => {
      const userId1 = "test-user-1";
      const userId2 = "test-user-2";

      // Create additional mock WebSockets
      const mockWebSocket2 = {
        data: {
          clientId: "",
          userId: userId1,
          lastActivity: Date.now(),
        },
        send: mock(() => {}),
        close: mock(() => {}),
      } as unknown as ServerWebSocket<WebSocketData>;

      const mockWebSocket3 = {
        data: {
          clientId: "",
          userId: userId2,
          lastActivity: Date.now(),
        },
        send: mock(() => {}),
        close: mock(() => {}),
      } as unknown as ServerWebSocket<WebSocketData>;

      // Register multiple clients
      clientConnectionService.registerClient(mockWebSocket);
      clientConnectionService.registerClient(mockWebSocket2);
      clientConnectionService.registerClient(mockWebSocket3);

      // Get the generated client IDs
      const clientId1 = mockWebSocket.data.clientId;
      const clientId2 = mockWebSocket2.data.clientId;
      const clientId3 = mockWebSocket3.data.clientId;

      // Add the user-client associations
      clientConnectionService.addUserClient(userId1, clientId1);
      clientConnectionService.addUserClient(userId1, clientId2);
      clientConnectionService.addUserClient(userId2, clientId3);

      // Check counts
      expect(clientConnectionService.getConnectedClientsCount()).toBe(3);
      expect(clientConnectionService.getConnectedUsersCount()).toBe(2);
    });
  });
});
