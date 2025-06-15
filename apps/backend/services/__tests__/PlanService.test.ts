import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { PlanService, createPlanService } from "../PlanService";
import { PlanType } from "../../entities/User";
import type { DataSource, Repository } from "typeorm";
import { subWeeks } from "date-fns";

// Mock types to avoid circular dependencies
interface MockUser {
  id: string;
  planType: PlanType;
  weeklyScanCount: number;
  lastScanReset?: Date;
}

describe("PlanService", () => {
  let planService: PlanService;
  let mockDataSource: DataSource;
  let mockUserRepository: Repository<MockUser>;

  beforeEach(() => {
    // Create mocks with proper jest typing
    mockUserRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<MockUser>;

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockUserRepository),
    } as unknown as DataSource;

    planService = new PlanService({ dataSource: mockDataSource });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getScanLimit", () => {
    it("should return 100000 for PRO plan", () => {
      const limit = planService.getScanLimit(PlanType.PRO);
      expect(limit).toBe(100000);
    });

    it("should return 10000 for FREE plan", () => {
      const limit = planService.getScanLimit(PlanType.FREE);
      expect(limit).toBe(10000);
    });

    it("should return 10000 for unknown plan type", () => {
      const limit = planService.getScanLimit("UNKNOWN" as PlanType);
      expect(limit).toBe(10000);
    });
  });

  describe("hasReachedScanLimit", () => {
    it("should throw error when user not found", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        planService.hasReachedScanLimit("nonexistent-user"),
      ).rejects.toThrow("User not found");
    });

    it("should return false for first-time user and set reset date", async () => {
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.FREE,
        weeklyScanCount: 0,
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockUserRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      const result = await planService.hasReachedScanLimit("user-123");

      expect(result).toBe(false);
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        lastScanReset: expect.any(Date),
      });
    });

    it("should return false and reset count when a week has passed", async () => {
      const oneWeekAgo = subWeeks(new Date(), 1);
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.FREE,
        weeklyScanCount: 5000,
        lastScanReset: oneWeekAgo,
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockUserRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      const result = await planService.hasReachedScanLimit("user-123");

      expect(result).toBe(false);
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        weeklyScanCount: 0,
        lastScanReset: expect.any(Date),
      });
    });

    it("should return true when user has reached FREE plan limit", async () => {
      const recentDate = new Date();
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.FREE,
        weeklyScanCount: 10000,
        lastScanReset: recentDate,
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await planService.hasReachedScanLimit("user-123");

      expect(result).toBe(true);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it("should return true when user has reached PRO plan limit", async () => {
      const recentDate = new Date();
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.PRO,
        weeklyScanCount: 100000,
        lastScanReset: recentDate,
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await planService.hasReachedScanLimit("user-123");

      expect(result).toBe(true);
    });

    it("should return false when user is under FREE plan limit", async () => {
      const recentDate = new Date();
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.FREE,
        weeklyScanCount: 9999,
        lastScanReset: recentDate,
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await planService.hasReachedScanLimit("user-123");

      expect(result).toBe(false);
    });

    it("should return false when user is under PRO plan limit", async () => {
      const recentDate = new Date();
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.PRO,
        weeklyScanCount: 99999,
        lastScanReset: recentDate,
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await planService.hasReachedScanLimit("user-123");

      expect(result).toBe(false);
    });
  });

  describe("resetWeeklyScanCount", () => {
    it("should reset weekly scan count and update last reset date", async () => {
      (mockUserRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await planService.resetWeeklyScanCount("user-123");

      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        weeklyScanCount: 0,
        lastScanReset: expect.any(Date),
      });
    });
  });

  describe("incrementWeeklyScanCount", () => {
    it("should increment weekly scan count using query builder", async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      (mockUserRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await planService.incrementWeeklyScanCount("user-123");

      expect(mockUserRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        weeklyScanCount: expect.any(Function),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("id = :userId", {
        userId: "user-123",
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe("getPlanDetails", () => {
    it("should throw error when user not found", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        planService.getPlanDetails("nonexistent-user"),
      ).rejects.toThrow("User not found");
    });

    it("should return plan details for FREE user", async () => {
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.FREE,
        weeklyScanCount: 5000,
        lastScanReset: new Date("2024-01-01"),
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await planService.getPlanDetails("user-123");

      expect(result).toEqual({
        planType: PlanType.FREE,
        weeklyScanCount: 5000,
        scanLimit: 10000,
        remainingScans: 5000,
        lastReset: new Date("2024-01-01"),
      });
    });

    it("should return plan details for PRO user", async () => {
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.PRO,
        weeklyScanCount: 75000,
        lastScanReset: new Date("2024-01-01"),
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await planService.getPlanDetails("user-123");

      expect(result).toEqual({
        planType: PlanType.PRO,
        weeklyScanCount: 75000,
        scanLimit: 100000,
        remainingScans: 25000,
        lastReset: new Date("2024-01-01"),
      });
    });

    it("should return 0 remaining scans when limit is exceeded", async () => {
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.FREE,
        weeklyScanCount: 15000,
        lastScanReset: new Date("2024-01-01"),
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await planService.getPlanDetails("user-123");

      expect(result.remainingScans).toBe(0);
    });

    it("should handle user without lastScanReset", async () => {
      const mockUser: MockUser = {
        id: "user-123",
        planType: PlanType.FREE,
        weeklyScanCount: 5000,
      };

      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await planService.getPlanDetails("user-123");

      expect(result.lastReset).toBe(null);
    });
  });

  describe("updatePlan", () => {
    it("should update user plan type", async () => {
      (mockUserRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await planService.updatePlan("user-123", PlanType.PRO);

      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        planType: PlanType.PRO,
      });
    });

    it("should update user plan type to FREE", async () => {
      (mockUserRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await planService.updatePlan("user-123", PlanType.FREE);

      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        planType: PlanType.FREE,
      });
    });
  });

  describe("createPlanService factory", () => {
    it("should create PlanService instance", () => {
      const dependencies = {
        dataSource: mockDataSource,
      };

      const service = createPlanService(dependencies);

      expect(service).toBeInstanceOf(PlanService);
    });
  });
});
