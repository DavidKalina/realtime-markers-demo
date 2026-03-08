import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryItemGeoData1710000000036 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "itinerary_items"
        ADD COLUMN "latitude" numeric(10,7),
        ADD COLUMN "longitude" numeric(10,7),
        ADD COLUMN "google_place_id" varchar(255),
        ADD COLUMN "google_rating" numeric(2,1),
        ADD COLUMN "venue_category" varchar(100),
        ADD COLUMN "why_this_stop" text,
        ADD COLUMN "pro_tip" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "itinerary_items"
        DROP COLUMN IF EXISTS "latitude",
        DROP COLUMN IF EXISTS "longitude",
        DROP COLUMN IF EXISTS "google_place_id",
        DROP COLUMN IF EXISTS "google_rating",
        DROP COLUMN IF EXISTS "venue_category",
        DROP COLUMN IF EXISTS "why_this_stop",
        DROP COLUMN IF EXISTS "pro_tip"
    `);
  }
}
