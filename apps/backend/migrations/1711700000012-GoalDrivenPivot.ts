import type { MigrationInterface, QueryRunner } from "typeorm";

export class GoalDrivenPivot1711700000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "actionability" VARCHAR(20) DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "objectives" DROP COLUMN IF EXISTS "actionability"`,
    );
  }
}
