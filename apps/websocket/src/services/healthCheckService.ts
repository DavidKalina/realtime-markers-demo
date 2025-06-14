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

export interface HealthCheckService {
  checkRedisConnection: () => Promise<boolean>;
  checkBackendConnection: () => Promise<boolean>;
  checkFilterProcessorConnection: () => Promise<boolean>;
  updateHealthStats: (connectedClients: number, connectedUsers: number) => void;
  getHealthResponse: () => Response;
  getHealthState: () => SystemHealth;
}

export interface HealthCheckDependencies {
  redisPing: () => Promise<string>;
  backendUrl: string;
  filterProcessorUrl: string;
}

export function createHealthCheckService(
  dependencies: HealthCheckDependencies,
): HealthCheckService {
  const systemHealth: SystemHealth = {
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
        systemHealth.redisConnected = pong === "PONG";
        systemHealth.lastRedisCheck = Date.now();
        return systemHealth.redisConnected;
      } catch (error) {
        systemHealth.redisConnected = false;
        systemHealth.lastRedisCheck = Date.now();
        console.error("Redis connection check failed:", error);
        return false;
      }
    },

    async checkBackendConnection(): Promise<boolean> {
      try {
        const response = await fetch(`${dependencies.backendUrl}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });

        systemHealth.backendConnected = response.status === 200;
        systemHealth.lastBackendCheck = Date.now();
        return systemHealth.backendConnected;
      } catch (error) {
        systemHealth.backendConnected = false;
        systemHealth.lastBackendCheck = Date.now();
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

        systemHealth.filterProcessorConnected = response.status === 200;
        systemHealth.lastFilterProcessorCheck = Date.now();
        return systemHealth.filterProcessorConnected;
      } catch (error) {
        systemHealth.filterProcessorConnected = false;
        systemHealth.lastFilterProcessorCheck = Date.now();
        console.error("Filter Processor connection check failed:", error);
        return false;
      }
    },

    updateHealthStats(connectedClients: number, connectedUsers: number): void {
      systemHealth.connectedClients = connectedClients;
      systemHealth.connectedUsers = connectedUsers;
    },

    getHealthResponse(): Response {
      const isHealthy =
        systemHealth.redisConnected && systemHealth.backendConnected;
      const status = isHealthy ? 200 : 503;

      return new Response(
        JSON.stringify({
          status: isHealthy ? "healthy" : "unhealthy",
          timestamp: new Date().toISOString(),
          services: {
            redis: {
              connected: systemHealth.redisConnected,
              lastChecked: new Date(systemHealth.lastRedisCheck).toISOString(),
            },
            backend: {
              connected: systemHealth.backendConnected,
              lastChecked: new Date(
                systemHealth.lastBackendCheck,
              ).toISOString(),
            },
            filterProcessor: {
              connected: systemHealth.filterProcessorConnected,
              lastChecked: new Date(
                systemHealth.lastFilterProcessorCheck,
              ).toISOString(),
            },
          },
          stats: {
            connectedClients: systemHealth.connectedClients,
            connectedUsers: systemHealth.connectedUsers,
          },
        }),
        {
          status,
          headers: { "Content-Type": "application/json" },
        },
      );
    },

    getHealthState(): SystemHealth {
      return { ...systemHealth };
    },
  };
}
