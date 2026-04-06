import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1775427897079 implements MigrationInterface {
  name = "InitialSchema1775427897079";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "objectives" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sidequest_id" uuid NOT NULL, "sort_order" integer NOT NULL, "title" character varying(500) NOT NULL, "description" text, "emoji" character varying(10), "estimated_cost" numeric(10,2), "venue_name" character varying(500), "venue_address" character varying(500), "venue_category" character varying(100), "latitude" numeric(10,7), "longitude" numeric(10,7), "hook" text, "checked_in_at" TIMESTAMP WITH TIME ZONE, "entry_latitude" numeric(10,7), "entry_longitude" numeric(10,7), "entry_point_name" character varying(500), "embedding" text, "suggested_activities" text array NOT NULL DEFAULT '{}', "action_items" text array NOT NULL DEFAULT '{}', "completed_activity" character varying(2000), "photo_url" character varying(500), "journal_prompt" character varying(500), "journal_entry" text, "social_context" character varying(50), "difficulty" smallint, "reflection_depth" real, "reflection_sentiment" real, "reflection_tags" jsonb, "actionability" character varying(20), "predicted_anxiety" smallint, "predicted_difficulty" smallint, "predicted_outcome" text, CONSTRAINT "PK_c54846771e6a2db24c2b886eca0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9f4b7d96ca2fc123fc7a1a1f4d" ON "objectives" ("sidequest_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sidequests_status_enum" AS ENUM('GENERATING', 'READY', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sidequests_tier_enum" AS ENUM('QUICK', 'SWEET_SPOT', 'BEST')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sidequests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "city" character varying(255) NOT NULL, "prompt" text, "radius_miles" numeric(5,1), "budget_max" numeric(10,2) NOT NULL DEFAULT '0', "title" character varying(500), "summary" text, "status" "public"."sidequests_status_enum" NOT NULL DEFAULT 'GENERATING', "activity_types" text array NOT NULL DEFAULT '{}', "intention" character varying(50), "tier" "public"."sidequests_tier_enum", "parent_id" uuid, "share_token" uuid, "rating" smallint, "rating_comment" text, "completed_at" TIMESTAMP WITH TIME ZONE, "promoted_at" TIMESTAMP WITH TIME ZONE, "is_published" boolean NOT NULL DEFAULT false, "times_adopted" integer NOT NULL DEFAULT '0', "embedding" text, "categories" text array NOT NULL DEFAULT '{}', "rarity" character varying(20), "prescribed" boolean NOT NULL DEFAULT false, "batch_id" uuid, "batch_index" smallint, "pathway_id" uuid, "pathway_theme" character varying(100), "pathway_label" character varying(200), "pathway_phase" character varying(10), "quest_role" character varying(20), "distance_from_home" numeric(8,2), "entry_latitude" numeric(10,7), "entry_longitude" numeric(10,7), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d44782e52768da529330e3f657e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_355e721ad4888fb5fd6b22baad" ON "sidequests" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_012d749017d350937369e5360b" ON "sidequests" ("city") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a614a14953814ddb38e5dd84fa" ON "sidequests" ("parent_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7b7658e98da6aaa4c58f572c0c" ON "sidequests" ("share_token") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9f15b5787b71a0e045eb4c4794" ON "sidequests" ("batch_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'MODERATOR', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "first_name" character varying, "last_name" character varying, "phone" character varying, "password_hash" character varying, "avatar_url" character varying, "bio" text, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "is_verified" boolean NOT NULL DEFAULT false, "discovery_count" integer NOT NULL DEFAULT '0', "scan_count" integer NOT NULL DEFAULT '0', "save_count" integer NOT NULL DEFAULT '0', "view_count" integer NOT NULL DEFAULT '0', "total_xp" integer NOT NULL DEFAULT '0', "current_tier" character varying(20) NOT NULL DEFAULT 'Explorer', "weekly_scan_count" integer NOT NULL DEFAULT '0', "last_scan_reset" TIMESTAMP WITH TIME ZONE, "current_streak" integer NOT NULL DEFAULT '0', "longest_streak" integer NOT NULL DEFAULT '0', "last_streak_week" date, "contacts" jsonb, "preference_embedding" text, "onboarding_profile" jsonb, "home_latitude" numeric(10,7), "home_longitude" numeric(10,7), "comfort_radius_miles" numeric(5,1), "pace_preference" character varying(20), "comfort_profile" jsonb, "fear_ladder" jsonb, "behavioral_profile" jsonb, "active_sidequest_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "refresh_token" character varying, "password_reset_token" character varying, "password_reset_expires_at" TIMESTAMP WITH TIME ZONE, "expectancy_calibration" jsonb, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_push_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token" text NOT NULL, "device_info" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "last_used_at" TIMESTAMP, "is_active" boolean NOT NULL DEFAULT true, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8c8f0464a60f972981a76fe0ef5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4dd8e8d11d7bcfa00ef7188fe2" ON "user_push_tokens" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d6456dfc0da765c6f7b5a2b628" ON "user_push_tokens" ("token") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_77f0fb3b85ee1d82512eb8a2a2" ON "user_push_tokens" ("user_id", "token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "llm_usage_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "model" character varying NOT NULL, "operation" character varying NOT NULL, "caller" character varying NOT NULL, "prompt_tokens" integer NOT NULL, "completion_tokens" integer NOT NULL, "total_tokens" integer NOT NULL, "estimated_cost" numeric(10,6) NOT NULL, "duration_ms" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bc47f346679bdd0e72412411c55" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_06546093807b2be73a325149fb" ON "llm_usage_logs" ("model") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5312198b045b9e05c1fd5b5e32" ON "llm_usage_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "objective_checkins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "sidequest_id" uuid NOT NULL, "objective_id" uuid NOT NULL, "user_latitude" numeric(10,7), "user_longitude" numeric(10,7), "distance_meters" numeric(8,2), "source" character varying(20) NOT NULL DEFAULT 'proximity', "objective_sort_order" integer NOT NULL, "skipped_objective_ids" uuid array NOT NULL DEFAULT '{}', "checked_in_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_21e95fd8f6fd351fa58a2948586" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2c6161407fbcf3704edffb29f" ON "objective_checkins" ("sidequest_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_57b4d07a7d795772c76ec0442d" ON "objective_checkins" ("user_id", "sidequest_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_badges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "badge_id" character varying(50) NOT NULL, "progress" integer NOT NULL DEFAULT '0', "unlocked_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "UQ_201b6e34825dc5bd06181320bde" UNIQUE ("user_id", "badge_id"), CONSTRAINT "PK_0ca139216824d745a930065706a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1221d9b1aaa64b1f3c98ed46d" ON "user_badges" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "coverage_clusters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "latitude" numeric(10,7) NOT NULL, "longitude" numeric(10,7) NOT NULL, "visit_count" integer NOT NULL DEFAULT '1', "shade" numeric(4,3) NOT NULL DEFAULT '0', "venue_categories" text array NOT NULL DEFAULT '{}', "last_visited_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_169b85483bd5e62ff2206424d5c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fab14d780032ed8a450ba22175" ON "coverage_clusters" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "coverage_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "cells_geojson" jsonb, "canvas_geojson" jsonb, "coverage_pct" numeric(5,2) NOT NULL DEFAULT '0', "territory_sq_miles" numeric(10,3) NOT NULL DEFAULT '0', "avg_density" numeric(4,3) NOT NULL DEFAULT '0', "frontier_miles" numeric(10,3) NOT NULL DEFAULT '0', "cluster_count" integer NOT NULL DEFAULT '0', "directional_gaps" jsonb, "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3335a348b92d3e535d8c5080e2a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_00b3e02a384367a2ffd869df9e" ON "coverage_snapshots" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "goal_reflections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "milestone" character varying(50) NOT NULL, "journal_entry" text NOT NULL, "journal_prompt" text, "percent_elapsed" smallint, "remaining_days" smallint, "completed_quest_count" smallint, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_goal_reflections" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goal_reflections_user_id" ON "goal_reflections" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "pathways" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "theme" character varying(200) NOT NULL, "theme_label" character varying(200), "venue_categories" text array NOT NULL DEFAULT '{}', "avg_resonance" numeric(4,3) NOT NULL DEFAULT '0', "quest_count" integer NOT NULL DEFAULT '0', "current_difficulty" smallint NOT NULL DEFAULT '1', "difficulty_trend" numeric(4,3) NOT NULL DEFAULT '0', "phase" character varying(10) NOT NULL DEFAULT 'bfs', "sidequest_ids" uuid array NOT NULL DEFAULT '{}', "resonance_scores" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bfba58a2ba7d08c64412da85630" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3dd477a6ca21bc16000b848f3a" ON "pathways" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD CONSTRAINT "FK_9f4b7d96ca2fc123fc7a1a1f4d6" FOREIGN KEY ("sidequest_id") REFERENCES "sidequests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sidequests" ADD CONSTRAINT "FK_355e721ad4888fb5fd6b22baad2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sidequests" ADD CONSTRAINT "FK_a614a14953814ddb38e5dd84fab" FOREIGN KEY ("parent_id") REFERENCES "sidequests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_e90b1cf8e432be7336a0f39b10a" FOREIGN KEY ("active_sidequest_id") REFERENCES "sidequests"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_tokens" ADD CONSTRAINT "FK_7ad1e7f0a4616a2998d921cb12f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_1fed4b95dc47cd40bc7b9a4db7a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_d2c6161407fbcf3704edffb29f5" FOREIGN KEY ("sidequest_id") REFERENCES "sidequests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "objective_checkins" ADD CONSTRAINT "FK_6e9d5077858c2cac00c89fa7827" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_badges" ADD CONSTRAINT "FK_f1221d9b1aaa64b1f3c98ed46d3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_badges" DROP CONSTRAINT "FK_f1221d9b1aaa64b1f3c98ed46d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "objective_checkins" DROP CONSTRAINT "FK_6e9d5077858c2cac00c89fa7827"`,
    );
    await queryRunner.query(
      `ALTER TABLE "objective_checkins" DROP CONSTRAINT "FK_d2c6161407fbcf3704edffb29f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "objective_checkins" DROP CONSTRAINT "FK_1fed4b95dc47cd40bc7b9a4db7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_tokens" DROP CONSTRAINT "FK_7ad1e7f0a4616a2998d921cb12f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_e90b1cf8e432be7336a0f39b10a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sidequests" DROP CONSTRAINT "FK_a614a14953814ddb38e5dd84fab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sidequests" DROP CONSTRAINT "FK_355e721ad4888fb5fd6b22baad2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" DROP CONSTRAINT "FK_9f4b7d96ca2fc123fc7a1a1f4d6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3dd477a6ca21bc16000b848f3a"`,
    );
    await queryRunner.query(`DROP TABLE "pathways"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_00b3e02a384367a2ffd869df9e"`,
    );
    await queryRunner.query(`DROP TABLE "coverage_snapshots"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fab14d780032ed8a450ba22175"`,
    );
    await queryRunner.query(`DROP TABLE "coverage_clusters"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f1221d9b1aaa64b1f3c98ed46d"`,
    );
    await queryRunner.query(`DROP TABLE "user_badges"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_57b4d07a7d795772c76ec0442d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d2c6161407fbcf3704edffb29f"`,
    );
    await queryRunner.query(`DROP TABLE "objective_checkins"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5312198b045b9e05c1fd5b5e32"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_06546093807b2be73a325149fb"`,
    );
    await queryRunner.query(`DROP TABLE "llm_usage_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77f0fb3b85ee1d82512eb8a2a2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d6456dfc0da765c6f7b5a2b628"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4dd8e8d11d7bcfa00ef7188fe2"`,
    );
    await queryRunner.query(`DROP TABLE "user_push_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9f15b5787b71a0e045eb4c4794"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7b7658e98da6aaa4c58f572c0c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a614a14953814ddb38e5dd84fa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_012d749017d350937369e5360b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_355e721ad4888fb5fd6b22baad"`,
    );
    await queryRunner.query(`DROP TABLE "sidequests"`);
    await queryRunner.query(`DROP TYPE "public"."sidequests_tier_enum"`);
    await queryRunner.query(`DROP TYPE "public"."sidequests_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9f4b7d96ca2fc123fc7a1a1f4d"`,
    );
    await queryRunner.query(`DROP TABLE "objectives"`);
  }
}
