import { describe, test, expect, beforeEach } from "bun:test";
import {
  createUserStateService,
  UserStateService,
} from "../src/services/UserStateService";
import { Filter, BoundingBox } from "../src/types/types";

describe("UserStateService", () => {
  let userStateService: UserStateService;

  // Test data
  const testUserId = "user-123";
  const testUserId2 = "user-456";
  const testUserId3 = "user-789";

  const testFilters: Filter[] = [
    {
      id: "filter-1",
      userId: testUserId,
      name: "Test Filter",
      isActive: true,
      criteria: {
        dateRange: {
          start: "2024-01-01",
          end: "2024-12-31",
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "filter-2",
      userId: testUserId,
      name: "Another Filter",
      isActive: false,
      criteria: {
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          radius: 5000,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const testViewport: BoundingBox = {
    minX: -74.006,
    minY: 40.7128,
    maxX: -73.996,
    maxY: 40.7228,
  };

  const testViewport2: BoundingBox = {
    minX: -74.016,
    minY: 40.7028,
    maxX: -73.986,
    maxY: 40.7328,
  };

  beforeEach(() => {
    // Create a fresh service instance for each test
    userStateService = createUserStateService();
  });

  describe("Filter Management", () => {
    describe("setUserFilters", () => {
      test("should set filters for a user", () => {
        userStateService.setUserFilters(testUserId, testFilters);
        const retrievedFilters = userStateService.getUserFilters(testUserId);
        expect(retrievedFilters).toEqual(testFilters);
      });

      test("should overwrite existing filters", () => {
        userStateService.setUserFilters(testUserId, testFilters);
        const newFilters = [testFilters[0]];
        userStateService.setUserFilters(testUserId, newFilters);
        const retrievedFilters = userStateService.getUserFilters(testUserId);
        expect(retrievedFilters).toEqual(newFilters);
      });

      test("should handle empty filters array", () => {
        userStateService.setUserFilters(testUserId, []);
        const retrievedFilters = userStateService.getUserFilters(testUserId);
        expect(retrievedFilters).toEqual([]);
      });

      test("should enforce user limit when exceeded", () => {
        const service = createUserStateService({ maxUsers: 2 });

        // Add first user
        service.setUserFilters("user-1", testFilters);
        expect(service.hasUserFilters("user-1")).toBe(true);

        // Add second user
        service.setUserFilters("user-2", testFilters);
        expect(service.hasUserFilters("user-2")).toBe(true);

        // Add third user - should evict first user
        service.setUserFilters("user-3", testFilters);
        expect(service.hasUserFilters("user-1")).toBe(false);
        expect(service.hasUserFilters("user-2")).toBe(true);
        expect(service.hasUserFilters("user-3")).toBe(true);
      });

      test("should not store filters when filter tracking is disabled", () => {
        const service = createUserStateService({ enableFilterTracking: false });

        service.setUserFilters(testUserId, testFilters);

        // Should not have stored the filters
        expect(service.hasUserFilters(testUserId)).toBe(false);
        expect(service.getUserFilters(testUserId)).toEqual([]);
      });
    });

    describe("getUserFilters", () => {
      test("should return empty array for non-existent user", () => {
        const filters = userStateService.getUserFilters("non-existent");
        expect(filters).toEqual([]);
      });

      test("should return correct filters for existing user", () => {
        userStateService.setUserFilters(testUserId, testFilters);
        const retrievedFilters = userStateService.getUserFilters(testUserId);
        expect(retrievedFilters).toEqual(testFilters);
      });
    });

    describe("hasUserFilters", () => {
      test("should return false for non-existent user", () => {
        expect(userStateService.hasUserFilters("non-existent")).toBe(false);
      });

      test("should return true for user with filters", () => {
        userStateService.setUserFilters(testUserId, testFilters);
        expect(userStateService.hasUserFilters(testUserId)).toBe(true);
      });

      test("should return false for user with empty filters", () => {
        userStateService.setUserFilters(testUserId, []);
        expect(userStateService.hasUserFilters(testUserId)).toBe(true); // Still has entry
      });
    });

    describe("removeUserFilters", () => {
      test("should remove filters for existing user", () => {
        userStateService.setUserFilters(testUserId, testFilters);
        expect(userStateService.hasUserFilters(testUserId)).toBe(true);

        userStateService.removeUserFilters(testUserId);
        expect(userStateService.hasUserFilters(testUserId)).toBe(false);
        expect(userStateService.getUserFilters(testUserId)).toEqual([]);
      });

      test("should handle removing filters for non-existent user", () => {
        expect(() => {
          userStateService.removeUserFilters("non-existent");
        }).not.toThrow();
      });
    });
  });

  describe("Viewport Management", () => {
    describe("setUserViewport", () => {
      test("should set viewport for a user", () => {
        userStateService.setUserViewport(testUserId, testViewport);
        const retrievedViewport = userStateService.getUserViewport(testUserId);
        expect(retrievedViewport).toEqual(testViewport);
      });

      test("should overwrite existing viewport", () => {
        userStateService.setUserViewport(testUserId, testViewport);
        userStateService.setUserViewport(testUserId, testViewport2);
        const retrievedViewport = userStateService.getUserViewport(testUserId);
        expect(retrievedViewport).toEqual(testViewport2);
      });

      test("should enforce user limit when exceeded", () => {
        const service = createUserStateService({ maxUsers: 2 });

        // Add first user
        service.setUserViewport("user-1", testViewport);
        expect(service.hasUserViewport("user-1")).toBe(true);

        // Add second user
        service.setUserViewport("user-2", testViewport);
        expect(service.hasUserViewport("user-2")).toBe(true);

        // Add third user - should evict first user
        service.setUserViewport("user-3", testViewport);
        expect(service.hasUserViewport("user-1")).toBe(false);
        expect(service.hasUserViewport("user-2")).toBe(true);
        expect(service.hasUserViewport("user-3")).toBe(true);
      });

      test("should not store viewport when viewport tracking is disabled", () => {
        const service = createUserStateService({
          enableViewportTracking: false,
        });

        service.setUserViewport(testUserId, testViewport);

        // Should not have stored the viewport
        expect(service.hasUserViewport(testUserId)).toBe(false);
        expect(service.getUserViewport(testUserId)).toBeUndefined();
      });
    });

    describe("getUserViewport", () => {
      test("should return undefined for non-existent user", () => {
        const viewport = userStateService.getUserViewport("non-existent");
        expect(viewport).toBeUndefined();
      });

      test("should return correct viewport for existing user", () => {
        userStateService.setUserViewport(testUserId, testViewport);
        const retrievedViewport = userStateService.getUserViewport(testUserId);
        expect(retrievedViewport).toEqual(testViewport);
      });
    });

    describe("hasUserViewport", () => {
      test("should return false for non-existent user", () => {
        expect(userStateService.hasUserViewport("non-existent")).toBe(false);
      });

      test("should return true for user with viewport", () => {
        userStateService.setUserViewport(testUserId, testViewport);
        expect(userStateService.hasUserViewport(testUserId)).toBe(true);
      });
    });

    describe("removeUserViewport", () => {
      test("should remove viewport for existing user", () => {
        userStateService.setUserViewport(testUserId, testViewport);
        expect(userStateService.hasUserViewport(testUserId)).toBe(true);

        userStateService.removeUserViewport(testUserId);
        expect(userStateService.hasUserViewport(testUserId)).toBe(false);
        expect(userStateService.getUserViewport(testUserId)).toBeUndefined();
      });

      test("should handle removing viewport for non-existent user", () => {
        expect(() => {
          userStateService.removeUserViewport("non-existent");
        }).not.toThrow();
      });
    });
  });

  describe("User Lifecycle", () => {
    describe("registerUser", () => {
      test("should register user with viewport and filters", () => {
        userStateService.registerUser(testUserId, testViewport, testFilters);

        expect(userStateService.hasUserViewport(testUserId)).toBe(true);
        expect(userStateService.hasUserFilters(testUserId)).toBe(true);
        expect(userStateService.getUserViewport(testUserId)).toEqual(
          testViewport,
        );
        expect(userStateService.getUserFilters(testUserId)).toEqual(
          testFilters,
        );
      });

      test("should register user with only viewport", () => {
        userStateService.registerUser(testUserId, testViewport);

        expect(userStateService.hasUserViewport(testUserId)).toBe(true);
        expect(userStateService.hasUserFilters(testUserId)).toBe(false);
        expect(userStateService.getUserViewport(testUserId)).toEqual(
          testViewport,
        );
        expect(userStateService.getUserFilters(testUserId)).toEqual([]);
      });

      test("should register user with only filters", () => {
        userStateService.registerUser(testUserId, undefined, testFilters);

        expect(userStateService.hasUserViewport(testUserId)).toBe(false);
        expect(userStateService.hasUserFilters(testUserId)).toBe(true);
        expect(userStateService.getUserViewport(testUserId)).toBeUndefined();
        expect(userStateService.getUserFilters(testUserId)).toEqual(
          testFilters,
        );
      });

      test("should register user with no initial state", () => {
        userStateService.registerUser(testUserId);

        expect(userStateService.hasUserViewport(testUserId)).toBe(false);
        expect(userStateService.hasUserFilters(testUserId)).toBe(false);
        expect(userStateService.getUserViewport(testUserId)).toBeUndefined();
        expect(userStateService.getUserFilters(testUserId)).toEqual([]);
      });

      test("should respect viewport tracking configuration", () => {
        const service = createUserStateService({
          enableViewportTracking: false,
        });
        service.registerUser(testUserId, testViewport, testFilters);

        expect(service.hasUserViewport(testUserId)).toBe(false);
        expect(service.hasUserFilters(testUserId)).toBe(true);
      });

      test("should respect filter tracking configuration", () => {
        const service = createUserStateService({ enableFilterTracking: false });
        service.registerUser(testUserId, testViewport, testFilters);

        expect(service.hasUserViewport(testUserId)).toBe(true);
        expect(service.hasUserFilters(testUserId)).toBe(false);
      });
    });

    describe("unregisterUser", () => {
      test("should remove all user data", () => {
        userStateService.registerUser(testUserId, testViewport, testFilters);
        expect(userStateService.hasUserViewport(testUserId)).toBe(true);
        expect(userStateService.hasUserFilters(testUserId)).toBe(true);

        userStateService.unregisterUser(testUserId);

        expect(userStateService.hasUserViewport(testUserId)).toBe(false);
        expect(userStateService.hasUserFilters(testUserId)).toBe(false);
        expect(userStateService.getUserViewport(testUserId)).toBeUndefined();
        expect(userStateService.getUserFilters(testUserId)).toEqual([]);
      });

      test("should handle unregistering non-existent user", () => {
        expect(() => {
          userStateService.unregisterUser("non-existent");
        }).not.toThrow();
      });

      test("should handle unregistering user with no data", () => {
        expect(() => {
          userStateService.unregisterUser(testUserId);
        }).not.toThrow();
      });
    });
  });

  describe("Bulk Operations", () => {
    describe("getAllUserIds", () => {
      test("should return empty array when no users exist", () => {
        const userIds = userStateService.getAllUserIds();
        expect(userIds).toEqual([]);
      });

      test("should return all user IDs", () => {
        userStateService.registerUser(testUserId, testViewport, testFilters);
        userStateService.registerUser(testUserId2, testViewport2);
        userStateService.registerUser(testUserId3, undefined, testFilters);

        const userIds = userStateService.getAllUserIds();
        expect(userIds).toContain(testUserId);
        expect(userIds).toContain(testUserId2);
        expect(userIds).toContain(testUserId3);
        expect(userIds).toHaveLength(3);
      });

      test("should return unique user IDs when user has both viewport and filters", () => {
        userStateService.registerUser(testUserId, testViewport, testFilters);

        const userIds = userStateService.getAllUserIds();
        expect(userIds).toEqual([testUserId]);
        expect(userIds).toHaveLength(1);
      });

      test("should respect viewport tracking configuration", () => {
        const service = createUserStateService({
          enableViewportTracking: false,
        });
        service.registerUser(testUserId, testViewport, testFilters);

        const userIds = service.getAllUserIds();
        expect(userIds).toEqual([testUserId]);
      });

      test("should respect filter tracking configuration", () => {
        const service = createUserStateService({ enableFilterTracking: false });
        service.registerUser(testUserId, testViewport, testFilters);

        const userIds = service.getAllUserIds();
        expect(userIds).toEqual([testUserId]);
      });
    });

    describe("getAllUsersWithFilters", () => {
      test("should return empty array when no users have filters", () => {
        const usersWithFilters = userStateService.getAllUsersWithFilters();
        expect(usersWithFilters).toEqual([]);
      });

      test("should return all users with their filters", () => {
        userStateService.registerUser(testUserId, testViewport, testFilters);
        userStateService.registerUser(testUserId2, testViewport2);
        userStateService.registerUser(testUserId3, undefined, testFilters);

        const usersWithFilters = userStateService.getAllUsersWithFilters();
        expect(usersWithFilters).toHaveLength(2);

        const userId1Entry = usersWithFilters.find(
          (u) => u.userId === testUserId,
        );
        const userId3Entry = usersWithFilters.find(
          (u) => u.userId === testUserId3,
        );

        expect(userId1Entry).toBeDefined();
        expect(userId1Entry?.filters).toEqual(testFilters);
        expect(userId3Entry).toBeDefined();
        expect(userId3Entry?.filters).toEqual(testFilters);
      });

      test("should return empty array when filter tracking is disabled", () => {
        const service = createUserStateService({ enableFilterTracking: false });
        service.registerUser(testUserId, testViewport, testFilters);

        const usersWithFilters = service.getAllUsersWithFilters();
        expect(usersWithFilters).toEqual([]);
      });
    });

    describe("getAllUsersWithViewports", () => {
      test("should return empty array when no users have viewports", () => {
        const usersWithViewports = userStateService.getAllUsersWithViewports();
        expect(usersWithViewports).toEqual([]);
      });

      test("should return all users with their viewports", () => {
        userStateService.registerUser(testUserId, testViewport, testFilters);
        userStateService.registerUser(testUserId2, testViewport2);
        userStateService.registerUser(testUserId3, undefined, testFilters);

        const usersWithViewports = userStateService.getAllUsersWithViewports();
        expect(usersWithViewports).toHaveLength(2);

        const userId1Entry = usersWithViewports.find(
          (u) => u.userId === testUserId,
        );
        const userId2Entry = usersWithViewports.find(
          (u) => u.userId === testUserId2,
        );

        expect(userId1Entry).toBeDefined();
        expect(userId1Entry?.viewport).toEqual(testViewport);
        expect(userId2Entry).toBeDefined();
        expect(userId2Entry?.viewport).toEqual(testViewport2);
      });

      test("should return empty array when viewport tracking is disabled", () => {
        const service = createUserStateService({
          enableViewportTracking: false,
        });
        service.registerUser(testUserId, testViewport, testFilters);

        const usersWithViewports = service.getAllUsersWithViewports();
        expect(usersWithViewports).toEqual([]);
      });
    });
  });

  describe("Statistics", () => {
    describe("getStats", () => {
      test("should return correct stats for empty service", () => {
        const stats = userStateService.getStats();
        expect(stats).toEqual({
          totalUsers: 0,
          usersWithFilters: 0,
          usersWithViewports: 0,
        });
      });

      test("should return correct stats with users", () => {
        userStateService.registerUser(testUserId, testViewport, testFilters);
        userStateService.registerUser(testUserId2, testViewport2);
        userStateService.registerUser(testUserId3, undefined, testFilters);

        const stats = userStateService.getStats();
        expect(stats).toEqual({
          totalUsers: 3,
          usersWithFilters: 2,
          usersWithViewports: 2,
        });
      });

      test("should return correct stats when filter tracking is disabled", () => {
        const service = createUserStateService({ enableFilterTracking: false });
        service.registerUser(testUserId, testViewport, testFilters);

        const stats = service.getStats();
        expect(stats).toEqual({
          totalUsers: 1,
          usersWithFilters: 0,
          usersWithViewports: 1,
        });
      });

      test("should return correct stats when viewport tracking is disabled", () => {
        const service = createUserStateService({
          enableViewportTracking: false,
        });
        service.registerUser(testUserId, testViewport, testFilters);

        const stats = service.getStats();
        expect(stats).toEqual({
          totalUsers: 1,
          usersWithFilters: 1,
          usersWithViewports: 0,
        });
      });

      test("should return correct stats when both tracking are disabled", () => {
        const service = createUserStateService({
          enableFilterTracking: false,
          enableViewportTracking: false,
        });
        service.registerUser(testUserId, testViewport, testFilters);

        const stats = service.getStats();
        expect(stats).toEqual({
          totalUsers: 0,
          usersWithFilters: 0,
          usersWithViewports: 0,
        });
      });
    });
  });

  describe("Configuration", () => {
    test("should use default configuration when none provided", () => {
      const service = createUserStateService();

      // Should be able to set both filters and viewport
      service.setUserFilters(testUserId, testFilters);
      service.setUserViewport(testUserId, testViewport);

      expect(service.hasUserFilters(testUserId)).toBe(true);
      expect(service.hasUserViewport(testUserId)).toBe(true);
    });

    test("should respect custom maxUsers configuration", () => {
      const service = createUserStateService({ maxUsers: 1 });

      service.registerUser(testUserId, testViewport, testFilters);
      service.registerUser(testUserId2, testViewport2);

      // First user should be evicted
      expect(service.hasUserViewport(testUserId)).toBe(false);
      expect(service.hasUserFilters(testUserId)).toBe(false);
      expect(service.hasUserViewport(testUserId2)).toBe(true);
    });

    test("should respect enableFilterTracking configuration", () => {
      const service = createUserStateService({ enableFilterTracking: false });

      service.setUserFilters(testUserId, testFilters);
      expect(service.hasUserFilters(testUserId)).toBe(false);
      expect(service.getUserFilters(testUserId)).toEqual([]);
    });

    test("should respect enableViewportTracking configuration", () => {
      const service = createUserStateService({ enableViewportTracking: false });

      service.setUserViewport(testUserId, testViewport);
      expect(service.hasUserViewport(testUserId)).toBe(false);
      expect(service.getUserViewport(testUserId)).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    test("should handle multiple operations on same user", () => {
      userStateService.registerUser(testUserId, testViewport, testFilters);

      // Update filters
      const newFilters = [testFilters[0]];
      userStateService.setUserFilters(testUserId, newFilters);
      expect(userStateService.getUserFilters(testUserId)).toEqual(newFilters);

      // Update viewport
      userStateService.setUserViewport(testUserId, testViewport2);
      expect(userStateService.getUserViewport(testUserId)).toEqual(
        testViewport2,
      );

      // Remove filters
      userStateService.removeUserFilters(testUserId);
      expect(userStateService.hasUserFilters(testUserId)).toBe(false);

      // Remove viewport
      userStateService.removeUserViewport(testUserId);
      expect(userStateService.hasUserViewport(testUserId)).toBe(false);
    });

    test("should handle user limit eviction correctly", () => {
      const service = createUserStateService({ maxUsers: 2 });

      // Add users in order
      service.registerUser("user-1", testViewport, testFilters);
      service.registerUser("user-2", testViewport2);

      // Verify both exist
      expect(service.hasUserViewport("user-1")).toBe(true);
      expect(service.hasUserViewport("user-2")).toBe(true);

      // Add third user - should evict first
      service.registerUser("user-3", testViewport);

      expect(service.hasUserViewport("user-1")).toBe(false);
      expect(service.hasUserFilters("user-1")).toBe(false);
      expect(service.hasUserViewport("user-2")).toBe(true);
      expect(service.hasUserViewport("user-3")).toBe(true);
    });

    test("should handle empty and null values gracefully", () => {
      // Empty filters
      userStateService.setUserFilters(testUserId, []);
      expect(userStateService.getUserFilters(testUserId)).toEqual([]);
      expect(userStateService.hasUserFilters(testUserId)).toBe(true);

      // Empty viewport (should be undefined)
      userStateService.setUserViewport(testUserId, testViewport);
      userStateService.removeUserViewport(testUserId);
      expect(userStateService.getUserViewport(testUserId)).toBeUndefined();
      expect(userStateService.hasUserViewport(testUserId)).toBe(false);
    });
  });
});
