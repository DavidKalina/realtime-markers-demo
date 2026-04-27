import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserVenueQualities1776700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS venue_qualities jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS venue_qualities`,
    );
  }
}
