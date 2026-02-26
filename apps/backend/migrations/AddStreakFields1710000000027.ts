import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStreakFields1710000000027 implements MigrationInterface {
  name = "AddStreakFields1710000000027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "current_streak" INTEGER NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "longest_streak" INTEGER NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "last_scan_date" DATE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_scan_date"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "longest_streak"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "current_streak"`);
  }
}
