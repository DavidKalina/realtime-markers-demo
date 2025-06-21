/* eslint-disable quotes */
import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";

import {
  AuthService,
  createAuthService,
  type AuthServiceDependencies,
  type UserRegistrationData,
} from "../AuthService";
import { User, UserRole } from "../../entities/User";
import type { Repository } from "typeorm";
import type { UserPreferencesServiceImpl } from "../UserPreferences";
import type { DataSource } from "typeorm";
import type { OpenAIService } from "../shared/OpenAIService";

describe("AuthService", () => {
  let authService: AuthService;
  let mockUserRepository: Repository<User>;
  let mockUserPreferencesService: UserPreferencesServiceImpl;
  let mockDataSource: DataSource;
  let mockOpenAIService: OpenAIService;

  // Test data
  const testUser = {
    id: "user-123",
    email: "test@example.com",
    passwordHash: "hashedPassword123",
    role: UserRole.USER,
    isVerified: false,
    avatarUrl: undefined,
    bio: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    scanCount: 0,
    saveCount: 0,
    refreshToken: "refresh-token-123",
    discoveryCount: 0,
    weeklyScanCount: 0,
    lastScanReset: undefined,
    contacts: undefined,
    discoveries: [],
    createdEvents: [],
    savedEvents: [],
    rsvps: [],
    sentFriendRequests: [],
    receivedFriendRequests: [],
    viewCount: 0,
    viewedEvents: [],
  } as User;

  const testRegistrationData: UserRegistrationData = {
    email: "newuser@example.com",
    password: "password123",
  };

  beforeEach(() => {
    // Set up environment variables
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.REFRESH_SECRET = "test-refresh-secret";

    // Clear all mocks
    jest.clearAllMocks();

    // Create mocks
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as Repository<User>;

    mockUserPreferencesService = {
      createFilter: jest.fn(),
      applyFilters: jest.fn(),
    } as unknown as UserPreferencesServiceImpl;

    mockDataSource = {
      getRepository: jest.fn(),
    } as unknown as DataSource;

    mockOpenAIService = {
      executeChatCompletion: jest.fn(),
    } as unknown as OpenAIService;

    const dependencies: AuthServiceDependencies = {
      userRepository: mockUserRepository,
      userPreferencesService: mockUserPreferencesService,
      dataSource: mockDataSource,
      openAIService: mockOpenAIService,
    };

    authService = createAuthService(dependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.JWT_SECRET;
    delete process.env.REFRESH_SECRET;
  });

  describe("constructor", () => {
    it("should throw error if JWT_SECRET is not set", () => {
      delete process.env.JWT_SECRET;

      expect(() => {
        createAuthService({
          userRepository: mockUserRepository,
          userPreferencesService: mockUserPreferencesService,
          dataSource: mockDataSource,
          openAIService: mockOpenAIService,
        });
      }).toThrow("JWT_SECRET environment variable must be set");
    });

    it("should throw error if REFRESH_SECRET is not set", () => {
      delete process.env.REFRESH_SECRET;

      expect(() => {
        createAuthService({
          userRepository: mockUserRepository,
          userPreferencesService: mockUserPreferencesService,
          dataSource: mockDataSource,
          openAIService: mockOpenAIService,
        });
      }).toThrow("REFRESH_SECRET environment variable must be set");
    });

    it("should initialize with correct configuration", () => {
      expect(authService).toBeInstanceOf(AuthService);
    });
  });

  describe("register", () => {
    it("should throw error if user already exists", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(testUser);

      await expect(authService.register(testRegistrationData)).rejects.toThrow(
        "User with this email already exists",
      );
    });
  });

  describe("login", () => {
    it("should throw error for invalid email", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login("nonexistent@example.com", "password123"),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(testUser);
      (mockUserRepository.save as jest.Mock).mockResolvedValue(testUser);

      const result = await authService.logout(testUser.id);

      expect(result).toBe(true);
      expect(mockUserRepository.save).toHaveBeenCalledWith({
        ...testUser,
        refreshToken: undefined,
      });
    });

    it("should return false when user not found", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await authService.logout("nonexistent-user");

      expect(result).toBe(false);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("validateToken", () => {
    it("should return null for invalid token", () => {
      const result = authService.validateToken("invalid-token");
      expect(result).toBeNull();
    });
  });

  describe("getUserProfile", () => {
    it("should return null when user not found", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await authService.getUserProfile("nonexistent-user");

      expect(result).toBeNull();
    });
  });

  describe("updateUserProfile", () => {
    it("should update user profile successfully", async () => {
      const updateData = {
        bio: "Updated bio",
      };

      const mockUpdatedUser = { ...testUser, ...updateData };

      (mockUserRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(
        mockUpdatedUser,
      );

      const result = await authService.updateUserProfile(
        testUser.id,
        updateData,
      );

      expect(result).toEqual({
        ...mockUpdatedUser,
      } as User);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        testUser.id,
        updateData,
      );
    });

    it("should exclude sensitive fields from updates", async () => {
      const updateData = {
        bio: "Updated bio",
        passwordHash: "should-be-ignored",
        refreshToken: "should-be-ignored",
        role: UserRole.ADMIN,
        id: "should-be-ignored",
        email: "should-be-ignored",
      };

      const mockUpdatedUser = { ...testUser, bio: "Updated bio" };

      (mockUserRepository.update as jest.Mock).mockResolvedValue({
        affected: 1,
      });
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(
        mockUpdatedUser,
      );

      await authService.updateUserProfile(testUser.id, updateData);

      expect(mockUserRepository.update).toHaveBeenCalledWith(testUser.id, {
        bio: "Updated bio",
      });
    });
  });

  describe("changePassword", () => {
    it("should throw error when user not found", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.changePassword("nonexistent-user", "old", "new"),
      ).rejects.toThrow("User not found");
    });
  });

  describe("deleteAccount", () => {
    it("should throw error when user not found", async () => {
      (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.deleteAccount("nonexistent-user", "password"),
      ).rejects.toThrow("User not found");
    });
  });
});
