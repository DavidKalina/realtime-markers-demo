import { type MigrationInterface, type QueryRunner } from "typeorm";

export class ThirdSpaceScoreSnapshot1710000000033 implements MigrationInterface {
  name = "ThirdSpaceScoreSnapshot1710000000033";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "third_space_score_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "city" varchar NOT NULL,
        "score" integer NOT NULL,
        "vitality_score" integer NOT NULL,
        "discovery_score" integer NOT NULL,
        "diversity_score" integer NOT NULL,
        "engagement_score" integer NOT NULL,
        "rootedness_score" integer NOT NULL,
        "raw_data" jsonb NOT NULL,
        "computed_at" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tss_city_computed"
      ON "third_space_score_snapshots" ("city", "computed_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tss_city_computed"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "third_space_score_snapshots"`,
    );
  }
}
