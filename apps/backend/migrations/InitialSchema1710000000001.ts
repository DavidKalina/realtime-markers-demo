import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1710000000001 implements MigrationInterface {
  name = "InitialSchema1710000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Extensions ──────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);

    // ── Enums ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sidequest_status_enum" AS ENUM ('GENERATING', 'READY', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ── users ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL,
        "first_name" varchar,
        "last_name" varchar,
        "phone" varchar,
        "password_hash" varchar,
        "avatar_url" varchar,
        "bio" text,
        "role" "user_role_enum" NOT NULL DEFAULT 'USER',
        "is_verified" boolean NOT NULL DEFAULT false,
        "discovery_count" integer NOT NULL DEFAULT 0,
        "scan_count" integer NOT NULL DEFAULT 0,
        "save_count" integer NOT NULL DEFAULT 0,
        "view_count" integer NOT NULL DEFAULT 0,
        "total_xp" integer NOT NULL DEFAULT 0,
        "current_tier" varchar(20) NOT NULL DEFAULT 'Explorer',
        "weekly_scan_count" integer NOT NULL DEFAULT 0,
        "last_scan_reset" timestamptz,
        "current_streak" integer NOT NULL DEFAULT 0,
        "longest_streak" integer NOT NULL DEFAULT 0,
        "last_streak_week" date,
        "contacts" jsonb,
        "preference_embedding" text,
        "onboarding_profile" jsonb,
        "active_sidequest_id" uuid,
        "refresh_token" varchar,
        "password_reset_token" varchar,
        "password_reset_expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`);

    // Handle existing databases: add active_sidequest_id if users table existed but column doesn't
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "users" ADD COLUMN "active_sidequest_id" uuid;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);

    // ── user_push_tokens ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_push_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token" text NOT NULL,
        "device_info" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_used_at" timestamp,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_push_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_push_tokens" UNIQUE ("user_id", "token")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_upt_token" ON "user_push_tokens" ("token")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_upt_is_active" ON "user_push_tokens" ("is_active")`);

    // ── llm_usage_logs ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "llm_usage_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "model" varchar NOT NULL,
        "operation" varchar NOT NULL,
        "caller" varchar NOT NULL,
        "prompt_tokens" integer NOT NULL,
        "completion_tokens" integer NOT NULL,
        "total_tokens" integer NOT NULL,
        "estimated_cost" numeric(10,6) NOT NULL,
        "duration_ms" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_llm_usage_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_llm_model" ON "llm_usage_logs" ("model")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_llm_created_at" ON "llm_usage_logs" ("created_at")`);

    // ── user_badges ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "badge_id" varchar(50) NOT NULL,
        "progress" integer NOT NULL DEFAULT 0,
        "unlocked_at" timestamptz,
        CONSTRAINT "PK_user_badges" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_badges" UNIQUE ("user_id", "badge_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ub_user_id" ON "user_badges" ("user_id")`);

    // ── adventure_score_snapshots ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "adventure_score_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "score" integer NOT NULL,
        "activity_score" integer NOT NULL,
        "consistency_score" integer NOT NULL,
        "diversity_score" integer NOT NULL,
        "completion_score" integer NOT NULL,
        "discovery_score" integer NOT NULL,
        "computed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_adventure_score_snapshots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ass_user_computed" ON "adventure_score_snapshots" ("user_id", "computed_at")`);

    // ── districts ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "districts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL,
        "description" text,
        "geohash" varchar(12) NOT NULL,
        "centroid_lat" numeric(10,7) NOT NULL,
        "centroid_lng" numeric(10,7) NOT NULL,
        "embedding_centroid" text,
        "activity_tags" text[] NOT NULL DEFAULT '{}',
        "avg_rating" numeric(3,2) NOT NULL DEFAULT 0,
        "total_adoptions" integer NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "last_clustered_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_districts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_districts_geohash" ON "districts" ("geohash")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_districts_status" ON "districts" ("status")`);

    // ── district_snapshots ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "district_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "district_id" uuid NOT NULL,
        "itinerary_count" integer NOT NULL,
        "unique_explorers" integer NOT NULL DEFAULT 0,
        "weekly_adoptions" integer NOT NULL DEFAULT 0,
        "weekly_new_itineraries" integer NOT NULL DEFAULT 0,
        "avg_rating" numeric(3,2) NOT NULL DEFAULT 0,
        "computed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_district_snapshots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ds_district_id" ON "district_snapshots" ("district_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ds_district_computed" ON "district_snapshots" ("district_id", "computed_at")`);

    // ── sidequests ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sidequests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "city" varchar(255) NOT NULL,
        "prompt" text,
        "radius_miles" numeric(5,1),
        "budget_max" numeric(10,2) NOT NULL DEFAULT 0,
        "title" varchar(500),
        "summary" text,
        "status" "sidequest_status_enum" NOT NULL DEFAULT 'GENERATING',
        "activity_types" text[] NOT NULL DEFAULT '{}',
        "intention" varchar(50),
        "parent_id" uuid,
        "share_token" uuid,
        "rating" smallint,
        "rating_comment" text,
        "completed_at" timestamptz,
        "is_published" boolean NOT NULL DEFAULT false,
        "times_adopted" integer NOT NULL DEFAULT 0,
        "embedding" text,
        "categories" text[] NOT NULL DEFAULT '{}',
        "entry_latitude" numeric(10,7),
        "entry_longitude" numeric(10,7),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_sidequests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sidequests_user_id" ON "sidequests" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sidequests_city" ON "sidequests" ("city")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sidequests_parent_id" ON "sidequests" ("parent_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sidequests_share_token" ON "sidequests" ("share_token") WHERE "share_token" IS NOT NULL`);

    // ── objectives ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "objectives" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sidequest_id" uuid NOT NULL,
        "sort_order" integer NOT NULL,
        "title" varchar(500) NOT NULL,
        "description" text,
        "emoji" varchar(10),
        "estimated_cost" numeric(10,2),
        "venue_name" varchar(500),
        "venue_address" varchar(500),
        "venue_category" varchar(100),
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "hook" text,
        "checked_in_at" timestamptz,
        "entry_latitude" numeric(10,7),
        "entry_longitude" numeric(10,7),
        "entry_point_name" varchar(500),
        "embedding" text,
        CONSTRAINT "PK_objectives" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_objectives_sidequest_id" ON "objectives" ("sidequest_id")`);

    // ── objective_checkins ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "objective_checkins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "sidequest_id" uuid NOT NULL,
        "objective_id" uuid NOT NULL,
        "user_latitude" numeric(10,7),
        "user_longitude" numeric(10,7),
        "distance_meters" numeric(8,2),
        "source" varchar(20) NOT NULL DEFAULT 'proximity',
        "objective_sort_order" integer NOT NULL,
        "skipped_objective_ids" uuid[] NOT NULL DEFAULT '{}',
        "checked_in_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_objective_checkins" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oc_user_sidequest" ON "objective_checkins" ("user_id", "sidequest_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oc_sidequest_id" ON "objective_checkins" ("sidequest_id")`);

    // ── Foreign Keys (idempotent) ───────────────────────────────────────
    // Use DO blocks to skip if constraint already exists
    const addFKIfNotExists = async (name: string, sql: string) => {
      await queryRunner.query(`
        DO $$ BEGIN
          ${sql};
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
      `);
    };

    await addFKIfNotExists("FK_users_active_sidequest",
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_active_sidequest" FOREIGN KEY ("active_sidequest_id") REFERENCES "sidequests"("id") ON DELETE SET NULL`);

    await addFKIfNotExists("FK_upt_user",
      `ALTER TABLE "user_push_tokens" ADD CONSTRAINT "FK_upt_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

    await addFKIfNotExists("FK_ub_user",
      `ALTER TABLE "user_badges" ADD CONSTRAINT "FK_ub_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

    await addFKIfNotExists("FK_ds_district",
      `ALTER TABLE "district_snapshots" ADD CONSTRAINT "FK_ds_district" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE`);

    await addFKIfNotExists("FK_sidequests_user",
      `ALTER TABLE "sidequests" ADD CONSTRAINT "FK_sidequests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

    await addFKIfNotExists("FK_sidequests_parent",
      `ALTER TABLE "sidequests" ADD CONSTRAINT "FK_sidequests_parent" FOREIGN KEY ("parent_id") REFERENCES "sidequests"("id") ON DELETE CASCADE`);

    await addFKIfNotExists("FK_objectives_sidequest",
      `ALTER TABLE "objectives" ADD CONSTRAINT "FK_objectives_sidequest" FOREIGN KEY ("sidequest_id") REFERENCES "sidequests"("id") ON DELETE CASCADE`);

    await addFKIfNotExists("FK_oc_user",
      `ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_oc_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

    await addFKIfNotExists("FK_oc_sidequest",
      `ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_oc_sidequest" FOREIGN KEY ("sidequest_id") REFERENCES "sidequests"("id") ON DELETE CASCADE`);

    await addFKIfNotExists("FK_oc_objective",
      `ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_oc_objective" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "objective_checkins" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "objectives" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sidequests" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "district_snapshots" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "districts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "adventure_score_snapshots" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_badges" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "llm_usage_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_push_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);

    await queryRunner.query(`DROP TYPE IF EXISTS "sidequest_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
