import type { MigrationInterface, QueryRunner } from "typeorm";

export class ItineraryRadiusAndUnstructured1710000000071
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add center point + radius to itineraries (replaces city-based scoping)
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN "center_latitude" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN "center_longitude" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN "radius_miles" numeric(6,2) DEFAULT 10`,
    );

    // Backfill center coords from existing entry coords
    await queryRunner.query(
      `UPDATE "itineraries"
       SET "center_latitude" = "entry_latitude",
           "center_longitude" = "entry_longitude"
       WHERE "entry_latitude" IS NOT NULL`,
    );

    // Index for proximity-based browsing
    await queryRunner.query(
      `CREATE INDEX "IDX_itineraries_center_coords"
       ON "itineraries" ("center_latitude", "center_longitude")
       WHERE "center_latitude" IS NOT NULL`,
    );

    // Make city nullable (now a display-only label, derived from center coords)
    await queryRunner.query(
      `ALTER TABLE "itineraries" ALTER COLUMN "city" DROP NOT NULL`,
    );

    // Add opening hours to itinerary items for "Open now" display
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" ADD COLUMN "opening_hours" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" DROP COLUMN "opening_hours"`,
    );

    // Restore NOT NULL on city (backfill first)
    await queryRunner.query(
      `UPDATE "itineraries" SET "city" = 'Unknown' WHERE "city" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ALTER COLUMN "city" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itineraries_center_coords"`,
    );

    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "radius_miles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "center_longitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "center_latitude"`,
    );
  }
}
