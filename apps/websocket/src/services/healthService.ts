import { SERVER_CONFIG } from "../config/constants";
import type { SystemHealth } from "../types/websocket";
import { RedisService } from "./redisService";

export class HealthService {
  private static instance: HealthService;
  private health: SystemHealth;
  private redisService: RedisService;

  private constructor() {
    this.health = {
      backendConnected: false,
      redisConnected: false,
      filterProcessorConnected: false,
      lastBackendCheck: 0,
      lastRedisCheck: 0,
      lastFilterProcessorCheck: 0,
      connectedClients: 0,
      connectedUsers: 0,
    };
    this.redisService = RedisService.getInstance();
  }

  public static getInstance(): HealthService {
    if (!HealthService.instance) {
      HealthService.instance = new HealthService();
    }
    return HealthService.instance;
  }

  public async checkAllServices(): Promise<void> {
    await Promise.all([
      this.checkRedisConnection(),
      this.checkBackendConnection(),
      this.checkFilterProcessorConnection(),
    ]);
  }

  public async checkRedisConnection(): Promise<boolean> {
    try {
      const isConnected = await this.redisService.checkConnection();
      this.health.redisConnected = isConnected;
      this.health.lastRedisCheck = Date.now();
      return isConnected;
    } catch (error) {
      this.health.redisConnected = false;
      this.health.lastRedisCheck = Date.now();
      console.error("Redis connection check failed:", error);
      return false;
    }
  }

  public async checkBackendConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${SERVER_CONFIG.backendUrl}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });

      this.health.backendConnected = response.status === 200;
      this.health.lastBackendCheck = Date.now();
      return this.health.backendConnected;
    } catch (error) {
      this.health.backendConnected = false;
      this.health.lastBackendCheck = Date.now();
      console.error("Backend connection check failed:", error);
      return false;
    }
  }

  public async checkFilterProcessorConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${SERVER_CONFIG.filterProcessorUrl}/health`,
        {
          signal: AbortSignal.timeout(3000),
        },
      );

      this.health.filterProcessorConnected = response.status === 200;
      this.health.lastFilterProcessorCheck = Date.now();
      return this.health.filterProcessorConnected;
    } catch (error) {
      this.health.filterProcessorConnected = false;
      this.health.lastFilterProcessorCheck = Date.now();
      console.error("Filter Processor connection check failed:", error);
      return false;
    }
  }

  public updateClientStats(
    connectedClients: number,
    connectedUsers: number,
  ): void {
    this.health.connectedClients = connectedClients;
    this.health.connectedUsers = connectedUsers;
  }

  public getHealthStatus(): SystemHealth {
    return { ...this.health };
  }

  public isHealthy(): boolean {
    return this.health.redisConnected && this.health.backendConnected;
  }

  public getHealthResponse(): Response {
    const status = this.isHealthy() ? 200 : 503;

    return new Response(
      JSON.stringify({
        status: this.isHealthy() ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        services: {
          redis: {
            connected: this.health.redisConnected,
            lastChecked: new Date(this.health.lastRedisCheck).toISOString(),
          },
          backend: {
            connected: this.health.backendConnected,
            lastChecked: new Date(this.health.lastBackendCheck).toISOString(),
          },
          filterProcessor: {
            connected: this.health.filterProcessorConnected,
            lastChecked: new Date(
              this.health.lastFilterProcessorCheck,
            ).toISOString(),
          },
        },
        stats: {
          connectedClients: this.health.connectedClients,
          connectedUsers: this.health.connectedUsers,
        },
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
