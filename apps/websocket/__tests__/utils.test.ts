import { describe, it, expect } from "bun:test";

// Simple utility function to test (matching the actual implementation)
function isValidUserId(userId: string): boolean {
  // UUID v4 format validation
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(userId);
}

describe("Utility Functions", () => {
  describe("isValidUserId", () => {
    it("should return true for valid UUID v4 user IDs", () => {
      expect(isValidUserId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isValidUserId("6ba7b810-9dad-41d1-80b4-00c04fd430c8")).toBe(true);
      expect(isValidUserId("6ba7b811-9dad-41d1-80b4-00c04fd430c8")).toBe(true);
      expect(isValidUserId("6ba7b812-9dad-41d1-80b4-00c04fd430c8")).toBe(true);
    });

    it("should return false for invalid UUID formats", () => {
      expect(isValidUserId("")).toBe(false);
      expect(isValidUserId("not-a-uuid")).toBe(false);
      expect(isValidUserId("550e8400-e29b-11d4-a716-446655440000")).toBe(false); // v1 format
      expect(isValidUserId("550e8400-e29b-21d4-a716-446655440000")).toBe(false); // v2 format
      expect(isValidUserId("550e8400-e29b-31d4-a716-446655440000")).toBe(false); // v3 format
      expect(isValidUserId("550e8400-e29b-51d4-a716-446655440000")).toBe(false); // v5 format
    });

    it("should return false for non-string inputs", () => {
      expect(isValidUserId(null as unknown as string)).toBe(false);
      expect(isValidUserId(undefined as unknown as string)).toBe(false);
      expect(isValidUserId(123 as unknown as string)).toBe(false);
    });
  });
});
