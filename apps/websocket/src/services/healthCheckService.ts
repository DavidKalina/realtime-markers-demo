import type { SystemHealth } from "../types/websocket";

export interface HealthCheckService {
  checkRedisConnection: () => Promise<boolean>;
  checkBackendConnection: () => Promise<boolean>;
  checkFilterProcessorConnection: () => Promise<boolean>;
  updateHealthStats: (connectedClients: number, connectedUsers: number) => void;
  getHealthResponse: () => Response;
  isHealthy: () => boolean;
  getHealthStatus: () => SystemHealth;
}

export interface HealthCheckServiceDependencies {
  redisPing: () => Promise<string>;
  backendUrl: string;
  filterProcessorUrl: string;
}

export function createHealthCheckService(
  dependencies: HealthCheckServiceDependencies,
): HealthCheckService {
  // Centralized health state
  const health: SystemHealth = {
    backendConnected: false,
    redisConnected: false,
    filterProcessorConnected: false,
    lastBackendCheck: 0,
    lastRedisCheck: 0,
    lastFilterProcessorCheck: 0,
    connectedClients: 0,
    connectedUsers: 0,
  };

  return {
    async checkRedisConnection(): Promise<boolean> {
      try {
        const pong = await dependencies.redisPing();
        const isConnected = pong === "PONG";
        health.redisConnected = isConnected;
        health.lastRedisCheck = Date.now();
        return isConnected;
      } catch (error) {
        health.redisConnected = false;
        health.lastRedisCheck = Date.now();
        console.error("Redis connection check failed:", error);
        return false;
      }
    },

    async checkBackendConnection(): Promise<boolean> {
      try {
        const response = await fetch(`${dependencies.backendUrl}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });

        health.backendConnected = response.status === 200;
        health.lastBackendCheck = Date.now();
        return health.backendConnected;
      } catch (error) {
        health.backendConnected = false;
        health.lastBackendCheck = Date.now();
        console.error("Backend connection check failed:", error);
        return false;
      }
    },

    async checkFilterProcessorConnection(): Promise<boolean> {
      try {
        const response = await fetch(
          `${dependencies.filterProcessorUrl}/health`,
          {
            signal: AbortSignal.timeout(3000),
          },
        );

        health.filterProcessorConnected = response.status === 200;
        health.lastFilterProcessorCheck = Date.now();
        return health.filterProcessorConnected;
      } catch (error) {
        health.filterProcessorConnected = false;
        health.lastFilterProcessorCheck = Date.now();
        console.error("Filter Processor connection check failed:", error);
        return false;
      }
    },

    updateHealthStats(connectedClients: number, connectedUsers: number): void {
      health.connectedClients = connectedClients;
      health.connectedUsers = connectedUsers;
    },

    getHealthResponse(): Response {
      const status = this.isHealthy() ? 200 : 503;

      return new Response(
        JSON.stringify({
          status: this.isHealthy() ? "healthy" : "unhealthy",
          timestamp: new Date().toISOString(),
          services: {
            redis: {
              connected: health.redisConnected,
              lastChecked: new Date(health.lastRedisCheck).toISOString(),
            },
            backend: {
              connected: health.backendConnected,
              lastChecked: new Date(health.lastBackendCheck).toISOString(),
            },
            filterProcessor: {
              connected: health.filterProcessorConnected,
              lastChecked: new Date(
                health.lastFilterProcessorCheck,
              ).toISOString(),
            },
          },
          stats: {
            connectedClients: health.connectedClients,
            connectedUsers: health.connectedUsers,
          },
        }),
        {
          status,
          headers: { "Content-Type": "application/json" },
        },
      );
    },

    isHealthy(): boolean {
      return health.redisConnected && health.backendConnected;
    },

    getHealthStatus(): SystemHealth {
      return { ...health };
    },
  };
}
