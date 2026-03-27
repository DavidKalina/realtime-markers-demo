import { MigrationInterface, QueryRunner } from "typeorm";

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
        CREATE TYPE "event_status_enum" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "event_source_enum" AS ENUM ('SCAN', 'TICKETMASTER');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "recurrence_frequency_enum" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "day_of_week_enum" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "rsvp_status_enum" AS ENUM ('GOING', 'NOT_GOING');
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

    // ── categories ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "description" text,
        "icon" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name")
      )
    `);

    // ── events ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "emoji" varchar NOT NULL DEFAULT '📍',
        "emoji_description" varchar,
        "title" varchar NOT NULL,
        "description" text,
        "event_date" timestamptz NOT NULL,
        "end_date" timestamptz,
        "timezone" varchar DEFAULT 'UTC',
        "address" text,
        "city" varchar,
        "location_notes" text,
        "location" geometry(Point, 4326),
        "scan_count" integer NOT NULL DEFAULT 0,
        "save_count" integer NOT NULL DEFAULT 0,
        "view_count" integer NOT NULL DEFAULT 0,
        "confidence_score" float,
        "embedding" text,
        "status" "event_status_enum" NOT NULL DEFAULT 'PENDING',
        "qr_url" text,
        "qr_code_data" text,
        "qr_image_path" text,
        "has_qr_code" boolean NOT NULL DEFAULT false,
        "is_official" boolean NOT NULL DEFAULT false,
        "source" "event_source_enum" NOT NULL DEFAULT 'SCAN',
        "external_id" varchar,
        "external_url" text,
        "qr_generated_at" timestamptz,
        "qr_detected_in_image" boolean NOT NULL DEFAULT false,
        "detected_qr_data" text,
        "event_digest" jsonb,
        "original_image_url" text,
        "creator_id" uuid,
        "is_recurring" boolean NOT NULL DEFAULT false,
        "recurrence_frequency" "recurrence_frequency_enum",
        "recurrence_days" "day_of_week_enum"[],
        "recurrence_start_date" timestamptz,
        "recurrence_end_date" timestamptz,
        "recurrence_interval" integer,
        "recurrence_time" time,
        "recurrence_exceptions" date[],
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_event_date" ON "events" ("event_date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_end_date" ON "events" ("end_date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_address" ON "events" ("address")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_status" ON "events" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_creator_id" ON "events" ("creator_id")`);

    // ── event_categories (junction) ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_categories" (
        "event_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        CONSTRAINT "PK_event_categories" PRIMARY KEY ("event_id", "category_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_event_categories_event" ON "event_categories" ("event_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_event_categories_category" ON "event_categories" ("category_id")`);

    // ── filters ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "filters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "semantic_query" text,
        "embedding" text,
        "emoji" varchar,
        "criteria" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_filters" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_filters_user_id" ON "filters" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_filters_is_active" ON "filters" ("is_active")`);

    // ── query_analytics ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "query_analytics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "query" text NOT NULL,
        "normalized_query" text NOT NULL,
        "total_searches" integer NOT NULL DEFAULT 0,
        "total_hits" integer NOT NULL DEFAULT 0,
        "zero_result_searches" integer NOT NULL DEFAULT 0,
        "average_results_per_search" float NOT NULL DEFAULT 0,
        "hit_rate" float NOT NULL DEFAULT 0,
        "first_searched_at" timestamp,
        "last_searched_at" timestamp,
        "top_results" jsonb,
        "search_categories" jsonb,
        "is_popular" boolean NOT NULL DEFAULT false,
        "needs_attention" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_query_analytics" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_query_analytics_query" ON "query_analytics" ("query")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_query_analytics_normalized" ON "query_analytics" ("normalized_query")`);

    // ── user_event_discoveries ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_event_discoveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "discovered_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_event_discoveries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_event_discoveries" UNIQUE ("user_id", "event_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ued_user_id" ON "user_event_discoveries" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ued_discovered_at" ON "user_event_discoveries" ("discovered_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ued_user_discovered" ON "user_event_discoveries" ("user_id", "discovered_at")`);

    // ── user_event_rsvps ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_event_rsvps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "status" "rsvp_status_enum" NOT NULL DEFAULT 'GOING',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_event_rsvps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_event_rsvps" UNIQUE ("user_id", "event_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_uer_user_id" ON "user_event_rsvps" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_uer_user_created" ON "user_event_rsvps" ("user_id", "created_at")`);

    // ── user_event_saves ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_event_saves" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "saved_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_event_saves" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_event_saves" UNIQUE ("user_id", "event_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ues_user_id" ON "user_event_saves" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ues_user_saved" ON "user_event_saves" ("user_id", "saved_at")`);

    // ── user_event_views ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_event_views" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "viewed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_event_views" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_event_views" UNIQUE ("user_id", "event_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_uev_user_id" ON "user_event_views" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_uev_user_viewed" ON "user_event_views" ("user_id", "viewed_at")`);

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

    // ── Foreign Keys ────────────────────────────────────────────────────
    // users
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_active_sidequest" FOREIGN KEY ("active_sidequest_id") REFERENCES "sidequests"("id") ON DELETE SET NULL`);

    // events
    await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_events_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL`);

    // event_categories
    await queryRunner.query(`ALTER TABLE "event_categories" ADD CONSTRAINT "FK_ec_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "event_categories" ADD CONSTRAINT "FK_ec_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE`);

    // filters
    await queryRunner.query(`ALTER TABLE "filters" ADD CONSTRAINT "FK_filters_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

    // user_event_*
    await queryRunner.query(`ALTER TABLE "user_event_discoveries" ADD CONSTRAINT "FK_ued_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_event_discoveries" ADD CONSTRAINT "FK_ued_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_event_rsvps" ADD CONSTRAINT "FK_uer_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_event_rsvps" ADD CONSTRAINT "FK_uer_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_event_saves" ADD CONSTRAINT "FK_ues_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_event_saves" ADD CONSTRAINT "FK_ues_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_event_views" ADD CONSTRAINT "FK_uev_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_event_views" ADD CONSTRAINT "FK_uev_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE`);

    // user_push_tokens
    await queryRunner.query(`ALTER TABLE "user_push_tokens" ADD CONSTRAINT "FK_upt_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

    // user_badges
    await queryRunner.query(`ALTER TABLE "user_badges" ADD CONSTRAINT "FK_ub_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

    // district_snapshots
    await queryRunner.query(`ALTER TABLE "district_snapshots" ADD CONSTRAINT "FK_ds_district" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE`);

    // sidequests
    await queryRunner.query(`ALTER TABLE "sidequests" ADD CONSTRAINT "FK_sidequests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "sidequests" ADD CONSTRAINT "FK_sidequests_parent" FOREIGN KEY ("parent_id") REFERENCES "sidequests"("id") ON DELETE CASCADE`);

    // objectives
    await queryRunner.query(`ALTER TABLE "objectives" ADD CONSTRAINT "FK_objectives_sidequest" FOREIGN KEY ("sidequest_id") REFERENCES "sidequests"("id") ON DELETE CASCADE`);

    // objective_checkins
    await queryRunner.query(`ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_oc_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_oc_sidequest" FOREIGN KEY ("sidequest_id") REFERENCES "sidequests"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_oc_objective" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "objective_checkins" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "objectives" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sidequests" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "district_snapshots" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "districts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "adventure_score_snapshots" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_badges" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "llm_usage_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_push_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_event_views" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_event_saves" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_event_rsvps" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_event_discoveries" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "query_analytics" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "filters" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_categories" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "sidequest_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "rsvp_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "day_of_week_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "recurrence_frequency_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "event_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "event_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
