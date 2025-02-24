// src/database/migrations/1708646400000-InitialSchema.ts
import { type MigrationInterface, type QueryRunner } from "typeorm";

export class InitialSchema1708646400000 implements MigrationInterface {
  name = "InitialSchema1708646400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check and create extensions
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "postgis";
        CREATE EXTENSION IF NOT EXISTS "vector";
        CREATE EXTENSION IF NOT EXISTS "pg_trgm";
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating extensions: %', SQLERRM;
      END $$;
    `);

    // Drop existing enums if they exist
    await queryRunner.query(`
      DO $$ 
      BEGIN
        DROP TYPE IF EXISTS event_status CASCADE;
        DROP TYPE IF EXISTS third_space_status CASCADE;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping types: %', SQLERRM;
      END $$;
    `);

    // Create enums
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE event_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
        CREATE TYPE third_space_status AS ENUM ('bronze', 'silver', 'gold', 'platinum');
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating types: %', SQLERRM;
      END $$;
    `);

    // Drop tables if they exist
    await queryRunner.query(`
      DO $$ 
      BEGIN
        DROP TABLE IF EXISTS "event_categories" CASCADE;
        DROP TABLE IF EXISTS "events" CASCADE;
        DROP TABLE IF EXISTS "third_spaces" CASCADE;
        DROP TABLE IF EXISTS "categories" CASCADE;
        DROP TABLE IF EXISTS "seed_status" CASCADE;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping tables: %', SQLERRM;
      END $$;
    `);

    // Create tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL UNIQUE,
        "description" text,
        "icon" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "third_spaces" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "location" geometry(Point, 4326) NOT NULL,
        "status" third_space_status,
        "event_count" integer NOT NULL DEFAULT 0,
        "diversity_score" float,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "emoji" varchar DEFAULT '📍',
        "title" varchar NOT NULL,
        "description" text,
        "event_date" timestamptz NOT NULL,
        "address" text,
        "location" geometry(Point, 4326) NOT NULL,
        "scan_count" integer NOT NULL DEFAULT 1,
        "confidence_score" float,
        "embedding" text,
        "status" event_status NOT NULL DEFAULT 'PENDING',
        "thirdSpaceId" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_event_third_space" FOREIGN KEY ("thirdSpaceId") 
          REFERENCES "third_spaces"("id") ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS "event_categories" (
        "event_id" uuid REFERENCES "events"("id") ON DELETE CASCADE,
        "category_id" uuid REFERENCES "categories"("id") ON DELETE CASCADE,
        PRIMARY KEY ("event_id", "category_id")
      );

      CREATE TABLE IF NOT EXISTS "seed_status" (
        "seed_name" varchar PRIMARY KEY,
        "completed" boolean NOT NULL DEFAULT false,
        "timestamp" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Create indexes
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE INDEX IF NOT EXISTS "idx_events_location" ON "events" USING GIST ("location");
        CREATE INDEX IF NOT EXISTS "idx_third_spaces_location" ON "third_spaces" USING GIST ("location");
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating indexes: %', SQLERRM;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop everything in reverse order
    await queryRunner.query(`
      DO $$ 
      BEGIN
        -- Drop indexes
        DROP INDEX IF EXISTS "idx_events_location";
        DROP INDEX IF EXISTS "idx_third_spaces_location";
        
        -- Drop tables
        DROP TABLE IF EXISTS "event_categories" CASCADE;
        DROP TABLE IF EXISTS "events" CASCADE;
        DROP TABLE IF EXISTS "third_spaces" CASCADE;
        DROP TABLE IF EXISTS "categories" CASCADE;
        DROP TABLE IF EXISTS "seed_status" CASCADE;
        
        -- Drop types
        DROP TYPE IF EXISTS event_status CASCADE;
        DROP TYPE IF EXISTS third_space_status CASCADE;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error in down migration: %', SQLERRM;
      END $$;
    `);
  }
}

// src/database/init.ts
import { DataSource } from "typeorm";

export async function initializeDatabase(dataSource: DataSource) {
  try {
    // Try to connect
    await dataSource.initialize();
    console.log("Connected to database");

    // Check if migrations table exists
    const hasMigrationsTable = await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);

    if (!hasMigrationsTable[0].exists) {
      console.log("No migrations table found - cleaning state before migrations");

      // Drop everything first
      await dataSource.query(`
        DO $$ 
        DECLARE 
          r RECORD;
        BEGIN
          -- Drop tables
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;

          -- Drop types
          FOR r IN (SELECT t.typname 
                    FROM pg_type t 
                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace 
                    WHERE n.nspname = 'public' AND t.typtype = 'e') 
          LOOP
            EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
        END $$;
      `);
    }

    // Run migrations
    await dataSource.runMigrations();
    console.log("Database initialization completed successfully");

    return true;
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}
