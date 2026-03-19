import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItinerarySoftDelete1710000000060 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN "deleted_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "deleted_at"`,
    );
  }
}
