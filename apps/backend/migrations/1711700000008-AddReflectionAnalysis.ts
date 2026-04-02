import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddReflectionAnalysis1711700000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "objectives"
      ADD COLUMN IF NOT EXISTS "reflection_depth" real,
      ADD COLUMN IF NOT EXISTS "reflection_sentiment" real,
      ADD COLUMN IF NOT EXISTS "reflection_tags" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "objectives"
      DROP COLUMN IF EXISTS "reflection_depth",
      DROP COLUMN IF EXISTS "reflection_sentiment",
      DROP COLUMN IF EXISTS "reflection_tags"
    `);
  }
}
