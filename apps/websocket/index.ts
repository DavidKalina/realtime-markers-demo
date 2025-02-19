import Redis from "ioredis";
import type { ServerWebSocket } from "bun";

// Define the type for our WebSocket data
interface WebSocketData {
  clientId: string;
}

// Create Redis client
const redisSub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

redisSub.on("connect", () => {
  console.log("Redis client connected");
});

redisSub.on("error", (err) => {
  console.error("Redis client error:", err);
});

redisSub.on("close", () => {
  console.log("Redis connection closed");
});

// Track connected clients with their IDs
const clients = new Map<string, ServerWebSocket<WebSocketData>>();

// Generate unique client ID
function generateClientId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Subscribe to Redis channel
redisSub.subscribe("marker_changes", (err, count) => {
  if (err) {
    console.error("Failed to subscribe:", err);
  } else {
    console.log(`Subscribed successfully to ${count} channel(s). Listening for marker changes...`);
  }
});

// Broadcast messages to all connected clients
redisSub.on("message", (channel, message) => {
  console.log("Received message on channel:", channel);
  console.log("Message content:", message);

  const payload = JSON.stringify({
    type: "marker_update",
    data: JSON.parse(message),
    timestamp: Date.now(),
  });

  console.log("Broadcasting to clients:", clients.size);

  clients.forEach((client) => {
    try {
      client.send(payload);
      console.log(`Sent to client ${client.data.clientId}`);
    } catch (error) {
      console.error(`Failed to send to client ${client.data.clientId}:`, error);
    }
  });
});

// Broadcast messages to all connected clients
redisSub.on("message", (channel, message) => {
  const payload = JSON.stringify({
    type: "marker_update",
    data: JSON.parse(message),
    timestamp: Date.now(),
  });

  clients.forEach((client) => {
    client.send(payload);
  });
});

Bun.serve({
  port: 8080,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      const clientId = generateClientId();
      // Store clientId in the WebSocket data
      ws.data = { clientId };
      clients.set(clientId, ws);
      console.log(`Client ${clientId} connected. Total clients: ${clients.size}`);

      // Send initial connection confirmation
      ws.send(
        JSON.stringify({
          type: "connection_established",
          clientId,
          instanceId: process.env.HOSTNAME,
        })
      );
    },
    close(ws: ServerWebSocket<WebSocketData>) {
      const clientId = ws.data.clientId;
      clients.delete(clientId);
      console.log(`Client ${clientId} disconnected. Total clients: ${clients.size}`);
    },
    message(ws: ServerWebSocket<WebSocketData>, message: string | Uint8Array) {
      console.log(`Message from ${ws.data.clientId}:`, message);
    },
  },
});

console.log(`WebSocket server started on port 8080`);
