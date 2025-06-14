import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { createHealthCheckService } from "../src/services/healthCheckService";
import type { HealthCheckServiceDependencies } from "../src/services/healthCheckService";

// Mock console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Mock fetch function
const mockFetch = jest.fn();
Object.defineProperty(global, "fetch", {
  value: mockFetch,
  writable: true,
});

describe("HealthCheckService", () => {
  let mockDependencies: HealthCheckServiceDependencies;
  let consoleErrors: string[] = [];
  let healthCheckService: ReturnType<typeof createHealthCheckService>;

  beforeEach(() => {
    // Reset console capture
    consoleErrors = [];
    console.error = jest.fn((...args) => {
      consoleErrors.push(args.join(" "));
      originalConsoleError(...args);
    });

    // Reset fetch mock
    mockFetch.mockReset();

    // Setup mock dependencies
    mockDependencies = {
      redisPing: jest.fn(),
      backendUrl: "http://localhost:3000",
      filterProcessorUrl: "http://localhost:3001",
    };

    healthCheckService = createHealthCheckService(mockDependencies);
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe("checkRedisConnection", () => {
    it("should return true when Redis ping returns PONG", async () => {
      (mockDependencies.redisPing as jest.Mock).mockResolvedValue("PONG");

      const result = await healthCheckService.checkRedisConnection();

      expect(result).toBe(true);
      expect(mockDependencies.redisPing).toHaveBeenCalledTimes(1);
    });

    it("should return false when Redis ping returns unexpected value", async () => {
      (mockDependencies.redisPing as jest.Mock).mockResolvedValue("OK");

      const result = await healthCheckService.checkRedisConnection();

      expect(result).toBe(false);
      expect(
        consoleErrors.some((error) =>
          error.includes("Redis connection check failed"),
        ),
      ).toBe(false);
    });

    it("should return false and log error when Redis ping throws", async () => {
      const redisError = new Error("Redis connection failed");
      (mockDependencies.redisPing as jest.Mock).mockRejectedValue(redisError);

      const result = await healthCheckService.checkRedisConnection();

      expect(result).toBe(false);
      expect(
        consoleErrors.some((error) =>
          error.includes("Redis connection check failed"),
        ),
      ).toBe(true);
    });

    it("should update lastRedisCheck timestamp on success", async () => {
      (mockDependencies.redisPing as jest.Mock).mockResolvedValue("PONG");
      const beforeCheck = Date.now();

      await healthCheckService.checkRedisConnection();
      const healthState = healthCheckService.getHealthStatus();

      expect(healthState.lastRedisCheck).toBeGreaterThanOrEqual(beforeCheck);
    });

    it("should update lastRedisCheck timestamp on failure", async () => {
      (mockDependencies.redisPing as jest.Mock).mockRejectedValue(
        new Error("Redis failed"),
      );
      const beforeCheck = Date.now();

      await healthCheckService.checkRedisConnection();
      const healthState = healthCheckService.getHealthStatus();

      expect(healthState.lastRedisCheck).toBeGreaterThanOrEqual(beforeCheck);
    });
  });

  describe("checkBackendConnection", () => {
    it("should return true when backend responds with 200", async () => {
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const result = await healthCheckService.checkBackendConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/health",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should return false when backend responds with non-200 status", async () => {
      const mockResponse = new Response("Service Unavailable", { status: 503 });
      mockFetch.mockResolvedValue(mockResponse);

      const result = await healthCheckService.checkBackendConnection();

      expect(result).toBe(false);
    });

    it("should return false and log error when backend request throws", async () => {
      const networkError = new Error("Network error");
      mockFetch.mockRejectedValue(networkError);

      const result = await healthCheckService.checkBackendConnection();

      expect(result).toBe(false);
      expect(
        consoleErrors.some((error) =>
          error.includes("Backend connection check failed"),
        ),
      ).toBe(true);
    });

    it("should use correct backend URL from dependencies", async () => {
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      await healthCheckService.checkBackendConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/health",
        expect.any(Object),
      );
    });

    it("should update lastBackendCheck timestamp on success", async () => {
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);
      const beforeCheck = Date.now();

      await healthCheckService.checkBackendConnection();
      const healthState = healthCheckService.getHealthStatus();

      expect(healthState.lastBackendCheck).toBeGreaterThanOrEqual(beforeCheck);
    });

    it("should update lastBackendCheck timestamp on failure", async () => {
      mockFetch.mockRejectedValue(new Error("Backend failed"));
      const beforeCheck = Date.now();

      await healthCheckService.checkBackendConnection();
      const healthState = healthCheckService.getHealthStatus();

      expect(healthState.lastBackendCheck).toBeGreaterThanOrEqual(beforeCheck);
    });
  });

  describe("checkFilterProcessorConnection", () => {
    it("should return true when filter processor responds with 200", async () => {
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const result = await healthCheckService.checkFilterProcessorConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/health",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should return false when filter processor responds with non-200 status", async () => {
      const mockResponse = new Response("Service Unavailable", { status: 503 });
      mockFetch.mockResolvedValue(mockResponse);

      const result = await healthCheckService.checkFilterProcessorConnection();

      expect(result).toBe(false);
    });

    it("should return false and log error when filter processor request throws", async () => {
      const networkError = new Error("Network error");
      mockFetch.mockRejectedValue(networkError);

      const result = await healthCheckService.checkFilterProcessorConnection();

      expect(result).toBe(false);
      expect(
        consoleErrors.some((error) =>
          error.includes("Filter Processor connection check failed"),
        ),
      ).toBe(true);
    });

    it("should use correct filter processor URL from dependencies", async () => {
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      await healthCheckService.checkFilterProcessorConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/health",
        expect.any(Object),
      );
    });

    it("should update lastFilterProcessorCheck timestamp on success", async () => {
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);
      const beforeCheck = Date.now();

      await healthCheckService.checkFilterProcessorConnection();
      const healthState = healthCheckService.getHealthStatus();

      expect(healthState.lastFilterProcessorCheck).toBeGreaterThanOrEqual(
        beforeCheck,
      );
    });

    it("should update lastFilterProcessorCheck timestamp on failure", async () => {
      mockFetch.mockRejectedValue(new Error("Filter processor failed"));
      const beforeCheck = Date.now();

      await healthCheckService.checkFilterProcessorConnection();
      const healthState = healthCheckService.getHealthStatus();

      expect(healthState.lastFilterProcessorCheck).toBeGreaterThanOrEqual(
        beforeCheck,
      );
    });
  });

  describe("updateHealthStats", () => {
    it("should update connected clients and users count", () => {
      const initialState = healthCheckService.getHealthStatus();
      expect(initialState.connectedClients).toBe(0);
      expect(initialState.connectedUsers).toBe(0);

      healthCheckService.updateHealthStats(42, 15);

      const updatedState = healthCheckService.getHealthStatus();
      expect(updatedState.connectedClients).toBe(42);
      expect(updatedState.connectedUsers).toBe(15);
    });

    it("should handle zero values", () => {
      healthCheckService.updateHealthStats(0, 0);

      const state = healthCheckService.getHealthStatus();
      expect(state.connectedClients).toBe(0);
      expect(state.connectedUsers).toBe(0);
    });

    it("should handle negative values", () => {
      healthCheckService.updateHealthStats(-1, -5);

      const state = healthCheckService.getHealthStatus();
      expect(state.connectedClients).toBe(-1);
      expect(state.connectedUsers).toBe(-5);
    });
  });

  describe("getHealthResponse", () => {
    it("should return 200 status when all critical services are healthy", async () => {
      // Setup healthy state
      (mockDependencies.redisPing as jest.Mock).mockResolvedValue("PONG");
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      await healthCheckService.checkRedisConnection();
      await healthCheckService.checkBackendConnection();

      const response = healthCheckService.getHealthResponse();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("healthy");
    });

    it("should return 503 status when Redis is unhealthy", async () => {
      // Setup unhealthy Redis
      (mockDependencies.redisPing as jest.Mock).mockRejectedValue(
        new Error("Redis failed"),
      );
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      await healthCheckService.checkRedisConnection();
      await healthCheckService.checkBackendConnection();

      const response = healthCheckService.getHealthResponse();

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.status).toBe("unhealthy");
    });

    it("should return 503 status when backend is unhealthy", async () => {
      // Setup healthy Redis, unhealthy backend
      (mockDependencies.redisPing as jest.Mock).mockResolvedValue("PONG");
      mockFetch.mockRejectedValue(new Error("Backend failed"));

      await healthCheckService.checkRedisConnection();
      await healthCheckService.checkBackendConnection();

      const response = healthCheckService.getHealthResponse();

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.status).toBe("unhealthy");
    });

    it("should include all service statuses in response", async () => {
      const response = healthCheckService.getHealthResponse();
      const body = await response.json();

      expect(body.services).toHaveProperty("redis");
      expect(body.services).toHaveProperty("backend");
      expect(body.services).toHaveProperty("filterProcessor");
      expect(body.services.redis).toHaveProperty("connected");
      expect(body.services.redis).toHaveProperty("lastChecked");
    });

    it("should include stats in response", async () => {
      healthCheckService.updateHealthStats(10, 5);

      const response = healthCheckService.getHealthResponse();
      const body = await response.json();

      expect(body.stats).toHaveProperty("connectedClients");
      expect(body.stats).toHaveProperty("connectedUsers");
      expect(body.stats.connectedClients).toBe(10);
      expect(body.stats.connectedUsers).toBe(5);
    });

    it("should include timestamp in response", async () => {
      const beforeResponse = new Date();
      const response = healthCheckService.getHealthResponse();
      const body = await response.json();
      const afterResponse = new Date();

      const responseTimestamp = new Date(body.timestamp);
      expect(responseTimestamp.getTime()).toBeGreaterThanOrEqual(
        beforeResponse.getTime(),
      );
      expect(responseTimestamp.getTime()).toBeLessThanOrEqual(
        afterResponse.getTime(),
      );
    });

    it("should set correct content type header", () => {
      const response = healthCheckService.getHealthResponse();

      expect(response.headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("getHealthStatus", () => {
    it("should return a copy of the health state", () => {
      const state1 = healthCheckService.getHealthStatus();
      const state2 = healthCheckService.getHealthStatus();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Should be a copy, not the same reference
    });

    it("should include all health state properties", () => {
      const state = healthCheckService.getHealthStatus();

      expect(state).toHaveProperty("backendConnected");
      expect(state).toHaveProperty("redisConnected");
      expect(state).toHaveProperty("filterProcessorConnected");
      expect(state).toHaveProperty("lastBackendCheck");
      expect(state).toHaveProperty("lastRedisCheck");
      expect(state).toHaveProperty("lastFilterProcessorCheck");
      expect(state).toHaveProperty("connectedClients");
      expect(state).toHaveProperty("connectedUsers");
    });

    it("should reflect updated connection states", async () => {
      // Initially all should be false
      let state = healthCheckService.getHealthStatus();
      expect(state.redisConnected).toBe(false);
      expect(state.backendConnected).toBe(false);
      expect(state.filterProcessorConnected).toBe(false);

      // Setup healthy connections
      (mockDependencies.redisPing as jest.Mock).mockResolvedValue("PONG");
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      await healthCheckService.checkRedisConnection();
      await healthCheckService.checkBackendConnection();
      await healthCheckService.checkFilterProcessorConnection();

      // Check updated state
      state = healthCheckService.getHealthStatus();
      expect(state.redisConnected).toBe(true);
      expect(state.backendConnected).toBe(true);
      expect(state.filterProcessorConnected).toBe(true);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle mixed service states correctly", async () => {
      // Setup: Redis healthy, backend unhealthy, filter processor healthy
      (mockDependencies.redisPing as jest.Mock).mockResolvedValue("PONG");
      mockFetch
        .mockResolvedValueOnce(new Response("OK", { status: 200 })) // Backend call
        .mockRejectedValueOnce(new Error("Filter processor failed")); // Filter processor call

      await healthCheckService.checkRedisConnection();
      await healthCheckService.checkBackendConnection();
      await healthCheckService.checkFilterProcessorConnection();

      const state = healthCheckService.getHealthStatus();
      expect(state.redisConnected).toBe(true);
      expect(state.backendConnected).toBe(true);
      expect(state.filterProcessorConnected).toBe(false);

      const response = healthCheckService.getHealthResponse();
      expect(response.status).toBe(200); // Still healthy because Redis and backend are OK
    });

    it("should maintain state across multiple health checks", async () => {
      // First check - all healthy
      (mockDependencies.redisPing as jest.Mock).mockResolvedValue("PONG");
      const mockResponse = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      await healthCheckService.checkRedisConnection();
      await healthCheckService.checkBackendConnection();
      await healthCheckService.checkFilterProcessorConnection();

      let state = healthCheckService.getHealthStatus();
      expect(state.redisConnected).toBe(true);
      expect(state.backendConnected).toBe(true);
      expect(state.filterProcessorConnected).toBe(true);

      // Second check - Redis fails
      (mockDependencies.redisPing as jest.Mock).mockRejectedValue(
        new Error("Redis failed"),
      );
      await healthCheckService.checkRedisConnection();

      state = healthCheckService.getHealthStatus();
      expect(state.redisConnected).toBe(false);
      expect(state.backendConnected).toBe(true); // Should still be true from previous check
      expect(state.filterProcessorConnected).toBe(true); // Should still be true from previous check
    });
  });
});
