import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddWouldReturn1775520000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE objectives ADD COLUMN IF NOT EXISTS would_return boolean`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE objectives DROP COLUMN IF EXISTS would_return`,
    );
  }
}
