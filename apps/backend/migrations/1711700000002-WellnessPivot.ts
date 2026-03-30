import type { MigrationInterface, QueryRunner } from "typeorm";

export class WellnessPivot1711700000002 implements MigrationInterface {
  name = "WellnessPivot1711700000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // User: home anchor, comfort zone, pace
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "home_latitude" numeric(10,7),
        ADD COLUMN "home_longitude" numeric(10,7),
        ADD COLUMN "comfort_radius_miles" numeric(5,1),
        ADD COLUMN "pace_preference" varchar(20),
        ADD COLUMN "comfort_profile" jsonb
    `);

    // Sidequest: rarity, prescribed flag, distance from home
    await queryRunner.query(`
      ALTER TABLE "sidequests"
        ADD COLUMN "rarity" varchar(20),
        ADD COLUMN "prescribed" boolean NOT NULL DEFAULT false,
        ADD COLUMN "distance_from_home" numeric(8,2)
    `);

    // Objective: activity suggestions, photo, journal
    await queryRunner.query(`
      ALTER TABLE "objectives"
        ADD COLUMN "suggested_activities" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "completed_activity" varchar(200),
        ADD COLUMN "photo_url" varchar(500),
        ADD COLUMN "journal_prompt" varchar(500),
        ADD COLUMN "journal_entry" text,
        ADD COLUMN "difficulty" smallint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "objectives"
        DROP COLUMN "difficulty",
        DROP COLUMN "journal_entry",
        DROP COLUMN "journal_prompt",
        DROP COLUMN "photo_url",
        DROP COLUMN "completed_activity",
        DROP COLUMN "suggested_activities"
    `);

    await queryRunner.query(`
      ALTER TABLE "sidequests"
        DROP COLUMN "distance_from_home",
        DROP COLUMN "prescribed",
        DROP COLUMN "rarity"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "comfort_profile",
        DROP COLUMN "pace_preference",
        DROP COLUMN "comfort_radius_miles",
        DROP COLUMN "home_longitude",
        DROP COLUMN "home_latitude"
    `);
  }
}
