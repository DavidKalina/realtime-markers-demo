import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryShareToken1710000000037 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD COLUMN "share_token" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_itineraries_share_token" ON "itineraries" ("share_token") WHERE "share_token" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_itineraries_share_token"`);
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "share_token"`,
    );
  }
}
