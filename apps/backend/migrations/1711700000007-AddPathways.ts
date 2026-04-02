import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPathways1711700000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pathways" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "theme" varchar(200) NOT NULL,
        "theme_label" varchar(200),
        "venue_categories" text[] DEFAULT '{}',
        "avg_resonance" numeric(4,3) DEFAULT 0,
        "quest_count" int DEFAULT 0,
        "current_difficulty" smallint DEFAULT 1,
        "difficulty_trend" numeric(4,3) DEFAULT 0,
        "phase" varchar(10) DEFAULT 'bfs',
        "sidequest_ids" uuid[] DEFAULT '{}',
        "resonance_scores" jsonb,
        "created_at" timestamptz DEFAULT now(),
        "updated_at" timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pathways_user_id" ON "pathways" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pathways_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pathways"`);
  }
}
