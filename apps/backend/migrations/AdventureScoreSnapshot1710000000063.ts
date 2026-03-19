import { type MigrationInterface, type QueryRunner } from "typeorm";

export class AdventureScoreSnapshot1710000000063 implements MigrationInterface {
  name = "AdventureScoreSnapshot1710000000063";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "adventure_score_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "score" integer NOT NULL,
        "activity_score" integer NOT NULL,
        "consistency_score" integer NOT NULL,
        "diversity_score" integer NOT NULL,
        "completion_score" integer NOT NULL,
        "discovery_score" integer NOT NULL,
        "computed_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ass_user_computed"
      ON "adventure_score_snapshots" ("user_id", "computed_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ass_user_computed"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "adventure_score_snapshots"`);
  }
}
