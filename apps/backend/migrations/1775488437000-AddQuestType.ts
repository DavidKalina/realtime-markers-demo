import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuestType1775488437000 implements MigrationInterface {
  name = "AddQuestType1775488437000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sidequests" ADD COLUMN IF NOT EXISTS "quest_type" character varying(20) NOT NULL DEFAULT 'venue'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sidequests" ADD COLUMN IF NOT EXISTS "challenge_category" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sidequests" DROP COLUMN IF EXISTS "challenge_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sidequests" DROP COLUMN IF EXISTS "quest_type"`,
    );
  }
}
