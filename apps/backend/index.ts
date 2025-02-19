import Redis from "ioredis";
import { WebSocketServer } from "ws";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: 5432,
});

// Create two separate Redis clients
const redisSub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

const redisPub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Client connected");

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Client disconnected");
  });
});

// Use redisSub for subscribing
redisSub.subscribe("marker_changes", (err, count) => {
  if (err) {
    console.error("Failed to subscribe:", err);
  } else {
    console.log(`Subscribed to ${count} channel(s)`);
  }
});

redisSub.on("message", (channel, message) => {
  clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});

export default {
  port: process.env.PORT || 3000,
  async fetch(req: Request) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api")) {
      const route = url.pathname.replace("/api", "");

      switch (route) {
        case "/markers":
          if (req.method === "GET") {
            try {
              const result = await pool.query(`
                SELECT 
                  id,
                  ST_AsGeoJSON(location)::json as location,
                  emoji,
                  color,
                  created_at,
                  updated_at
                FROM markers
                ORDER BY created_at DESC
              `);
              return Response.json(result.rows);
            } catch (error) {
              console.error("Database error:", error);
              return Response.json({ error: "Failed to fetch markers" }, { status: 500 });
            }
          }

          if (req.method === "POST") {
            try {
              const rawBody = await req.text();
              let data;
              try {
                data = JSON.parse(rawBody);
              } catch (parseError: any) {
                console.error("JSON Parse Error:", parseError);
                return Response.json(
                  {
                    error: "Invalid JSON",
                    details: parseError.message,
                    receivedBody: rawBody,
                  },
                  { status: 400 }
                );
              }

              // Validate input
              if (!data.location?.coordinates || !data.emoji || !data.color) {
                return Response.json(
                  { error: "Missing required fields", receivedData: data },
                  { status: 400 }
                );
              }

              const result = await pool.query(
                `INSERT INTO markers (location, emoji, color)
                 VALUES (ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), $2, $3)
                 RETURNING id, ST_AsGeoJSON(location)::json as location, emoji, color, created_at, updated_at`,
                [JSON.stringify(data.location), data.emoji, data.color]
              );

              const newMarker = result.rows[0];

              // Use redisPub for publishing
              await redisPub.publish(
                "marker_changes",
                JSON.stringify({
                  operation: "INSERT",
                  record: newMarker,
                })
              );

              return Response.json(newMarker);
            } catch (error: any) {
              console.error("Full error:", error);
              return Response.json(
                { error: "Failed to create marker", details: error.message },
                { status: 500 }
              );
            }
          }

          return Response.json({ error: "Method not allowed" }, { status: 405 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
