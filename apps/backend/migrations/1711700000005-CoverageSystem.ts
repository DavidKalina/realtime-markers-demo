import type { MigrationInterface, QueryRunner } from "typeorm";

export class CoverageSystem1711700000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coverage_clusters" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "latitude" numeric(10,7) NOT NULL,
        "longitude" numeric(10,7) NOT NULL,
        "visit_count" int NOT NULL DEFAULT 1,
        "shade" numeric(4,3) NOT NULL DEFAULT 0,
        "venue_categories" text[] NOT NULL DEFAULT '{}',
        "last_visited_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_coverage_clusters_user"
        ON "coverage_clusters" ("user_id")
    `);

    // Unique on rounded coords (~111m precision) to cluster nearby check-ins
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_coverage_clusters_user_loc"
        ON "coverage_clusters" (
          "user_id",
          round("latitude"::numeric, 3),
          round("longitude"::numeric, 3)
        )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coverage_snapshots" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "cells_geojson" jsonb,
        "canvas_geojson" jsonb,
        "coverage_pct" numeric(5,2) NOT NULL DEFAULT 0,
        "territory_sq_miles" numeric(10,3) NOT NULL DEFAULT 0,
        "avg_density" numeric(4,3) NOT NULL DEFAULT 0,
        "frontier_miles" numeric(10,3) NOT NULL DEFAULT 0,
        "cluster_count" int NOT NULL DEFAULT 0,
        "directional_gaps" jsonb,
        "computed_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_coverage_snapshots_user"
        ON "coverage_snapshots" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "coverage_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coverage_clusters"`);
  }
}
