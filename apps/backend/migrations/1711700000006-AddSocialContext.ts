import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddSocialContext1711700000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "objectives"
      ADD COLUMN IF NOT EXISTS "social_context" varchar(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "objectives"
      DROP COLUMN IF EXISTS "social_context"
    `);
  }
}
