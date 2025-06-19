import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddQueryAnalytics1710000000013 implements MigrationInterface {
  name = "AddQueryAnalytics1710000000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create query_analytics table
    await queryRunner.query(`
      CREATE TABLE "query_analytics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "query" text NOT NULL,
        "normalized_query" text NOT NULL,
        "total_searches" integer NOT NULL DEFAULT 0,
        "total_hits" integer NOT NULL DEFAULT 0,
        "zero_result_searches" integer NOT NULL DEFAULT 0,
        "average_results_per_search" double precision NOT NULL DEFAULT 0,
        "hit_rate" double precision NOT NULL DEFAULT 0,
        "first_searched_at" TIMESTAMP,
        "last_searched_at" TIMESTAMP,
        "top_results" jsonb,
        "search_categories" jsonb,
        "is_popular" boolean NOT NULL DEFAULT false,
        "needs_attention" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_query_analytics" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_query_analytics_normalized_query" ON "query_analytics" ("normalized_query")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_query_analytics_query" ON "query_analytics" ("query")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_query_analytics_total_searches" ON "query_analytics" ("total_searches")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_query_analytics_hit_rate" ON "query_analytics" ("hit_rate")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_query_analytics_last_searched_at" ON "query_analytics" ("last_searched_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_query_analytics_is_popular" ON "query_analytics" ("is_popular")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_query_analytics_needs_attention" ON "query_analytics" ("needs_attention")
    `);

    // Create unique constraint on normalized_query to prevent duplicates
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_query_analytics_normalized_query" ON "query_analytics" ("normalized_query")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "UQ_query_analytics_normalized_query"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_query_analytics_needs_attention"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_query_analytics_is_popular"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_query_analytics_last_searched_at"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_query_analytics_hit_rate"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_query_analytics_total_searches"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_query_analytics_query"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_query_analytics_normalized_query"
    `);

    // Drop query_analytics table
    await queryRunner.query(`
      DROP TABLE "query_analytics"
    `);
  }
}
