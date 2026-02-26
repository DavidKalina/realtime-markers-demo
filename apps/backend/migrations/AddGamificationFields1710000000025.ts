import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddGamificationFields1710000000025 implements MigrationInterface {
  name = "AddGamificationFields1710000000025";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "total_xp" INTEGER NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "current_tier" VARCHAR(20) DEFAULT 'Explorer'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "current_tier"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "total_xp"`);
  }
}
