import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Backfill entry_latitude, entry_longitude for published itineraries
 * that are missing these fields. Embeddings and categories require
 * OpenAI calls and must be backfilled via a runtime script instead.
 */
export class BackfillItineraryEnhancements1710000000057
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backfill entry point from the first item (by sort_order) that has coordinates
    await queryRunner.query(`
      UPDATE itineraries i
      SET
        entry_latitude = sub.latitude,
        entry_longitude = sub.longitude
      FROM (
        SELECT DISTINCT ON (ii.itinerary_id)
          ii.itinerary_id,
          ii.latitude,
          ii.longitude
        FROM itinerary_items ii
        WHERE ii.latitude IS NOT NULL
          AND ii.longitude IS NOT NULL
        ORDER BY ii.itinerary_id, ii.sort_order ASC
      ) sub
      WHERE i.id = sub.itinerary_id
        AND i.is_published = true
        AND i.entry_latitude IS NULL
    `);

    const result = await queryRunner.query(
      `SELECT COUNT(*) as count FROM itineraries WHERE is_published = true AND entry_latitude IS NOT NULL`,
    );
    console.log(
      `[BackfillItineraryEnhancements] Updated entry points for ${result[0]?.count ?? 0} published itineraries`,
    );
  }

  public async down(): Promise<void> {
    // No-op: we don't want to null out entry points on rollback
  }
}
