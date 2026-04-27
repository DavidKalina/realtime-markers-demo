import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSidequestCapabilityColumns1776800000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sidequests
        ADD COLUMN IF NOT EXISTS capability_id varchar(128),
        ADD COLUMN IF NOT EXISTS enactment_pattern_id varchar(128)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sidequests
        DROP COLUMN IF EXISTS capability_id,
        DROP COLUMN IF EXISTS enactment_pattern_id
    `);
  }
}
