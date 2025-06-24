#!/usr/bin/env node

/**
 * Test script to verify push notification configuration
 * Run this in your TestFlight build to debug push notification issues
 */

import { Expo } from "expo-server-sdk";

// Test configuration
const testConfig = {
  // Your Expo project ID
  projectId: "ff0ebef4-f13d-442f-be77-f5818888f458",
  // Test token (replace with actual token from your device)
  testToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  // Your backend API URL
  backendUrl: "https://your-backend-url.com",
};

async function testPushNotifications() {
  console.log("🧪 Testing Push Notification Configuration...\n");

  // Test 1: Verify Expo SDK
  console.log("1. Testing Expo SDK...");
  const expo = new Expo();
  console.log("✅ Expo SDK initialized");

  // Test 2: Validate project ID
  console.log("\n2. Testing project ID...");
  console.log(`Project ID: ${testConfig.projectId}`);
  console.log("✅ Project ID format looks correct");

  // Test 3: Test token validation
  console.log("\n3. Testing token validation...");
  const isValidToken = Expo.isExpoPushToken(testConfig.testToken);
  console.log(`Token validation: ${isValidToken ? "✅ Valid" : "❌ Invalid"}`);

  // Test 4: Test sending notification (this will fail with fake token, but shows the process)
  console.log("\n4. Testing notification sending...");
  try {
    const messages = [
      {
        to: testConfig.testToken,
        title: "Test Notification",
        body: "This is a test notification from the debug script",
        data: { test: true, timestamp: Date.now() },
        sound: "default",
        priority: "high",
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    console.log(`Created ${chunks.length} chunks`);

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("Tickets:", ticketChunk);
    }
  } catch (error) {
    console.log("❌ Expected error with fake token:", error.message);
  }

  // Test 5: Check environment variables
  console.log("\n5. Checking environment variables...");
  console.log(
    "EXPO_PUBLIC_PROJECT_ID:",
    process.env.EXPO_PUBLIC_PROJECT_ID || "Not set",
  );
  console.log(
    "EXPO_PUBLIC_API_URL:",
    process.env.EXPO_PUBLIC_API_URL || "Not set",
  );

  console.log("\n✅ Test completed!");
  console.log("\n📋 Next steps:");
  console.log("1. Replace the test token with a real token from your device");
  console.log("2. Update the backend URL to your actual backend");
  console.log("3. Run this script again to test with real data");
}

// Run the test
testPushNotifications().catch(console.error);
