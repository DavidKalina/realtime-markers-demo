import type { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveNotesFromUserEventSaves1710000000007
  implements MigrationInterface
{
  name = "RemoveNotesFromUserEventSaves1710000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove notes column from user_event_saves table
    await queryRunner.query(`
      ALTER TABLE "user_event_saves"
      DROP COLUMN IF EXISTS "notes";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add notes column back to user_event_saves table
    await queryRunner.query(`
      ALTER TABLE "user_event_saves"
      ADD COLUMN IF NOT EXISTS "notes" text;
    `);
  }
}
