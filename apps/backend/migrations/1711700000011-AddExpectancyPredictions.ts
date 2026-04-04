import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddExpectancyPredictions1711700000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "predicted_anxiety" SMALLINT DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "predicted_difficulty" SMALLINT DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "predicted_outcome" TEXT DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expectancy_calibration" JSONB DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "objectives" DROP COLUMN IF EXISTS "predicted_anxiety"`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" DROP COLUMN IF EXISTS "predicted_difficulty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" DROP COLUMN IF EXISTS "predicted_outcome"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "expectancy_calibration"`,
    );
  }
}
