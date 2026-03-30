import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddDifficulty1711700000003 implements MigrationInterface {
  name = "AddDifficulty1711700000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "objectives"
        ADD COLUMN IF NOT EXISTS "difficulty" smallint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "objectives"
        DROP COLUMN IF EXISTS "difficulty"
    `);
  }
}
