// apps/filter-processor/src/utils/healthCheck.ts
import { createServer } from "http";
import Redis from "ioredis";

interface HealthCheckOptions {
  redisPub: Redis;
  port: number;
}

interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    redis: {
      connected: boolean;
      lastChecked: string;
    };
    backend: {
      connected: boolean;
      lastChecked: string;
      url: string;
    };
  };
  metrics: {
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
}

/**
 * Initialize the health check endpoint
 */
export function initializeHealthCheck(options: HealthCheckOptions) {
  const { redisPub, port } = options;
  const startTime = Date.now();

  // Service version from package.json or environment variable
  const version = process.env.npm_package_version || "0.1.0";

  // Get backend URL from environment
  const backendUrl = process.env.BACKEND_URL || "http://backend:3000";

  // Track service health - initialize as true to allow startup
  let redisConnected = true;
  let lastRedisCheck = new Date().toISOString();
  let backendConnected = true;
  let lastBackendCheck = new Date().toISOString();

  // Periodically check Redis connection
  const checkRedisInterval = setInterval(async () => {
    try {
      const pong = await redisPub.ping();
      redisConnected = pong === "PONG";
      lastRedisCheck = new Date().toISOString();
      console.log(
        `Redis health check: ${redisConnected ? "connected" : "disconnected"}`,
      );
    } catch (error) {
      redisConnected = false;
      lastRedisCheck = new Date().toISOString();
      console.error("Redis health check failed:", error);
    }
  }, 30000); // Check every 30 seconds

  // Periodically check backend API connection
  const checkBackendInterval = setInterval(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/health`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      backendConnected = response.ok;
      lastBackendCheck = new Date().toISOString();
      console.log(
        `Backend health check: ${backendConnected ? "connected" : "disconnected"}`,
      );
    } catch (error) {
      backendConnected = false;
      lastBackendCheck = new Date().toISOString();
      console.error("Backend health check failed:", error);
    }
  }, 30000); // Check every 30 seconds

  // Create HTTP server for health check
  const server = createServer((req, res) => {
    console.log(`Health request received: ${req.url}`);

    // Allow any path for health checks initially
    // This makes it more robust during startup
    const isHealthRequest =
      req.url === "/health" || req.url === "/" || req.url === "/healthz";

    if (isHealthRequest) {
      // Determine overall health status
      let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";

      if (!redisConnected && !backendConnected) {
        overallStatus = "unhealthy";
      } else if (!redisConnected || !backendConnected) {
        overallStatus = "degraded";
      }

      // Get current health status
      const status: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version,
        services: {
          redis: {
            connected: redisConnected,
            lastChecked: lastRedisCheck,
          },
          backend: {
            connected: backendConnected,
            lastChecked: lastBackendCheck,
            url: backendUrl,
          },
        },
        metrics: {
          memoryUsage: process.memoryUsage(),
        },
      };

      const statusCode = overallStatus === "healthy" ? 200 : 503;
      res.writeHead(statusCode, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(status, null, 2));
    } else if (req.url === "/metrics") {
      // Basic metrics endpoint for monitoring
      const metrics = {
        memory_usage_rss: process.memoryUsage().rss,
        memory_usage_heap_total: process.memoryUsage().heapTotal,
        memory_usage_heap_used: process.memoryUsage().heapUsed,
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        redis_connected: redisConnected ? 1 : 0,
        backend_connected: backendConnected ? 1 : 0,
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(metrics, null, 2));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  return {
    startHealthServer: () => {
      server.listen(port, "0.0.0.0", () => {
        console.log(
          `🩺 Health check server running on port ${port}, accessible at http://0.0.0.0:${port}/health`,
        );
      });
    },
    stopHealthServer: () => {
      clearInterval(checkRedisInterval);
      clearInterval(checkBackendInterval);
      server.close();
    },
  };
}
