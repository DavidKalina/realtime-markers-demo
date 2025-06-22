#!/usr/bin/env bun

import "reflect-metadata";
import { initializeDatabase } from "../data-source";
import {
  getDatabaseStatus,
  validateMigrations,
  validateTables,
  ensureDatabaseReadyForServices,
} from "../utils/databaseInitializer";

async function checkDatabaseSetup() {
  console.log("🔍 Checking database setup...\n");

  try {
    // Initialize database connection
    console.log("1. Initializing database connection...");
    const dataSource = await initializeDatabase();
    console.log("✅ Database connection established\n");

    // Get comprehensive status
    console.log("2. Checking database status...");
    const status = await getDatabaseStatus(dataSource);

    console.log("📊 Database Status:");
    console.log(
      `   Connection: ${status.isConnected ? "✅ Connected" : "❌ Disconnected"}`,
    );
    console.log(
      `   Migrations: ${status.migrationsRun ? "✅ All run" : "❌ Pending"}`,
    );
    console.log(
      `   Tables: ${status.tablesReady ? "✅ All exist" : "❌ Missing"}`,
    );

    if (status.lastMigration) {
      console.log(`   Last Migration: ${status.lastMigration}`);
    }

    if (status.pendingMigrations.length > 0) {
      console.log(
        `   Pending Migrations: ${status.pendingMigrations.join(", ")}`,
      );
    }

    if (status.missingTables.length > 0) {
      console.log(`   Missing Tables: ${status.missingTables.join(", ")}`);
    }

    console.log();

    // Detailed migration check
    console.log("3. Detailed migration validation...");
    const migrationStatus = await validateMigrations(dataSource);
    console.log(
      `   Migrations Run: ${migrationStatus.migrationsRun ? "✅" : "❌"}`,
    );
    console.log(
      `   Pending Count: ${migrationStatus.pendingMigrations.length}`,
    );
    console.log();

    // Detailed table check
    console.log("4. Detailed table validation...");
    const tableStatus = await validateTables(dataSource);
    console.log(`   Tables Ready: ${tableStatus.tablesReady ? "✅" : "❌"}`);
    console.log(`   Missing Count: ${tableStatus.missingTables.length}`);
    console.log();

    // Overall readiness check
    console.log("5. Overall database readiness...");
    try {
      await ensureDatabaseReadyForServices(dataSource);
      console.log("✅ Database is fully ready for service initialization");
    } catch (error) {
      console.log(`❌ Database not ready: ${(error as Error).message}`);
    }

    console.log("\n🎯 Summary:");
    if (status.isConnected && status.migrationsRun && status.tablesReady) {
      console.log("✅ Database setup is complete and ready for use");
    } else {
      console.log("❌ Database setup needs attention:");
      if (!status.isConnected) console.log("   - Database connection failed");
      if (!status.migrationsRun) console.log("   - Migrations need to be run");
      if (!status.tablesReady) console.log("   - Tables are missing");
    }
  } catch (error) {
    console.error("❌ Database setup check failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkDatabaseSetup();
