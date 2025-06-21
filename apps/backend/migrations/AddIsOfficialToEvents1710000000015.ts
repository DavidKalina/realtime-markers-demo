import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsOfficialToEvents1710000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_official boolean column to events table
    await queryRunner.query(`
      ALTER TABLE "events" 
      ADD COLUMN "is_official" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove is_official column from events table
    await queryRunner.query(`
      ALTER TABLE "events" 
      DROP COLUMN "is_official"
    `);
  }
}
