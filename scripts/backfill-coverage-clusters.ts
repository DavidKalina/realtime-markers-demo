/**
 * Backfill coverage_clusters from existing objective check-in data.
 *
 * Run: npx tsx scripts/backfill-coverage-clusters.ts
 *
 * This populates coverage clusters for all users who have checked-in
 * objectives, aggregating by rounded coordinates (~111m precision).
 */
import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  User,
  UserPushToken,
  LlmUsageLog,
  Sidequest,
  Objective,
  ObjectiveCheckin,
  UserBadge,
  CoverageCluster,
  CoverageSnapshot,
} from "@realtime-markers/database";

const SHADE_DECAY_RATE = 0.5;

function computeShade(visitCount: number): number {
  return Math.round((1 - Math.exp(-SHADE_DECAY_RATE * visitCount)) * 1000) / 1000;
}

async function main() {
  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [
      User,
      UserPushToken,
      LlmUsageLog,
      Sidequest,
      Objective,
      ObjectiveCheckin,
      UserBadge,
      CoverageCluster,
      CoverageSnapshot,
    ],
    synchronize: false,
    logging: ["error"],
    ssl: false,
  });

  await dataSource.initialize();
  console.log("Database connected");

  // Aggregate checked-in objectives by user and rounded coordinates
  const rows: {
    user_id: string;
    rounded_lat: number;
    rounded_lng: number;
    avg_lat: number;
    avg_lng: number;
    visit_count: number;
    venue_categories: string[];
    last_visited_at: Date;
  }[] = await dataSource.query(`
    SELECT
      s.user_id,
      round(o.latitude::numeric, 3) AS rounded_lat,
      round(o.longitude::numeric, 3) AS rounded_lng,
      AVG(o.latitude)::numeric(10,7) AS avg_lat,
      AVG(o.longitude)::numeric(10,7) AS avg_lng,
      COUNT(*)::int AS visit_count,
      array_agg(DISTINCT o.venue_category) FILTER (WHERE o.venue_category IS NOT NULL) AS venue_categories,
      MAX(o.checked_in_at) AS last_visited_at
    FROM objectives o
    JOIN sidequests s ON s.id = o.sidequest_id
    WHERE o.checked_in_at IS NOT NULL
      AND o.latitude IS NOT NULL
      AND o.longitude IS NOT NULL
    GROUP BY s.user_id, round(o.latitude::numeric, 3), round(o.longitude::numeric, 3)
    ORDER BY s.user_id
  `);

  console.log(`Found ${rows.length} clusters to backfill`);

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const shade = computeShade(row.visit_count);

    try {
      await dataSource.query(
        `INSERT INTO coverage_clusters (user_id, latitude, longitude, visit_count, shade, venue_categories, last_visited_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, round(latitude::numeric, 3), round(longitude::numeric, 3))
         DO UPDATE SET
           visit_count = EXCLUDED.visit_count,
           shade = EXCLUDED.shade,
           venue_categories = EXCLUDED.venue_categories,
           last_visited_at = EXCLUDED.last_visited_at,
           updated_at = now()`,
        [
          row.user_id,
          row.avg_lat,
          row.avg_lng,
          row.visit_count,
          shade,
          row.venue_categories ?? [],
          row.last_visited_at,
        ],
      );
      inserted++;
    } catch (err) {
      console.error(`Failed to insert cluster for user ${row.user_id}:`, err);
      skipped++;
    }
  }

  console.log(`Backfill complete: ${inserted} inserted, ${skipped} skipped`);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
