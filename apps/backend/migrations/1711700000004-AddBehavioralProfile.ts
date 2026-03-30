import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBehavioralProfile1711700000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "behavioral_profile" JSONB DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "behavioral_profile"`,
    );
  }
}
