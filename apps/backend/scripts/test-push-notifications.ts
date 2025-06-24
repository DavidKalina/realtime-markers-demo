#!/usr/bin/env bun

import "reflect-metadata";
import { Expo } from "expo-server-sdk";
import AppDataSource, { initializeDatabase } from "../data-source";
import { pushNotificationService } from "../services/PushNotificationService";

async function testPushNotifications() {
  console.log("🧪 Testing Push Notification Service...");

  try {
    // Initialize database
    console.log("📊 Initializing database...");
    await initializeDatabase();
    console.log("✅ Database initialized");

    // Test 1: Get statistics
    console.log("\n📈 Testing statistics...");
    const stats = await pushNotificationService.getStats();
    console.log("📊 Push notification stats:", stats);

    // Test 2: Clean up invalid tokens
    console.log("\n🧹 Testing token cleanup...");
    const cleanedCount = await pushNotificationService.cleanupInvalidTokens();
    console.log(`✅ Cleaned up ${cleanedCount} invalid tokens`);

    // Test 3: Test with a sample Expo push token (this is a fake token for testing)
    console.log("\n🔔 Testing token validation...");
    const fakeToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
    const isValid = Expo.isExpoPushToken(fakeToken);
    console.log(
      `Token validation test: ${isValid ? "✅ Valid" : "❌ Invalid"}`,
    );

    // Test 4: Test sending to invalid token (should not crash)
    console.log("\n📤 Testing send to invalid token...");
    const result = await pushNotificationService.sendToTokens([fakeToken], {
      title: "Test Notification",
      body: "This is a test notification",
      data: { test: true },
    });
    console.log("📤 Send result:", result);

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run the test
testPushNotifications().catch(console.error);
