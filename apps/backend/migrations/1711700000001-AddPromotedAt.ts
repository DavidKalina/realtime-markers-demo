import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPromotedAt1711700000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sidequests" ADD COLUMN "promoted_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sidequests" DROP COLUMN "promoted_at"`,
    );
  }
}
