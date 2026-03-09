import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryForecast1710000000040 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "forecast" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "itineraries" DROP COLUMN "forecast"`);
  }
}
