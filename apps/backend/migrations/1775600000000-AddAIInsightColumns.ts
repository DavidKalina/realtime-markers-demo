import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddAIInsightColumns1775600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE sidequests ADD COLUMN IF NOT EXISTS strategy_note TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE sidequests ADD COLUMN IF NOT EXISTS ai_reflection TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_focus JSONB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE sidequests DROP COLUMN IF EXISTS strategy_note`,
    );
    await queryRunner.query(
      `ALTER TABLE sidequests DROP COLUMN IF EXISTS ai_reflection`,
    );
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS ai_focus`,
    );
  }
}
