import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddGlobalItineraryFields1710000000055 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "times_adopted" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "source_itinerary_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD CONSTRAINT "FK_itineraries_source_itinerary" FOREIGN KEY ("source_itinerary_id") REFERENCES "itineraries"("id") ON DELETE SET NULL`,
    );
    // Partial index for browsing published itineraries by city
    await queryRunner.query(
      `CREATE INDEX "IDX_itineraries_city_published" ON "itineraries" ("city", "is_published") WHERE "is_published" = true`,
    );
    // Index for lineage lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_itineraries_source_itinerary_id" ON "itineraries" ("source_itinerary_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itineraries_source_itinerary_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itineraries_city_published"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP CONSTRAINT IF EXISTS "FK_itineraries_source_itinerary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "source_itinerary_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "times_adopted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "is_published"`,
    );
  }
}
