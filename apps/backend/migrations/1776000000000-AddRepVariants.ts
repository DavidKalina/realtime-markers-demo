import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRepVariants1776000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "smaller_rep" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "tiny_rep" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "min_viable_win" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "exit_ramp" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "completed_version" character varying(10)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "objectives" DROP COLUMN IF EXISTS "completed_version"`);
    await queryRunner.query(`ALTER TABLE "objectives" DROP COLUMN IF EXISTS "exit_ramp"`);
    await queryRunner.query(`ALTER TABLE "objectives" DROP COLUMN IF EXISTS "min_viable_win"`);
    await queryRunner.query(`ALTER TABLE "objectives" DROP COLUMN IF EXISTS "tiny_rep"`);
    await queryRunner.query(`ALTER TABLE "objectives" DROP COLUMN IF EXISTS "smaller_rep"`);
  }
}
