import type { MigrationInterface, QueryRunner } from "typeorm";

export class ItinerarySidequestTemplates1710000000070
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make planned_date nullable (templates don't have a date)
    await queryRunner.query(
      `ALTER TABLE "itineraries" ALTER COLUMN "planned_date" DROP NOT NULL`,
    );

    // Add is_template flag
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN "is_template" boolean NOT NULL DEFAULT false`,
    );

    // Add constraints JSONB column for AI-modifiable parameters
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN "constraints" jsonb`,
    );

    // Make start_time / end_time nullable on items (templates have no times)
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" ALTER COLUMN "start_time" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" ALTER COLUMN "end_time" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore NOT NULL on item times (backfill first to avoid errors)
    await queryRunner.query(
      `UPDATE "itinerary_items" SET "start_time" = '00:00' WHERE "start_time" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "itinerary_items" SET "end_time" = '00:00' WHERE "end_time" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" ALTER COLUMN "start_time" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" ALTER COLUMN "end_time" SET NOT NULL`,
    );

    // Drop new columns
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "constraints"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "is_template"`,
    );

    // Restore NOT NULL on planned_date (backfill first)
    await queryRunner.query(
      `UPDATE "itineraries" SET "planned_date" = NOW() WHERE "planned_date" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ALTER COLUMN "planned_date" SET NOT NULL`,
    );
  }
}
