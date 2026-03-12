import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryRatingAndCompletion1710000000050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "rating" smallint`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "rating_comment" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "completed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "rating_comment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "rating"`,
    );
  }
}
