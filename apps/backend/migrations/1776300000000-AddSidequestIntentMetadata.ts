import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSidequestIntentMetadata1776300000000 implements MigrationInterface {
  name = "AddSidequestIntentMetadata1776300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sidequests
      ADD COLUMN IF NOT EXISTS opportunity_scope varchar(50),
      ADD COLUMN IF NOT EXISTS travel_rationale text,
      ADD COLUMN IF NOT EXISTS goal_milestone_key varchar(100),
      ADD COLUMN IF NOT EXISTS goal_milestone_title varchar(200),
      ADD COLUMN IF NOT EXISTS direct_goal_touch boolean,
      ADD COLUMN IF NOT EXISTS goal_action_type varchar(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sidequests
      DROP COLUMN IF EXISTS goal_action_type,
      DROP COLUMN IF EXISTS direct_goal_touch,
      DROP COLUMN IF EXISTS goal_milestone_title,
      DROP COLUMN IF EXISTS goal_milestone_key,
      DROP COLUMN IF EXISTS travel_rationale,
      DROP COLUMN IF EXISTS opportunity_scope
    `);
  }
}
