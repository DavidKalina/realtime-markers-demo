import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBatchAndPathwayContext1711700000009
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sidequests"
      ADD COLUMN IF NOT EXISTS "batch_id" uuid,
      ADD COLUMN IF NOT EXISTS "batch_index" smallint,
      ADD COLUMN IF NOT EXISTS "pathway_id" uuid,
      ADD COLUMN IF NOT EXISTS "pathway_theme" varchar(100),
      ADD COLUMN IF NOT EXISTS "pathway_label" varchar(200),
      ADD COLUMN IF NOT EXISTS "pathway_phase" varchar(10),
      ADD COLUMN IF NOT EXISTS "quest_role" varchar(20)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sidequests_batch_id"
      ON "sidequests" ("batch_id")
      WHERE "batch_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_sidequests_batch_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "sidequests"
      DROP COLUMN IF EXISTS "batch_id",
      DROP COLUMN IF EXISTS "batch_index",
      DROP COLUMN IF EXISTS "pathway_id",
      DROP COLUMN IF EXISTS "pathway_theme",
      DROP COLUMN IF EXISTS "pathway_label",
      DROP COLUMN IF EXISTS "pathway_phase",
      DROP COLUMN IF EXISTS "quest_role"
    `);
  }
}
