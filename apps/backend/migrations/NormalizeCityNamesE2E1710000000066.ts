import { type MigrationInterface, type QueryRunner } from "typeorm";
import { normalizeCity } from "@realtime-markers/database";

export class NormalizeCityNamesE2E1710000000066
  implements MigrationInterface
{
  name = "NormalizeCityNamesE2E1710000000066";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. Normalize itineraries.city ---
    const itineraryRows: { city: string }[] = await queryRunner.query(
      `SELECT DISTINCT city FROM itineraries WHERE city IS NOT NULL`,
    );

    for (const row of itineraryRows) {
      const normalized = normalizeCity(row.city);
      if (normalized !== row.city) {
        await queryRunner.query(
          `UPDATE itineraries SET city = $1 WHERE city = $2`,
          [normalized, row.city],
        );
      }
    }

    // --- 2. Normalize third_space_score_snapshots.city ---
    const snapshotCities: { city: string }[] = await queryRunner.query(
      `SELECT DISTINCT city FROM third_space_score_snapshots`,
    );

    for (const row of snapshotCities) {
      const normalized = normalizeCity(row.city);
      if (normalized !== row.city) {
        await queryRunner.query(
          `UPDATE third_space_score_snapshots SET city = $1 WHERE city = $2`,
          [normalized, row.city],
        );
      }
    }

    // --- 3. Deduplicate snapshots that now share the same city + computed_at ---
    // Keep the row with the highest id (most recently inserted)
    await queryRunner.query(`
      DELETE FROM third_space_score_snapshots a
      USING third_space_score_snapshots b
      WHERE a.city = b.city
        AND a.computed_at = b.computed_at
        AND a.id < b.id
    `);

    // --- 4. Remove orphaned snapshots for cities with zero itineraries ---
    // These won't recompute (computeAllCities only iterates itineraries)
    // and just pollute the leaderboard with zero-score entries.
    await queryRunner.query(`
      DELETE FROM third_space_score_snapshots
      WHERE city NOT IN (
        SELECT DISTINCT city FROM itineraries WHERE city IS NOT NULL
      )
    `);
  }

  public async down(): Promise<void> {
    // Normalization is not reversible — original casing is lost.
  }
}
