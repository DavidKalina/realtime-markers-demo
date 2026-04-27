import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReachMode1776400000000 implements MigrationInterface {
  name = "AddReachMode1776400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reach_mode varchar(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS reach_mode
    `);
  }
}
