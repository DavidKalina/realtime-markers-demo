#!/usr/bin/env bun

import {
  createEmailService,
  MockEmailService,
} from "../services/shared/EmailService";

async function testEmailService() {
  console.log("🧪 Testing Email Service...\n");

  // Test with mock service (no API key needed)
  const mockService = new MockEmailService();

  console.log("1. Testing Mock Email Service:");

  const mockResult = await mockService.sendAdminAddedNotification(
    "test@example.com",
    "Test User",
    "admin@example.com",
  );

  console.log(
    `   Mock service result: ${mockResult ? "✅ Success" : "❌ Failed"}\n`,
  );

  // Test with real service if API key is available
  if (process.env.RESEND_API_KEY) {
    console.log("2. Testing Real Email Service:");

    const realService = createEmailService({
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM || "noreply@yourdomain.com",
      adminEmails: process.env.ADMIN_EMAILS?.split(",") || ["test@example.com"],
    });

    try {
      const realResult = await realService.sendAdminAddedNotification(
        "newadmin@example.com",
        "New Admin User",
        "admin@example.com",
      );

      console.log(
        `   Real service result: ${realResult ? "✅ Success" : "❌ Failed"}`,
      );
    } catch (error) {
      console.log(`   Real service error: ${error}`);
    }
  } else {
    console.log("2. Skipping Real Email Service (no RESEND_API_KEY found)");
    console.log(
      "   To test real emails, set RESEND_API_KEY in your environment",
    );
  }

  console.log("\n✅ Email service test completed!");
}

// Run the test
testEmailService().catch(console.error);
