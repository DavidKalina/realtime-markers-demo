import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryMapFields1710000000056 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "embedding" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "categories" text[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "entry_latitude" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "entry_longitude" numeric(10,7)`,
    );
    // Index for spatial queries on entry point
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itineraries_entry_coords" ON "itineraries" ("entry_latitude", "entry_longitude") WHERE "entry_latitude" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itineraries_entry_coords"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "entry_longitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "entry_latitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "categories"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "embedding"`,
    );
  }
}
